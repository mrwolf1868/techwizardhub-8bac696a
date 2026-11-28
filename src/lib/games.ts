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

// Browser and server share exactly the same grid-game rules.
export { tttWinner, tttPlay, C4_ROWS, C4_COLS, c4Drop, c4Winner, gridOutcome } from "../../supabase/functions/_shared/gridGames";
