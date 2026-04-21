import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Shared always-on crash engine.
 * One engine instance per game id (avicoins, rocketcoins, dive).
 * Runs continuously: BETTING (10s) → FLYING (until crash) → CRASHED (4s) → next round.
 *
 * Multiplier growth tuned to Aviator pace: ~1.06× per second early,
 * accelerating slowly. Most rounds last 3-15s.
 *
 * History (last 20 crashes) is persisted to localStorage so users see
 * recent results even after closing the tab for hours.
 */

export type Phase = "betting" | "flying" | "crashed";

export type RoundBet = {
  stake: number;
  cashedAt: number | null;
  won: number;
};

export type RoundRecord = {
  id: number;
  crashAt: number;
  at: number; // timestamp
};

const BETTING_MS = 10_000;
const CRASHED_MS = 4_000;

// 5:6 win:lose → ~45% wins.
const generateCrashPoint = (): number => {
  const r = Math.random();
  if (r < 0.55) return 1 + Math.random() * 1.0;
  if (r < 0.85) return 2 + Math.random() * 2.5;
  if (r < 0.97) return 4.5 + Math.random() * 4;
  return 8.5 + Math.random() * 11.5;
};

// Aviator-like pacing: starts at 1.00× and grows ~6%/s, accelerating gently.
// elapsed in seconds → multiplier
const multiplierAt = (elapsedSec: number): number => {
  return Math.pow(1.06, elapsedSec) + 0.03 * elapsedSec;
};

type EngineState = {
  phase: Phase;
  roundId: number;
  startedAt: number;
  endsAt: number;
  crashAt: number;
  multiplier: number;
  bet: RoundBet | null;
  history: RoundRecord[];
  _raf: number | null;
  _timer: ReturnType<typeof setTimeout> | null;
  _started: boolean;

  start: () => void;
  stop: () => void;
  placeBet: (stake: number) => boolean;
  cashOut: () => RoundBet | null;
};

const makeEngine = (storeName: string) =>
  create<EngineState>()(
    persist(
      (set, get) => {
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
            const m = multiplierAt(elapsed);
            if (m >= s.crashAt) {
              const m2 = s.crashAt;
              set({
                multiplier: m2,
                phase: "crashed",
                startedAt: Date.now(),
                endsAt: Date.now() + CRASHED_MS,
                history: [
                  { id: s.roundId, crashAt: m2, at: Date.now() },
                  ...s.history,
                ].slice(0, 20),
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
      },
      {
        name: storeName,
        storage: createJSONStorage(() => localStorage),
        // Only persist history + roundId so the live round doesn't get frozen
        partialize: (s) => ({ history: s.history, roundId: s.roundId }),
      }
    )
  );

export const useAvicoinsEngine = makeEngine("crash-engine-avicoins");
export const useRocketEngine = makeEngine("crash-engine-rocketcoins");
export const useDiveEngine = makeEngine("crash-engine-dive");
