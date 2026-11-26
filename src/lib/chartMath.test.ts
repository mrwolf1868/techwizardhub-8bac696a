import { describe, expect, it } from "vitest";
import { aggregate, marginFor, tradePnl } from "./chartMath";

describe("coin trade maths", () => {
  it("holds 1:100 margin: 0.10 lot at KSh 100 needs KSh 100", () => expect(marginFor(0.1, 100)).toBe(100));
  it("a buy of 1 lot gains KSh 1,000 per KSh 1 rise", () => expect(tradePnl("buy", 1, 100, 101)).toBe(1000));
  it("a sell of 0.5 lot loses KSh 250 when price rises by 0.5", () => expect(tradePnl("sell", 0.5, 100, 100.5)).toBe(-250));
  it("groups five 1-minute candles into one 5-minute candle", () => {
    const rows = [0, 60, 120, 180, 240].map((t, i) => ({ time: t, open: 10 + i, high: 20 + i, low: 5 - i, close: 11 + i }));
    expect(aggregate(rows, 300)).toEqual([{ time: 0, open: 10, high: 24, low: 1, close: 15 }]);
  });
});
