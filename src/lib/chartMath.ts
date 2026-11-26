export type Candle = { time: number; open: number; high: number; low: number; close: number };
export type Point = { time: number; value: number };

/** Group 1-minute candles into larger timeframes (tfSec seconds). Input must be sorted by time. */
export const aggregate = (rows: Candle[], tfSec: number): Candle[] => {
  if (tfSec <= 60) return rows;
  const out: Candle[] = [];
  for (const r of rows) {
    const t = Math.floor(r.time / tfSec) * tfSec;
    const last = out[out.length - 1];
    if (last && last.time === t) { last.high = Math.max(last.high, r.high); last.low = Math.min(last.low, r.low); last.close = r.close; }
    else out.push({ time: t, open: r.open, high: r.high, low: r.low, close: r.close });
  }
  return out;
};

export const sma = (rows: Candle[], n: number): Point[] => {
  const out: Point[] = []; let sum = 0;
  rows.forEach((r, i) => { sum += r.close; if (i >= n) sum -= rows[i - n].close; if (i >= n - 1) out.push({ time: r.time, value: sum / n }); });
  return out;
};

export const ema = (rows: Candle[], n: number): Point[] => {
  const k = 2 / (n + 1); const out: Point[] = []; let prev = 0;
  rows.forEach((r, i) => { prev = i === 0 ? r.close : r.close * k + prev * (1 - k); if (i >= n - 1) out.push({ time: r.time, value: prev }); });
  return out;
};

export const bollinger = (rows: Candle[], n = 20, mult = 2) => {
  const upper: Point[] = [], lower: Point[] = [];
  for (let i = n - 1; i < rows.length; i++) {
    const w = rows.slice(i - n + 1, i + 1).map((r) => r.close);
    const mean = w.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    upper.push({ time: rows[i].time, value: mean + mult * sd }); lower.push({ time: rows[i].time, value: mean - mult * sd });
  }
  return { upper, lower };
};

export const rsi = (rows: Candle[], n = 14): Point[] => {
  const out: Point[] = []; let gain = 0, loss = 0;
  for (let i = 1; i < rows.length; i++) {
    const d = rows[i].close - rows[i - 1].close;
    const g = Math.max(d, 0), l = Math.max(-d, 0);
    if (i <= n) { gain += g / n; loss += l / n; } else { gain = (gain * (n - 1) + g) / n; loss = (loss * (n - 1) + l) / n; }
    if (i >= n) out.push({ time: rows[i].time, value: loss === 0 ? 100 : 100 - 100 / (1 + gain / loss) });
  }
  return out;
};

/** Spread and contract size used by the server: 0.03% either side of the mid price, 1 lot = 1,000 coins. */
export const SPREAD = 0.0003;
export const LOT_UNITS = 1000;
export const bidAsk = (mid: number) => ({ bid: mid * (1 - SPREAD), ask: mid * (1 + SPREAD) });
/** Margin held for a trade (1:100 leverage), rounded up to whole KSh, matching the server. */
export const marginFor = (lots: number, price: number) => Math.max(1, Math.ceil((lots * LOT_UNITS * price) / 100));
/** Profit or loss in KSh for a trade at the given exit price. */
export const tradePnl = (side: "buy" | "sell", lots: number, entry: number, exit: number) =>
  Math.round((exit - entry) * (side === "buy" ? 1 : -1) * lots * LOT_UNITS);
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
