import { describe, expect, it } from "vitest";

import { parseTestRailCsv, splitSectionPath } from "@/lib/testrail-csv";

describe("splitSectionPath", () => {
  it("splits on > and slashes", () => {
    expect(splitSectionPath("Auth > Login")).toEqual(["Auth", "Login"]);
    expect(splitSectionPath("Auth/Login")).toEqual(["Auth", "Login"]);
    expect(splitSectionPath("")).toEqual([]);
  });
});

describe("parseTestRailCsv", () => {
  it("parses a minimal TestRail-style export", () => {
    const csv = [
      "Title,Section,Preconditions,Priority,Type,Steps,Expected Result",
      "Login works,Auth > Login,App is open,High,Functional,Step one,Expect one",
    ].join("\n");

    const { rows, skipped, warnings } = parseTestRailCsv(csv);
    expect(skipped).toBe(0);
    expect(warnings.length).toBeGreaterThanOrEqual(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe("Login works");
    expect(rows[0]!.sectionPath).toEqual(["Auth", "Login"]);
    expect(rows[0]!.preconditions).toBe("App is open");
    expect(rows[0]!.priority).toBe("high");
    expect(rows[0]!.type).toBe("functional");
    expect(rows[0]!.steps).toEqual([
      { step: "Step one", expectedResult: "Expect one" },
    ]);
  });

  it("throws without a Title column", () => {
    expect(() => parseTestRailCsv("Foo,Bar\n1,2")).toThrow(/Title/);
  });

  it("skips empty title rows", () => {
    const csv = "Title,Steps\nHello,\n,\nWorld,\n";
    const { rows, skipped } = parseTestRailCsv(csv);
    expect(rows.map((r) => r.title)).toEqual(["Hello", "World"]);
    expect(skipped).toBe(1);
  });

  it("parses wide TestRail export with duplicate Steps and Section Hierarchy", () => {
    const csv = [
      'ID,Title,Section,Section Hierarchy,Priority,Type,Steps,Steps,Steps (Expected Result)',
      'C1,"GET /foo",Legacy,"API > Jobs",Hotfix,API,,,""',
      'C2,"POST /bar",,API,,Manual,"Do thing",,"Expect thing"',
    ].join("\n");
    const { rows, skipped } = parseTestRailCsv(csv);
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.sectionPath).toEqual(["API", "Jobs"]);
    expect(rows[0]!.customFields.testrailCaseId).toBe("C1");
    expect(rows[1]!.steps).toEqual([
      { step: "Do thing", expectedResult: "Expect thing" },
    ]);
  });
});
