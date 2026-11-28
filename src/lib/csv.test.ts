import { describe, expect, it } from "vitest";
import { csvCell } from "./csv";
describe("safe exports", () => {
  it("neutralizes formulas in every exported cell", () => {
    expect(csvCell("=2+2")).toBe('"\'=2+2"');
    expect(csvCell("  @SUM(1,2)")).toBe('"\'  @SUM(1,2)"');
    expect(csvCell("+254712345678")).toBe('"\'+254712345678"');
    expect(csvCell('normal,"text"')).toBe('"normal,""text"""');
    expect(csvCell(100)).toBe('"100"');
  });
});