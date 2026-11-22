import { describe, expect, it } from "vitest";
import { entryFee, winnerPayout } from "./matchFees";

describe("match fees", () => {
  it("charges each player 5% of the stake on entry", () => {
    expect(entryFee(100)).toBe(5);
    expect(entryFee(20)).toBe(1);
  });
  it("two players together pay 10% of one stake's worth each side", () => {
    expect(entryFee(200) * 2).toBe(20);
  });
  it("winner gets both full stakes", () => {
    expect(winnerPayout(100)).toBe(200);
  });
});
