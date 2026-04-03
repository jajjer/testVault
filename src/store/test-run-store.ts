import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { create } from "zustand";

import { getFirestoreDb } from "@/lib/firebase";
import { allocateRunTestNumbersFromProjectCounter } from "@/lib/run-test-numbers";
import { DEFAULT_SUITE_ID } from "@/lib/test-case-defaults";
import type { RunStatus, TestRunDoc } from "@/types/models";

interface TestRunState {
  runs: TestRunDoc[];
  loading: boolean;
  listen: (projectId: string) => Unsubscribe;
  stop: () => void;
  createRun: (
    projectId: string,
    input: {
      name: string;
      caseIds: string[];
      createdBy: string;
    }
  ) => Promise<string>;
  deleteRun: (projectId: string, runId: string) => Promise<void>;
  updateRun: (
    projectId: string,
    runId: string,
    input: {
      name: string;
      caseIds: string[];
      status: RunStatus;
    }
  ) => Promise<void>;
}

let activeUnsub: Unsubscribe | null = null;
let lastListenProjectId: string | null = null;

/** Highest T number stored on any run in the project (for counter migration / safety). */
async function getMaxRunTestNumberInProject(
  db: Firestore,
  projectId: string
): Promise<number> {
  const snap = await getDocs(
    collection(db, "projects", projectId, "runs")
  );
  let maxT = 0;
  snap.forEach((d) => {
    const m = d.data().runTestNumbers;
    if (m && typeof m === "object" && !Array.isArray(m)) {
      for (const v of Object.values(m)) {
        if (typeof v === "number" && v > maxT) maxT = v;
      }
    }
  });
  return maxT;
}

function parseRunTestNumbers(
  raw: unknown
): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "number" && v >= 1) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeRun(id: string, data: Record<string, unknown>): TestRunDoc {
  const d = data as Partial<TestRunDoc>;
  const completedAt = d.completedAt;
  const caseIds = Array.isArray(d.caseIds) ? (d.caseIds as string[]) : [];
  const rawMap = parseRunTestNumbers(d.runTestNumbers);
  const runTestNumbers: Record<string, number> = { ...(rawMap ?? {}) };
  for (let i = 0; i < caseIds.length; i++) {
    const cid = caseIds[i];
    if (runTestNumbers[cid] == null) {
      runTestNumbers[cid] = i + 1;
    }
  }

  return {
    id,
    projectId: String(d.projectId ?? ""),
    name: String(d.name ?? ""),
    suiteId: String(d.suiteId ?? DEFAULT_SUITE_ID),
    caseIds,
    runTestNumbers,
    status: (d.status ?? "active") as TestRunDoc["status"],
    createdBy: String(d.createdBy ?? ""),
    createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
    updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : 0,
    completedAt:
      completedAt === null
        ? null
        : typeof completedAt === "number"
          ? completedAt
          : null,
  };
}

