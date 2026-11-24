import { describe, expect, it } from "vitest";
import { c4Drop, c4Winner, gridOutcome, initialGameState, tttPlay, tttWinner } from "./games";

describe("tic-tac-toe", () => {
  it("detects a completed row as a win", () => {
    expect(tttWinner("www.b.b..")).toBe("w");
    expect(gridOutcome("tictactoe", "www.b.b..")).toBe("win");
  });
  it("refuses a move on an occupied cell", () => {
    expect(tttPlay("w........", 0, "b")).toBeNull();
  });
  it("reports a full board with no line as a draw", () => {
    expect(gridOutcome("tictactoe", "wbwwbbbwb")).toBe("draw");
  });
});

describe("connect four", () => {
  it("drops a disc to the lowest empty row", () => {
    const next = c4Drop(initialGameState("connect4"), 3, "w")!;
    expect(next.indexOf("w")).toBe(5 * 7 + 3);
  });
  it("detects four in a column", () => {
    let s = initialGameState("connect4");
    for (let k = 0; k < 4; k++) s = c4Drop(s, 0, "b")!;
    expect(c4Winner(s)).toBe("b");
  });
  it("refuses a drop into a full column", () => {
    let s = initialGameState("connect4");
    for (let k = 0; k < 6; k++) s = c4Drop(s, 2, k % 2 ? "w" : "b")!;
    expect(c4Drop(s, 2, "w")).toBeNull();
  });
});
