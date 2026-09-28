import { describe, it, expect } from "vitest";
import { categorize } from "../src/utils/categorize.js";

describe("categorize", () => {
  it("matches known merchant keywords case-insensitively", () => {
    expect(categorize("UBER TRIP 442")).toBe("Transport");
    expect(categorize("walmart supercenter")).toBe("Groceries");
  });

  it("falls back to Other for unknown descriptions", () => {
    expect(categorize("Acme Consulting Invoice")).toBe("Other");
  });
});
