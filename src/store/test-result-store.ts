import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { create } from "zustand";

import { getFirestoreDb } from "@/lib/firebase";
import type { TestResultDoc, TestResultOutcome } from "@/types/models";

interface TestResultState {
  /** Result docs for the active run, keyed by case id. */
  resultsByCaseId: Record<string, TestResultDoc>;
  loading: boolean;
  listen: (projectId: string, runId: string) => Unsubscribe;
  stop: () => void;
  setRunResult: (
    projectId: string,
    runId: string,
    caseId: string,
    input: {
      outcome: TestResultOutcome | null;
      executedByUid: string;
    }
  ) => Promise<void>;
}

let activeUnsub: Unsubscribe | null = null;
let lastKey: string | null = null;

function isOutcome(v: unknown): v is TestResultOutcome {
  return (
    v === "passed" ||
    v === "failed" ||
    v === "blocked" ||
    v === "skipped" ||
    v === "retest"
  );
}

function normalizeResult(
  caseId: string,
  data: Record<string, unknown>
): TestResultDoc {
  const o = data.outcome;
  const outcome: TestResultOutcome | null = isOutcome(o) ? o : null;
  const ex = data.executedAt;
  return {
    caseId,
    runId: String(data.runId ?? ""),
    projectId: String(data.projectId ?? ""),
    outcome,
    comment: String(data.comment ?? ""),
    attachments: Array.isArray(data.attachments)
      ? (data.attachments as TestResultDoc["attachments"])
      : [],
    executedBy:
      data.executedBy === null || data.executedBy === undefined
        ? null
        : String(data.executedBy),
    executedAt:
      ex === null || ex === undefined
        ? null
        : typeof ex === "number"
          ? ex
          : null,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
  };
}

export const useTestResultStore = create<TestResultState>((set) => ({
  resultsByCaseId: {},
  loading: true,

  listen: (projectId: string, runId: string) => {
    if (activeUnsub) {
      activeUnsub();
      activeUnsub = null;
    }

    const key = `${projectId}/${runId}`;
    if (lastKey !== key) {
      set({ resultsByCaseId: {}, loading: true });
      lastKey = key;
    } else {
      set({ loading: true });
    }

    const db = getFirestoreDb();
    const q = collection(
      db,
      "projects",
      projectId,
      "runs",
      runId,
      "results"
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const resultsByCaseId: Record<string, TestResultDoc> = {};
        snap.docs.forEach((d) => {
          resultsByCaseId[d.id] = normalizeResult(d.id, d.data());
        });
        set({ resultsByCaseId, loading: false });
      },
      (err) => {
        console.error("[Railyard] run results listener:", err);
        set({ loading: false });
      }
    );
    activeUnsub = unsub;
    return unsub;
  },

  stop: () => {
    lastKey = null;
    if (activeUnsub) {
      activeUnsub();
      activeUnsub = null;
    }
    set({ resultsByCaseId: {}, loading: true });
  },

  setRunResult: async (projectId, runId, caseId, input) => {
    const db = getFirestoreDb();
    const ref = doc(
      db,
      "projects",
      projectId,
      "runs",
      runId,
      "results",
      caseId
    );
    const now = Date.now();
    const snap = await getDoc(ref);
    const prev = snap.exists() ? snap.data() : {};
    const prevAttachments = Array.isArray(prev.attachments)
      ? prev.attachments
      : [];

    await setDoc(
      ref,
      {
        caseId,
        runId,
        projectId,
        outcome: input.outcome,
        comment: String(prev.comment ?? ""),
        attachments: prevAttachments,
        executedBy:
          input.outcome !== null ? input.executedByUid : null,
        executedAt: input.outcome !== null ? now : null,
        updatedAt: now,
      },
      { merge: true }
    );
  },
}));
