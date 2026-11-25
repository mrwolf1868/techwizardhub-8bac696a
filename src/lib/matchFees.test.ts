import { describe, expect, it } from "vitest";
import { availableProfit, canWithdrawProfit, entryCost, entryFee, winnerPayout, withdrawalFee, withdrawalTotal } from "./matchFees";

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
  it("charges 2% on withdrawals, rounded up", () => {
    expect(withdrawalFee(100)).toBe(2);
    expect(withdrawalFee(10)).toBe(1);
    expect(withdrawalTotal(500)).toBe(510);
  });
  it("charges the admin no withdrawal fee", () => {
    expect(withdrawalFee(500, true)).toBe(0);
    expect(withdrawalTotal(500, true)).toBe(500);
  });
});
