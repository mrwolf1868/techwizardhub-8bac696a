import { Chess } from "chess.js";
import { initialDraughts } from "./draughts";

export type GameId = "chess" | "draughts" | "tictactoe" | "connect4" | "quiz";
/** Games the AI rules helper explains. */
export type RulesGame = Exclude<GameId, "quiz">;
export const hasRulesHelper = (id: string): id is RulesGame => ["chess", "draughts", "tictactoe", "connect4"].includes(id);
export type Seat = "w" | "b"; // w = match creator (cream, moves first), b = opponent (black)

export const GAME_IDS: GameId[] = ["chess", "draughts", "tictactoe", "connect4", "quiz"];
export const isGameId = (value: string | undefined): value is GameId => !!value && (GAME_IDS as string[]).includes(value);

const NAMES = { chess: "Chess", draughts: "Draughts", tictactoe: "Tic-Tac-Toe", connect4: "Connect Four", quiz: "Math Quiz", cointrade: "Coin Trade" } as Record<string, string>;
export const gameName = (id: string) => NAMES[id] ?? id;

export const initialGameState = (game: GameId) =>
  game === "quiz" ? "{}" : game === "chess" ? new Chess().fen() : game === "draughts" ? initialDraughts() : game === "tictactoe" ? ".".repeat(9) : ".".repeat(42);

/* ---------- Tic-Tac-Toe: 9 cells, "." empty ---------- */
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export const tttWinner = (s: string): Seat | null => {
  for (const [a, b, c] of LINES) if (s[a] !== "." && s[a] === s[b] && s[a] === s[c]) return s[a] as Seat;
  return null;
};
export const tttPlay = (s: string, cell: number, seat: Seat): string | null => {
  if (cell < 0 || cell > 8 || s[cell] !== "." || tttWinner(s)) return null;
  return s.slice(0, cell) + seat + s.slice(cell + 1);
};

/* ---------- Connect Four: 6 rows x 7 columns, row 0 on top ---------- */
export const C4_ROWS = 6;
export const C4_COLS = 7;
export const c4Drop = (s: string, col: number, seat: Seat): string | null => {
  if (col < 0 || col >= C4_COLS || c4Winner(s)) return null;
  for (let r = C4_ROWS - 1; r >= 0; r--) {
    const i = r * C4_COLS + col;
    if (s[i] === ".") return s.slice(0, i) + seat + s.slice(i + 1);
  }
  return null;
};
export const c4Winner = (s: string): Seat | null => {
  const at = (r: number, c: number) => (r >= 0 && r < C4_ROWS && c >= 0 && c < C4_COLS ? s[r * C4_COLS + c] : "");
  for (let r = 0; r < C4_ROWS; r++) for (let c = 0; c < C4_COLS; c++) {
    const p = at(r, c);
    if (p === "." || p === "") continue;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      if ([1, 2, 3].every((k) => at(r + dr * k, c + dc * k) === p)) return p as Seat;
    }
  }
  return null;
};

/** Result to report after a move in the simple grid games: the mover wins, the board fills (draw), or play goes on. */
export const gridOutcome = (game: "tictactoe" | "connect4", next: string): "win" | "draw" | "" => {
  const winner = game === "tictactoe" ? tttWinner(next) : c4Winner(next);
  if (winner) return "win";
  return next.includes(".") ? "" : "draw";
};
