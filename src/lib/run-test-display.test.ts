import { describe, expect, it } from "vitest";

import { formatRunTestRef } from "@/lib/run-test-display";

describe("formatRunTestRef", () => {
  it("formats valid T numbers", () => {
    expect(formatRunTestRef(1)).toBe("T1");
    expect(formatRunTestRef(42)).toBe("T42");
  });

  it("returns em dash for invalid", () => {
    expect(formatRunTestRef(0)).toBe("—");
    expect(formatRunTestRef(-1)).toBe("—");
  });
});
