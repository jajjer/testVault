import { describe, expect, it } from "vitest";

import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted commas and escapes", () => {
    expect(parseCsv('"a,b",c\n"d""e",f')).toEqual([
      ["a,b", "c"],
      ['d"e', "f"],
    ]);
  });

  it("handles CRLF", () => {
    expect(parseCsv("x,y\r\np,q")).toEqual([
      ["x", "y"],
      ["p", "q"],
    ]);
  });
});
