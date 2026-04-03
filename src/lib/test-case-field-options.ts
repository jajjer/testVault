import type { ProjectDoc } from "@/types/models";

/** Default priority values when the project has not customized the list. */
export const DEFAULT_TEST_CASE_PRIORITY_OPTIONS = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

/** Default type values when the project has not customized the list. */
export const DEFAULT_TEST_CASE_TYPE_OPTIONS = [
  "functional",
  "regression",
  "smoke",
  "integration",
  "ui",
  "api",
  "security",
  "performance",
  "other",
] as const;

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function normalizeOptionList(
  raw: unknown,
  fallback: readonly string[]
): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...fallback];
  const cleaned = raw
    .map((x) => String(x).trim())
    .filter((s) => s.length > 0);
  if (cleaned.length === 0) return [...fallback];
  return dedupePreserveOrder(cleaned);
}

export function getTestCasePriorityOptions(
  project: ProjectDoc | undefined | null
): string[] {
  return normalizeOptionList(
    project?.testCasePriorityOptions,
    DEFAULT_TEST_CASE_PRIORITY_OPTIONS
  );
}

export function getTestCaseTypeOptions(
  project: ProjectDoc | undefined | null
): string[] {
  return normalizeOptionList(
    project?.testCaseTypeOptions,
    DEFAULT_TEST_CASE_TYPE_OPTIONS
  );
}

/**
 * Pick the canonical option string from `allowed`, matching case-insensitively
 * or by partial overlap; otherwise the first allowed value.
 */
export function coerceToAllowedOption(
  value: string,
  allowed: string[]
): string {
  if (allowed.length === 0) return value.trim();
  const v = value.trim();
  if (!v) return allowed[0]!;
  const lower = v.toLowerCase();
  const exact = allowed.find((a) => a.toLowerCase() === lower);
  if (exact) return exact;
  const contains = allowed.find(
    (a) =>
      lower.includes(a.toLowerCase()) || a.toLowerCase().includes(lower)
  );
  if (contains) return contains;
  return allowed[0]!;
}

/** Display label: `my_option` → My option; preserves user casing for single tokens. */
export function formatTestCaseFieldLabel(value: string): string {
  const t = value.trim();
  if (!t) return "";
  if (!t.includes("_") && !t.includes(" ")) {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return t
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
