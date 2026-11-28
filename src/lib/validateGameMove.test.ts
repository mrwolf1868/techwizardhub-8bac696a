import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { validateGameMove } from "../../supabase/functions/_shared/validateGameMove";
import { initialDraughts, applyMove, legalMoves } from "./draughts";
const makeChess = (fen: string) => new Chess(fen);
describe("server-verified board moves", () => {
  it("rejects a forged chess board and derives results from a legal move", () => {
    const board = new Chess();
    const previous = board.fen();
    board.move("e4");
    expect(validateGameMove("chess", previous, board.fen(), "w", makeChess)).toBe("");
    expect(() => validateGameMove("chess", previous, "8/8/8/8/8/8/4K3/7k b - - 0 1", "w", makeChess)).toThrow("Illegal move");
  });
  it("rejects deleting opposing draughts pieces", () => {
    const previous = initialDraughts();
    const move = legalMoves(previous, "w")[0];
    if (!move) throw new Error("Expected a starting move");
    expect(validateGameMove("draughts", previous, applyMove(previous, move), "w", makeChess)).toBe("");
    expect(() => validateGameMove("draughts", previous, previous.replace(/b/g, "."), "w", makeChess)).toThrow("Illegal move");
  });
  it("accepts exactly one legal Tic-Tac-Toe move, not a fabricated win", () => {
    expect(validateGameMove("tictactoe", ".........", "w........", "w", makeChess)).toBe("");
    expect(() => validateGameMove("tictactoe", ".........", "www......", "w", makeChess)).toThrow("Illegal move");
  });
  it("enforces gravity in Connect Four", () => {
    expect(validateGameMove("connect4", ".".repeat(42), ".".repeat(35) + "w......", "w", makeChess)).toBe("");
    expect(() => validateGameMove("connect4", ".".repeat(42), "w" + ".".repeat(41), "w", makeChess)).toThrow("Illegal move");
  });
});