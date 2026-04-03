import { parseCsv } from "@/lib/csv";
import type {
  CustomFieldValue,
  TestCasePriority,
  TestCaseStatus,
  TestCaseStep,
  TestCaseType,
} from "@/types/models";

export interface ParsedTestRailRow {
  title: string;
  sectionPath: string[];
  preconditions: string;
  steps: TestCaseStep[];
  priority: TestCasePriority;
  type: TestCaseType;
  status: TestCaseStatus;
  customFields: Record<string, CustomFieldValue>;
}

export interface ParseTestRailCsvResult {
  rows: ParsedTestRailRow[];
  /** Rows skipped (e.g. empty title). */
  skipped: number;
  /** Non-fatal issues (unknown headers, etc.). */
  warnings: string[];
}

function normHeader(h: string): string {
  return h.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Split TestRail section path: "A > B > C", "A/B/C", etc. */
export function splitSectionPath(section: string): string[] {
  const t = section.trim();
  if (!t) return [];
  return t
    .split(/\s*[>\\/]+\s*|\s*::\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function findColumnIndex(
  headers: string[],
  candidates: string[]
): number {
  const normalized = headers.map(normHeader);
  for (const c of candidates) {
    const want = normHeader(c);
    const i = normalized.indexOf(want);
    if (i >= 0) return i;
  }
  return -1;
}

/** Indices of columns whose header is exactly `Steps` (TestRail often repeats this for step 1, step 2, …). */
function bareStepsColumnIndices(headers: string[]): number[] {
  const normalized = headers.map(normHeader);
  const out: number[] = [];
  normalized.forEach((h, i) => {
    if (h === "steps") out.push(i);
  });
  return out;
}

/**
 * Resolves step + expected text. Prefers TestRail’s `Steps (Step)` / `Steps (Expected Result)`,
 * then concatenates duplicate `Steps` columns with newlines, then case-level Expected Result.
 */
function resolveStepsAndExpected(
  headerRow: string[],
  cells: string[]
): { stepsRaw: string; expectedRaw: string } {
  const stepSpecificIx = findColumnIndex(headerRow, [
    "steps (step)",
    "steps (separated)",
  ]);
  const bareSteps = bareStepsColumnIndices(headerRow);

  let stepsRaw = "";
  if (stepSpecificIx >= 0) {
    stepsRaw = (cells[stepSpecificIx] ?? "").trim();
  } else if (bareSteps.length > 0) {
    stepsRaw = bareSteps
      .map((i) => (cells[i] ?? "").trim())
      .filter(Boolean)
      .join("\n");
  } else {
    const fallback = findColumnIndex(headerRow, [
      "test steps",
      "steps (text)",
      "step",
    ]);
    if (fallback >= 0) stepsRaw = (cells[fallback] ?? "").trim();
  }

  const expectedIx = findColumnIndex(headerRow, [
    "steps (expected result)",
    "expected result",
    "expected results",
  ]);
  const expectedRaw =
    expectedIx >= 0 ? (cells[expectedIx] ?? "").trim() : "";

  return { stepsRaw, expectedRaw };
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d+[.)\s]+\s*/, "").trim())
    .filter((l) => l.length > 0);
}

function linesToSteps(stepsRaw: string, expectedRaw: string): TestCaseStep[] {
  const stepLines = splitLines(stepsRaw);
  const expLines = splitLines(expectedRaw);
  const n = Math.max(stepLines.length, expLines.length);
  if (n === 0) return [];
  const out: TestCaseStep[] = [];
  for (let i = 0; i < n; i += 1) {
    const step = stepLines[i] ?? "";
    const expectedResult = expLines[i] ?? "";
    out.push({ step, expectedResult });
  }
  return out;
}

function mapPriority(raw: string): TestCasePriority {
  const s = raw.trim().toLowerCase();
  if (!s) return "medium";
  if (s.includes("critical")) return "critical";
  if (s.includes("high")) return "high";
  if (s.includes("low")) return "low";
  if (s.includes("medium")) return "medium";
  return "medium";
}

