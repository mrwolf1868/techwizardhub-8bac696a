import { applyMove, legalMoves, type Side } from "./draughts.ts";
import { c4Drop, gridOutcome, tttPlay } from "./gridGames.ts";

type ChessBoard = {
  moves(options: { verbose: true }): { from: string; to: string; promotion?: string }[];
  move(move: { from: string; to: string; promotion?: string }): unknown;
  fen(): string; isCheckmate(): boolean; isDraw(): boolean;
};
export function validateGameMove(game: string, previous: string, next: string, side: Side, makeChess: (fen: string) => ChessBoard): "win" | "draw" | "" {
  if (game === "chess") {
    const board = makeChess(previous);
    for (const move of board.moves({ verbose: true })) {
      const candidate = makeChess(previous);
      candidate.move(move);
      if (candidate.fen() === next) return candidate.isCheckmate() ? "win" : candidate.isDraw() ? "draw" : "";
    }
  } else if (game === "draughts" && /^[.wbWB]{64}$/.test(previous) && /^[.wbWB]{64}$/.test(next)) {
    const legal = legalMoves(previous, side).some((move) => applyMove(previous, move) === next);
    if (legal) return legalMoves(next, side === "w" ? "b" : "w").length === 0 ? "win" : "";
  } else if (game === "tictactoe" && /^[.wb]{9}$/.test(previous)) {
    for (let i = 0; i < 9; i++) if (tttPlay(previous, i, side) === next) return gridOutcome("tictactoe", next);
  } else if (game === "connect4" && /^[.wb]{42}$/.test(previous)) {
    for (let i = 0; i < 7; i++) if (c4Drop(previous, i, side) === next) return gridOutcome("connect4", next);
  }
  throw new Error("Illegal move");
}
