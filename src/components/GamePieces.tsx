import type { ReactNode } from "react";

/**
 * Vector pieces so both colours render identically on every device
 * (text chess symbols turn into coloured emoji on many phones).
 * Light pieces are pure cream with a black outline; dark pieces are pure black with a cream outline.
 */
type Tone = "light" | "dark";

const BODY: Record<string, ReactNode> = {
  p: <path d="M22.5 9a4.5 4.5 0 0 0-3.6 7.2A6.5 6.5 0 0 0 16 22a6.4 6.4 0 0 0 2.6 5.2C15 28.6 11.5 32.6 11.5 38h22c0-5.4-3.5-9.4-7.1-10.8A6.4 6.4 0 0 0 29 22a6.5 6.5 0 0 0-2.9-5.8A4.5 4.5 0 0 0 22.5 9z" />,
  r: (
    <>
      <path d="M9 39h27v-3H9zM12 36v-4h21v4zM11 14V9h4v2h5V9h5v2h5V9h4v5zM34 14l-3 3H14l-3-3zM31 17v12.5H14V17zM31 29.5l1.5 2.5h-20l1.5-2.5z" />
      <path className="piece-detail" d="M11 14h23" />
    </>
  ),
  n: (
    <>
      <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" />
      <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.04-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.99-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.99 2.5-3c1 0 1 3 1 3" />
      <circle className="piece-eye" cx="14.5" cy="15.5" r="1.1" />
      <path className="piece-detail" d="M9.5 25.5h.01" />
    </>
  ),
  b: (
    <>
      <path d="M9 36c3.4-1 10.1.4 13.5-2 3.4 2.4 10.1 1 13.5 2 0 0 1.6.5 3 2-.7 1-1.6 1-3 .5-3.4-1-10.1.5-13.5-1-3.4 1.5-10.1 0-13.5 1-1.4.5-2.3.5-3-.5 1.4-1.5 3-2 3-2z" />
      <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
      <circle cx="22.5" cy="8" r="2.5" />
      <path className="piece-detail" d="M17.5 26h10M15 30h15M22.5 15.5v5M20 18h5" />
    </>
  ),
  q: (
    <>
      <path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5z" />
      <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1 2.5-1 2.5-1.5 1.5 0 2.5 0 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" />
      <circle cx="6" cy="12" r="2" /><circle cx="14" cy="9" r="2" /><circle cx="22.5" cy="8" r="2" /><circle cx="31" cy="9" r="2" /><circle cx="39" cy="12" r="2" />
      <path className="piece-detail" d="M11 29a35 35 0 0 1 23 0M12.5 31.5h20M11.5 34.5a35 35 0 0 0 22 0" />
    </>
  ),
  k: (
    <>
      <path className="piece-cross" d="M22.5 11.6V6M20 8h5" />
      <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" />
      <path d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7z" />
      <path className="piece-detail" d="M12.5 30c5.5-3 14.5-3 20 0M12.5 33.5c5.5-3 14.5-3 20 0M12.5 37c5.5-3 14.5-3 20 0" />
    </>
  ),
};

const NAMES: Record<string, string> = { p: "pawn", r: "rook", n: "knight", b: "bishop", q: "queen", k: "king" };

export const ChessPiece = ({ type, color }: { type: string; color: "w" | "b" }) => {
  const tone: Tone = color === "w" ? "light" : "dark";
  return (
    <svg viewBox="0 0 45 45" className={`piece-svg chess-svg ${tone}`} role="img" aria-label={`${tone === "light" ? "Cream" : "Black"} ${NAMES[type]}`}>
      <g>{BODY[type]}</g>
    </svg>
  );
};

export const DraughtPiece = ({ color, king }: { color: "w" | "b"; king: boolean }) => {
  const tone: Tone = color === "w" ? "light" : "dark";
  return (
    <svg viewBox="0 0 40 40" className={`piece-svg draught-svg ${tone}`} role="img" aria-label={`${tone === "light" ? "Cream" : "Black"} ${king ? "king" : "piece"}`}>
      <circle cx="20" cy="21.5" r="16.5" className="draught-edge" />
      <circle cx="20" cy="19.5" r="16.5" />
      <circle cx="20" cy="19.5" r="11.5" className="piece-ring" />
      {king && <path className="piece-crown" d="M12.5 24h15l1.5-9-4.5 4-4.5-6-4.5 6-4.5-4z" />}
    </svg>
  );
};
