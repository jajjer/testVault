import { useEffect } from "react";

import { useTestResultStore } from "@/store/test-result-store";

export function useRunResultsSync(
  projectId: string | undefined,
  runId: string | undefined
) {
  useEffect(() => {
    if (!projectId || !runId) {
      useTestResultStore.getState().stop();
      return;
    }
    useTestResultStore.getState().listen(projectId, runId);
    return () => {
      useTestResultStore.getState().stop();
    };
  }, [projectId, runId]);
}
