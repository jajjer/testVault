import { describe, expect, it } from "vitest";

import {
  allocateRunTestNumbersFromProjectCounter,
  getRunTestNumberForCase,
} from "@/lib/run-test-numbers";
import type { TestRunDoc } from "@/types/models";

describe("allocateRunTestNumbersFromProjectCounter", () => {
  it("assigns T from project counter for a new run (no previous cases)", () => {
    const { runTestNumbers, nextProjectRunTestNumber } =
      allocateRunTestNumbersFromProjectCounter(["a", "b", "c"], [], undefined, 1);
    expect(runTestNumbers).toEqual({ a: 1, b: 2, c: 3 });
    expect(nextProjectRunTestNumber).toBe(4);
  });

  it("preserves existing T numbers when case list unchanged", () => {
    const { runTestNumbers, nextProjectRunTestNumber } =
      allocateRunTestNumbersFromProjectCounter(
        ["a", "b"],
        ["a", "b"],
        { a: 1, b: 5 },
        10
      );
    expect(runTestNumbers).toEqual({ a: 1, b: 5 });
    expect(nextProjectRunTestNumber).toBe(10);
  });

  it("keeps T for cases that stayed; does not reuse T for removed cases", () => {
    const { runTestNumbers, nextProjectRunTestNumber } =
      allocateRunTestNumbersFromProjectCounter(
        ["a", "c"],
        ["a", "b", "c"],
        { a: 1, b: 2, c: 3 },
        4
      );
    expect(runTestNumbers.a).toBe(1);
    expect(runTestNumbers.c).toBe(3);
    expect(nextProjectRunTestNumber).toBe(4);
  });

  it("allocates next project T only for brand-new cases in the run", () => {
    const { runTestNumbers, nextProjectRunTestNumber } =
      allocateRunTestNumbersFromProjectCounter(
        ["a", "b", "new"],
        ["a", "b"],
        { a: 1, b: 2 },
        3
      );
    expect(runTestNumbers.new).toBe(3);
    expect(nextProjectRunTestNumber).toBe(4);
  });
});

describe("getRunTestNumberForCase", () => {
  it("reads from runTestNumbers when present", () => {
    const run = {
      id: "r1",
      caseIds: ["x"],
      runTestNumbers: { x: 7 },
    } as unknown as TestRunDoc;
    expect(getRunTestNumberForCase(run, "x")).toBe(7);
  });

  it("falls back to caseIds order", () => {
    const run = {
      id: "r1",
      caseIds: ["a", "b"],
    } as unknown as TestRunDoc;
    expect(getRunTestNumberForCase(run, "b")).toBe(2);
  });
});
