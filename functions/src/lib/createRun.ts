import type { Firestore } from "firebase-admin/firestore";

const DEFAULT_SUITE_ID = "default";

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

async function getMaxRunTestNumberInProject(
  db: Firestore,
  projectId: string
): Promise<number> {
  const snap = await db
    .collection("projects")
    .doc(projectId)
    .collection("runs")
    .get();
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

/**
 * Creates a test run and assigns T numbers from the project counter (same behavior as the web app).
 */
export async function createTestRun(
  db: Firestore,
  projectId: string,
  input: { name: string; caseIds: string[]; createdBy: string }
): Promise<string> {
  const now = Date.now();
  const projectRef = db.collection("projects").doc(projectId);
  const runRef = projectRef.collection("runs").doc();

  const maxAcross = await getMaxRunTestNumberInProject(db, projectId);

  await db.runTransaction(async (transaction) => {
    const pSnap = await transaction.get(projectRef);
    if (!pSnap.exists) {
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
}

export async function loadRun(
  db: Firestore,
  projectId: string,
  runId: string
): Promise<{
  caseIds: string[];
  runTestNumbers: Record<string, number>;
  name: string;
  status: string;
} | null> {
  const snap = await db
    .collection("projects")
    .doc(projectId)
    .collection("runs")
    .doc(runId)
    .get();
  if (!snap.exists) return null;
  const d = snap.data()!;
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
    caseIds,
    runTestNumbers,
    name: String(d.name ?? ""),
    status: String(d.status ?? "active"),
  };
}