function mapType(raw: string): TestCaseType {
  const s = raw.trim().toLowerCase();
  if (!s) return "functional";
  const direct: Record<string, TestCaseType> = {
    functional: "functional",
    regression: "regression",
    smoke: "smoke",
    integration: "integration",
    ui: "ui",
    "user interface": "ui",
    api: "api",
    security: "security",
    performance: "performance",
    other: "other",
    acceptance: "functional",
    usability: "ui",
    exploratory: "other",
    automated: "other",
  };
  if (direct[s]) return direct[s];
  if (s.includes("api")) return "api";
  if (s.includes("regression")) return "regression";
  if (s.includes("smoke")) return "smoke";
  if (s.includes("integration")) return "integration";
  if (s.includes("security")) return "security";
  if (s.includes("performance")) return "performance";
  if (s.includes("ui") || s.includes("interface")) return "ui";
  if (s.includes("manual")) return "functional";
  if (s.includes("selenium")) return "other";
  return "other";
}

function mapStatus(raw: string): TestCaseStatus {
  const s = raw.trim().toLowerCase();
  if (!s) return "active";
  if (s.includes("deprecated")) return "deprecated";
  if (s.includes("draft")) return "draft";
  return "active";
}

/**
 * Parse TestRail CSV exports. We only rely on a small set of columns (others are ignored):
 * **Title** (required), **ID**, **Section** or **Section Hierarchy**, **Preconditions**,
 * **Priority**, **Type**, **Steps (Step)** + **Steps (Expected Result)** or duplicate **Steps** columns,
 * and case-level **Expected Result** when present.
 */
export function parseTestRailCsv(text: string): ParseTestRailCsvResult {
  const warnings: string[] = [];
  const grid = parseCsv(text.trim());
  if (grid.length < 2) {
    throw new Error(
      "CSV must include a header row and at least one data row."
    );
  }

  const headerRow = grid[0]!.map((h) => h.replace(/^\uFEFF/, "").trim());
  const titleIx = findColumnIndex(headerRow, ["title", "test case"]);
  if (titleIx < 0) {
    throw new Error(
      'No "Title" column found. Export test cases from TestRail with Title included.'
    );
  }

  const sectionHierarchyIx = findColumnIndex(headerRow, [
    "section hierarchy",
  ]);
  const sectionIx = findColumnIndex(headerRow, [
    "section",
    "suite section",
    "folder",
  ]);
  const preIx = findColumnIndex(headerRow, [
    "preconditions",
    "precondition",
  ]);
  const priIx = findColumnIndex(headerRow, ["priority"]);
  const typeIx = findColumnIndex(headerRow, ["type", "case type"]);
  const statusIx = findColumnIndex(headerRow, ["status"]);
  const idIx = findColumnIndex(headerRow, [
    "id",
    "case id",
    "case_id",
    "test case id",
  ]);

  const hasSection = sectionIx >= 0 || sectionHierarchyIx >= 0;
  if (!hasSection) {
    warnings.push(
      "No Section column — cases will be placed in the default folder."
    );
  }

  const rows: ParsedTestRailRow[] = [];
  let skipped = 0;

  for (let r = 1; r < grid.length; r += 1) {
    const cells = grid[r] ?? [];
    const title = (cells[titleIx] ?? "").trim();
    if (!title) {
      skipped += 1;
      continue;
    }

    const hierarchy =
      sectionHierarchyIx >= 0
        ? (cells[sectionHierarchyIx] ?? "").trim()
        : "";
    const sectionOnly =
      sectionIx >= 0 ? (cells[sectionIx] ?? "").trim() : "";
    const sectionRaw = hierarchy || sectionOnly;
    const sectionPath = splitSectionPath(sectionRaw);

    const preconditions = preIx >= 0 ? (cells[preIx] ?? "").trim() : "";
    const { stepsRaw, expectedRaw } = resolveStepsAndExpected(
      headerRow,
      cells
    );
    const steps = linesToSteps(stepsRaw, expectedRaw);

    const priority =
      priIx >= 0 ? mapPriority(cells[priIx] ?? "") : ("medium" as const);
    const type = typeIx >= 0 ? mapType(cells[typeIx] ?? "") : ("functional" as const);
    const status =
      statusIx >= 0 ? mapStatus(cells[statusIx] ?? "") : ("active" as const);

    const customFields: Record<string, CustomFieldValue> = {};
    if (idIx >= 0) {
      const trId = (cells[idIx] ?? "").trim();
      if (trId) customFields.testrailCaseId = trId;
    }

    rows.push({
      title,
      sectionPath,
      preconditions,
      steps,
      priority,
      type,
      status,
      customFields,
    });
  }

  return { rows, skipped, warnings };
}
