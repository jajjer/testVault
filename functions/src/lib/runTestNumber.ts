/**
 * Resolve Firestore test case id from a run's T number (runTestNumbers map).
 * T numbers are unique within a run's mapping (and project-wide in storage).
 */
export function caseIdForRunTestNumber(
  runTestNumbers: Record<string, number> | undefined,
  runTestNumber: number
): string | undefined {
  if (!runTestNumbers || runTestNumber < 1) return undefined;
  for (const [caseId, num] of Object.entries(runTestNumbers)) {
    if (num === runTestNumber) return caseId;
  }
  return undefined;
}
