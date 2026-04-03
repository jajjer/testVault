import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { getFirestoreDb } from "@/lib/firebase";
import { getRunTestNumberForCase } from "@/lib/run-test-numbers";
import { useTestRunStore } from "@/store/test-run-store";
import type {
  RunStatus,
  TestResultOutcome,
  TestRunDoc,
} from "@/types/models";

export interface TestCaseRunHistoryRow {
  run: TestRunDoc;
  tNumber: number;
  outcome: TestResultOutcome | null;
}

function isOutcome(v: unknown): v is TestResultOutcome {
  return (
    v === "passed" ||
    v === "failed" ||
    v === "blocked" ||
    v === "skipped" ||
    v === "retest"
  );
}

/**
 * Runs that include this case (newest first), with T number and result outcome when a results doc exists.
 */
export function useTestCaseRunHistory(
  projectId: string | undefined,
  caseId: string | undefined,
  enabled: boolean
): {
  rows: TestCaseRunHistoryRow[];
  loading: boolean;
  runsLoading: boolean;
  outcomesLoading: boolean;
} {
  const runs = useTestRunStore((s) => s.runs);
  const runsLoading = useTestRunStore((s) => s.loading);

  const matchingRuns = useMemo(() => {
    if (!caseId) return [];
    return runs
      .filter((r) => r.caseIds.includes(caseId))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [runs, caseId]);

  const [outcomesByRunId, setOutcomesByRunId] = useState<
    Record<string, TestResultOutcome | null>
  >({});
  const [outcomesLoading, setOutcomesLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !projectId || !caseId) {
      setOutcomesByRunId({});
      setOutcomesLoading(false);
      return;
    }

    const matching = runs
      .filter((r) => r.caseIds.includes(caseId))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (matching.length === 0) {
      setOutcomesByRunId({});
      setOutcomesLoading(false);
      return;
    }

    let cancelled = false;
    setOutcomesLoading(true);

    (async () => {
      const db = getFirestoreDb();
      const snaps = await Promise.all(
        matching.map((r) =>
          getDoc(
            doc(db, "projects", projectId, "runs", r.id, "results", caseId)
          )
        )
      );
      if (cancelled) return;

      const next: Record<string, TestResultOutcome | null> = {};
      snaps.forEach((snap, i) => {
        const runId = matching[i]!.id;
        if (!snap.exists()) {
          next[runId] = null;
          return;
        }
        const o = snap.data().outcome;
        next[runId] = isOutcome(o) ? o : null;
      });
      setOutcomesByRunId(next);
      setOutcomesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, projectId, caseId, runs]);

  const rows: TestCaseRunHistoryRow[] = useMemo(
    () =>
      matchingRuns.map((run) => ({
        run,
        tNumber: getRunTestNumberForCase(run, caseId!),
        outcome: outcomesByRunId[run.id] ?? null,
      })),
    [matchingRuns, caseId, outcomesByRunId]
  );

  return {
    rows,
    /** True while run list or result docs are still loading. */
    loading: runsLoading || outcomesLoading,
    runsLoading,
    outcomesLoading,
  };
}

export function runStatusLabel(s: RunStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
