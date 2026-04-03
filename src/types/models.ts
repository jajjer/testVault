/** App-wide role; Testers are read-only for most write operations (enforced in UI + Firestore rules). */
export type UserRole = "admin" | "test_lead" | "tester";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectMember {
  uid: string;
  email: string;
  role: UserRole;
  addedAt: number;
}

/** Optional key/value metadata for a project (e.g. environment, release, owner team). */
export interface ProjectParameter {
  key: string;
  value: string;
}

export interface ProjectDoc {
  id: string;
  name: string;
  description: string;
  parameters: ProjectParameter[];
  /**
   * Next case number to assign (TestRail-style C1, C2…). Updated atomically when
   * creating a test case. Omitted on older projects until first case is created.
   */
  nextCaseNumber?: number;
  /**
   * Next run-test label (T1, T2…) to assign **project-wide** — unique across all test
   * runs in this project. Updated atomically when adding cases to a run.
   */
  nextRunTestNumber?: number;
  /** Denormalized for `array-contains` queries. */
  memberIds: string[];
  members: ProjectMember[];
  /**
   * Allowed priority values for test cases in this project (stored as the string
   * saved on each case). When omitted, the app uses built-in defaults.
   */
  testCasePriorityOptions?: string[];
  /**
   * Allowed type values for test cases in this project. When omitted, the app
   * uses built-in defaults.
   */
  testCaseTypeOptions?: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface SuiteDoc {
  id: string;
  projectId: string;
  name: string;
  description: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface SectionDoc {
  id: string;
  projectId: string;
  suiteId: string;
  parentSectionId: string | null;
  name: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Stored value for test case priority — should match an entry from the project's
 * `testCasePriorityOptions` (or built-in defaults).
 */
export type TestCasePriority = string;

/**
 * Stored value for test case type — should match an entry from the project's
 * `testCaseTypeOptions` (or built-in defaults).
 */
export type TestCaseType = string;

export type TestCaseStatus = "active" | "draft" | "deprecated";

export interface TestCaseStep {
  step: string;
  expectedResult: string;
}

export type CustomFieldValue = string | number | boolean | null;

export interface TestCaseDoc {
  id: string;
  projectId: string;
  /** Project-scoped human id, shown as C{caseNumber} (e.g. C1, C42). */
  caseNumber: number;
  suiteId: string;
  sectionId: string;
  title: string;
  preconditions: string;
  steps: TestCaseStep[];
  priority: TestCasePriority;
  type: TestCaseType;
  status: TestCaseStatus;
  customFields: Record<string, CustomFieldValue>;
  order: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export type RunStatus = "active" | "completed" | "archived";

export interface TestRunDoc {
  id: string;
  projectId: string;
  name: string;
  suiteId: string;
  /** Test case IDs included in this run (snapshot of selection). */
  caseIds: string[];
  /**
   * Maps case id → **project-unique** T number (shared counter on the project).
   * A given T value appears at most once across all runs in the project.
   */
  runTestNumbers?: Record<string, number>;
  status: RunStatus;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export type TestResultOutcome =
  | "passed"
  | "failed"
  | "blocked"
  | "skipped"
  | "retest";

export interface TestResultAttachment {
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: number;
}

export interface TestResultDoc {
  caseId: string;
  runId: string;
  projectId: string;
  outcome: TestResultOutcome | null;
  comment: string;
  attachments: TestResultAttachment[];
  executedBy: string | null;
  executedAt: number | null;
  updatedAt: number;
}
