import { create } from "zustand";

/**
 * Shared always-on crash engine.
 * One engine instance per game id (avicoins, rocketcoins, dive).
 * Runs continuously: BETTING (10s) → FLYING (until crash) → CRASHED (4s) → next round.
 * Bets are placed during BETTING; cash-out happens during FLYING.
 *
 * House edge tuned to ~5:6 win:lose ratio (≈45% of rounds reach >=2x where players
 * realistically cash out). We never expose this to the user.
 */

export type Phase = "betting" | "flying" | "crashed";

export type RoundBet = {
  stake: number;
  cashedAt: number | null; // multiplier at cashout, null if not cashed
  won: number; // coins paid out (0 if not cashed)
};

export type RoundRecord = {
  id: number;
  crashAt: number;
};

const BETTING_MS = 10_000;
const CRASHED_MS = 4_000;

// 5:6 win:lose → ~45% wins. Players who wait >=2x win on ~45% of rounds.
const generateCrashPoint = (): number => {
  const r = Math.random();
  if (r < 0.55) return 1 + Math.random() * 1.0;   // 1.00 - 2.00 (early crash → loss if waiting for 2x)
  if (r < 0.85) return 2 + Math.random() * 2.5;   // 2.00 - 4.50
  if (r < 0.97) return 4.5 + Math.random() * 4;   // 4.50 - 8.50
  return 8.5 + Math.random() * 11.5;              // 8.50 - 20.0 (rare moonshot)
};

type EngineState = {
  phase: Phase;
  roundId: number;
  startedAt: number;          // ms timestamp when current phase started
  endsAt: number;             // ms timestamp when current phase ends (betting/crashed)
  crashAt: number;            // multiplier at which current flight will crash
  multiplier: number;         // live multiplier during flying
  bet: RoundBet | null;       // user's bet for current round
  history: RoundRecord[];
  _raf: number | null;
  _timer: ReturnType<typeof setTimeout> | null;
  _started: boolean;

  start: () => void;
  stop: () => void;
  placeBet: (stake: number) => boolean;
  cashOut: () => RoundBet | null;
};

const makeEngine = () =>
  create<EngineState>((set, get) => {
    const beginBetting = () => {
      const now = Date.now();
      set({
        phase: "betting",
        roundId: get().roundId + 1,
        startedAt: now,
        endsAt: now + BETTING_MS,
        crashAt: generateCrashPoint(),
        multiplier: 1,
        bet: null,
      });
      const t = setTimeout(beginFlying, BETTING_MS);
      set({ _timer: t });
    };

    const beginFlying = () => {
      const now = Date.now();
      set({ phase: "flying", startedAt: now, endsAt: 0, multiplier: 1 });
      const tick = () => {
        const s = get();
        if (s.phase !== "flying") return;
        const elapsed = (Date.now() - s.startedAt) / 1000;
        const m = Math.pow(1.07, elapsed * 6);
        if (m >= s.crashAt) {
          const m2 = s.crashAt;
          set({
            multiplier: m2,
            phase: "crashed",
            startedAt: Date.now(),
            endsAt: Date.now() + CRASHED_MS,
            history: [{ id: s.roundId, crashAt: m2 }, ...s.history].slice(0, 10),
            _raf: null,
          });
          const t = setTimeout(beginBetting, CRASHED_MS);
          set({ _timer: t });
          return;
        }
        set({ multiplier: m });
        const raf = requestAnimationFrame(tick);
        set({ _raf: raf });
      };
      const raf = requestAnimationFrame(tick);
      set({ _raf: raf });
    };

    return {
      phase: "betting",
      roundId: 0,
      startedAt: Date.now(),
      endsAt: Date.now() + BETTING_MS,
      crashAt: 1,
      multiplier: 1,
      bet: null,
      history: [],
      _raf: null,
      _timer: null,
      _started: false,

      start: () => {
        if (get()._started) return;
        set({ _started: true });
        beginBetting();
      },

      stop: () => {
        const s = get();
        if (s._raf) cancelAnimationFrame(s._raf);
        if (s._timer) clearTimeout(s._timer);
        set({ _raf: null, _timer: null, _started: false });
      },

      placeBet: (stake) => {
        const s = get();
        if (s.phase !== "betting") return false;
        if (s.bet) return false;
        if (stake <= 0) return false;
        set({ bet: { stake, cashedAt: null, won: 0 } });
        return true;
      },

      cashOut: () => {
        const s = get();
        if (s.phase !== "flying" || !s.bet || s.bet.cashedAt !== null) return null;
        const m = s.multiplier;
        const won = Math.floor(s.bet.stake * m);
        const updated: RoundBet = { ...s.bet, cashedAt: m, won };
        set({ bet: updated });
        return updated;
      },
    };
  });

export const useAvicoinsEngine = makeEngine();
export const useRocketEngine = makeEngine();
export const useDiveEngine = makeEngine();
