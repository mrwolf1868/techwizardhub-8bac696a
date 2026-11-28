// 8x8 draughts. Board string of 64 chars: '.' empty, w/b man, W/B king. White (creator) moves up.
export type Side = "w" | "b";
export const initialDraughts = () => {
  let s = "";
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const dark = (r + c) % 2 === 1;
    s += dark && r < 3 ? "b" : dark && r > 4 ? "w" : ".";
  }
  return s;
};
export type Move = { from: number; path: number[]; captures: number[] };
const own = (p: string, side: Side) => p.toLowerCase() === side;
function dirs(p: string) {
  if (p === "W" || p === "B") return [[-1,-1],[-1,1],[1,-1],[1,1]];
  return p === "w" ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
}
function jumps(b: string[], from: number, piece: string, side: Side, cur: number, caps: number[], path: number[], out: Move[]) {
  let found = false;
  const r = Math.floor(cur / 8), c = cur % 8;
  for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    if (!dirs(piece).some(([a, d]) => a === dr && d === dc)) continue;
    const mr = r + dr, mc = c + dc, tr = r + 2*dr, tc = c + 2*dc;
    if (tr < 0 || tr > 7 || tc < 0 || tc > 7) continue;
    const mid = mr*8+mc, to = tr*8+tc;
    if (b[mid] !== "." && !own(b[mid], side) && !caps.includes(mid) && (b[to] === "." || to === from)) {
      found = true;
      jumps(b, from, piece, side, to, [...caps, mid], [...path, to], out);
    }
  }
  if (!found && caps.length) out.push({ from, path, captures: caps });
}
export function legalMoves(board: string, side: Side): Move[] {
  const b = board.split(""); const caps: Move[] = []; const simple: Move[] = [];
  b.forEach((p, i) => {
    if (p === "." || !own(p, side)) return;
    jumps(b, i, p, side, i, [], [], caps);
    const r = Math.floor(i/8), c = i%8;
    for (const [dr, dc] of dirs(p)) {
      const tr=r+dr, tc=c+dc;
      if (tr>=0&&tr<8&&tc>=0&&tc<8&&b[tr*8+tc]===".") simple.push({ from: i, path: [tr*8+tc], captures: [] });
    }
  });
  return caps.length ? caps : simple; // captures are mandatory
}
export function applyMove(board: string, m: Move): string {
  const b = board.split(""); const p = b[m.from]; b[m.from] = ".";
  m.captures.forEach((i) => (b[i] = "."));
  const to = m.path[m.path.length-1]; const row = Math.floor(to/8);
  b[to] = p === "w" && row === 0 ? "W" : p === "b" && row === 7 ? "B" : p;
  return b.join("");
}
