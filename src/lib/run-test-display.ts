/** TestRail-style id (e.g. `T3`) — project-unique for this case in a run. */
export function formatRunTestRef(runTestNumber: number): string {
  if (typeof runTestNumber !== "number" || runTestNumber < 1) {
    return "—";
  }
  return `T${runTestNumber}`;
}
