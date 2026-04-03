import { Link } from "react-router-dom";

import { formatRunTestRef } from "@/lib/run-test-display";
import {
  runStatusLabel,
  useTestCaseRunHistory,
} from "@/hooks/use-test-case-run-history";
import type { TestResultOutcome } from "@/types/models";
import { cn } from "@/lib/utils";

function outcomeLabel(o: TestResultOutcome | null): string {
  if (!o) return "—";
  return o.charAt(0).toUpperCase() + o.slice(1);
}

function outcomeClass(o: TestResultOutcome | null): string {
  if (!o) return "text-muted-foreground";
  switch (o) {
    case "passed":
      return "text-emerald-700 dark:text-emerald-400";
    case "failed":
      return "text-red-700 dark:text-red-400";
    case "blocked":
      return "text-amber-700 dark:text-amber-400";
    case "skipped":
      return "text-slate-600 dark:text-slate-400";
    case "retest":
      return "text-violet-700 dark:text-violet-400";
    default:
      return "text-muted-foreground";
  }
}

function runStatusPillClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
    case "archived":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    default:
      return "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200";
  }
}

export function TestCaseRunHistorySection({
  projectId,
  caseId,
  enabled,
}: {
  projectId: string;
  caseId: string;
  enabled: boolean;
}) {
  const { rows, runsLoading, outcomesLoading } = useTestCaseRunHistory(
    projectId,
    caseId,
    enabled
  );

  if (!enabled) return null;

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Run history</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Each row is a test run that included this case.{" "}
          <span className="font-mono">T</span> is the label for this case in
          that run (unique in the project).
        </p>
      </div>

      {runsLoading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading runs…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This case has not been added to any test run yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium w-[72px]">
                  <span className="font-mono">T</span>
                </th>
                <th className="px-3 py-2 font-medium">Test run</th>
                <th className="px-3 py-2 font-medium w-[100px]">Run status</th>
                <th className="px-3 py-2 font-medium w-[100px]">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ run, tNumber, outcome }) => (
                <tr
                  key={run.id}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="px-3 py-2 align-middle">
                    <span className="font-mono font-medium tabular-nums">
                      {formatRunTestRef(tNumber)}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <Link
                      to={`/projects/${projectId}/runs/${run.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {run.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        runStatusPillClass(run.status)
                      )}
                    >
                      {runStatusLabel(run.status)}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 align-middle text-xs font-medium",
                      outcomesLoading && outcome === null
                        ? "text-muted-foreground"
                        : outcomeClass(outcome)
                    )}
                  >
                    {outcomesLoading && outcome === null ? "…" : outcomeLabel(outcome)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