export const useTestRunStore = create<TestRunState>((set) => ({
  runs: [],
  loading: true,

  listen: (projectId: string) => {
    if (activeUnsub) {
      activeUnsub();
      activeUnsub = null;
    }
    if (lastListenProjectId !== projectId) {
      set({ runs: [], loading: true });
      lastListenProjectId = projectId;
    } else {
      set({ loading: true });
    }

    const q = query(
      collection(getFirestoreDb(), "projects", projectId, "runs"),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const runs: TestRunDoc[] = snap.docs.map((d) =>
          normalizeRun(d.id, d.data())
        );
        set({ runs, loading: false });
      },
      (err) => {
        console.error("[Railyard] test runs listener:", err);
        set({ loading: false });
      }
    );
    activeUnsub = unsub;
    return unsub;
  },

  stop: () => {
    lastListenProjectId = null;
    if (activeUnsub) {
      activeUnsub();
      activeUnsub = null;
    }
    set({ runs: [], loading: true });
  },

  createRun: async (projectId, input) => {
    const db = getFirestoreDb();
    const now = Date.now();
    const projectRef = doc(db, "projects", projectId);
    const runRef = doc(collection(db, "projects", projectId, "runs"));

    const maxAcross = await getMaxRunTestNumberInProject(db, projectId);

    await runTransaction(db, async (transaction) => {
      const pSnap = await transaction.get(projectRef);
      if (!pSnap.exists()) {
        throw new Error("Project not found");
      }
      const pdata = pSnap.data() as { nextRunTestNumber?: number };
      let nextT = Math.max(
        typeof pdata.nextRunTestNumber === "number" &&
          pdata.nextRunTestNumber >= 1
          ? pdata.nextRunTestNumber
          : 1,
        maxAcross + 1
      );

      const runTestNumbers: Record<string, number> = {};
      for (const cid of input.caseIds) {
        runTestNumbers[cid] = nextT;
        nextT += 1;
      }

      transaction.set(runRef, {
        projectId,
        name: input.name,
        suiteId: DEFAULT_SUITE_ID,
        caseIds: input.caseIds,
        runTestNumbers,
        status: "active",
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      transaction.update(projectRef, {
        nextRunTestNumber: nextT,
        updatedAt: now,
      });
    });

    return runRef.id;
  },

  deleteRun: async (projectId, runId) => {
    const db = getFirestoreDb();
    const resultsSnap = await getDocs(
      collection(db, "projects", projectId, "runs", runId, "results")
    );
    const batch = writeBatch(db);
    resultsSnap.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "projects", projectId, "runs", runId));
    await batch.commit();
  },

  updateRun: async (projectId, runId, input) => {
    const db = getFirestoreDb();
    const now = Date.now();
    const runRef = doc(db, "projects", projectId, "runs", runId);
    const snap = await getDoc(runRef);
    if (!snap.exists()) {
      throw new Error("Test run not found");
    }
    const prev = snap.data() as {
      caseIds?: unknown;
      completedAt?: unknown;
      runTestNumbers?: unknown;
    };
    const prevIds: string[] = Array.isArray(prev.caseIds)
      ? (prev.caseIds as string[])
      : [];
    const newIds = input.caseIds;
    const removed = prevIds.filter((id) => !newIds.includes(id));

    const prevCompleted = prev.completedAt;
    let completedAt: number | null =
      prevCompleted === null || prevCompleted === undefined
        ? null
        : typeof prevCompleted === "number"
          ? prevCompleted
          : null;
    if (input.status === "completed") {
      if (completedAt == null) completedAt = now;
    } else {
      completedAt = null;
    }

    const CHUNK = 400;
    for (let i = 0; i < removed.length; i += CHUNK) {
      const slice = removed.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      slice.forEach((caseId) => {
        batch.delete(
          doc(
            db,
            "projects",
            projectId,
            "runs",
            runId,
            "results",
            caseId
          )
        );
      });
      await batch.commit();
    }

    const projectRef = doc(db, "projects", projectId);
    const prevMap = parseRunTestNumbers(prev.runTestNumbers) ?? {};
    const maxAcross = await getMaxRunTestNumberInProject(db, projectId);

    await runTransaction(db, async (transaction) => {
      const pSnap = await transaction.get(projectRef);
      const rSnap = await transaction.get(runRef);
      if (!pSnap.exists() || !rSnap.exists()) {
        throw new Error("Project or run not found");
      }
      const pdata = pSnap.data() as { nextRunTestNumber?: number };
      const projectNextT = Math.max(
        typeof pdata.nextRunTestNumber === "number" &&
          pdata.nextRunTestNumber >= 1
          ? pdata.nextRunTestNumber
          : 1,
        maxAcross + 1
      );

      const { runTestNumbers, nextProjectRunTestNumber } =
        allocateRunTestNumbersFromProjectCounter(
          newIds,
          prevIds,
          prevMap,
          projectNextT
        );

      transaction.update(runRef, {
        name: input.name.trim(),
        caseIds: newIds,
        runTestNumbers,
        status: input.status,
        updatedAt: now,
        completedAt,
      });

      transaction.update(projectRef, {
        nextRunTestNumber: nextProjectRunTestNumber,
        updatedAt: now,
      });
    });
  },
}));
