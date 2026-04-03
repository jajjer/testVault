import { describe, expect, it } from "vitest";

import {
  coerceToAllowedOption,
  formatTestCaseFieldLabel,
  getTestCasePriorityOptions,
} from "@/lib/test-case-field-options";
import type { ProjectDoc } from "@/types/models";

describe("getTestCasePriorityOptions", () => {
  it("uses defaults when project has no custom list", () => {
    expect(getTestCasePriorityOptions(undefined)).toContain("medium");
  });

  it("uses project list when set", () => {
    const p = {
      testCasePriorityOptions: ["P0", "P1"],
    } as ProjectDoc;
    expect(getTestCasePriorityOptions(p)).toEqual(["P0", "P1"]);
  });
});

describe("coerceToAllowedOption", () => {
  it("matches case-insensitively", () => {
    expect(coerceToAllowedOption("HIGH", ["low", "High"])).toBe("High");
  });

  it("falls back to first allowed", () => {
    expect(coerceToAllowedOption("nope", ["a", "b"])).toBe("a");
  });
});

describe("formatTestCaseFieldLabel", () => {
  it("title-cases snake and space separators", () => {
    expect(formatTestCaseFieldLabel("my_custom_type")).toBe("My Custom Type");
  });
});
