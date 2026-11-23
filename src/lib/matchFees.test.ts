import { describe, expect, it } from "vitest";
import { availableProfit, canWithdrawProfit, entryCost, entryFee, winnerPayout } from "./matchFees";

describe("match fees", () => {
  it("charges each player 5% of the stake on entry", () => {
    expect(entryFee(100)).toBe(5);
    expect(entryFee(20)).toBe(1);
  });
  it("charges the stake and fee together before a player enters", () => {
    expect(entryCost(20)).toBe(21);
  });
  it("two players together pay 10% of one stake's worth each side", () => {
    expect(entryFee(200) * 2).toBe(20);
  });
  it("winner gets both full stakes", () => {
    expect(winnerPayout(100)).toBe(200);
  });
  it("shows only fees not already withdrawn as available profit", () => {
    expect(availableProfit(50, 20)).toBe(30);
    expect(canWithdrawProfit(30, availableProfit(50, 20))).toBe(true);
    expect(canWithdrawProfit(31, availableProfit(50, 20))).toBe(false);
  });
});
