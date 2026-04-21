import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/store/userStore";
import { toast } from "sonner";
import type { UseBoundStore, StoreApi } from "zustand";
import type { Phase, RoundBet, RoundRecord } from "@/store/crashEngine";

type EngineStore = UseBoundStore<
  StoreApi<{
    phase: Phase;
    roundId: number;
    startedAt: number;
    endsAt: number;
    multiplier: number;
    bet: RoundBet | null;
    history: RoundRecord[];
    start: () => void;
    stop: () => void;
    placeBet: (stake: number) => boolean;
    cashOut: () => RoundBet | null;
  }>
>;

type Props = {
  /** Display name, e.g. "Avicoins" */
  name: string;
  /** Coin transaction tag for stakes/wins */
  txTag: string;
  /** Engine hook (one per game) */
  useEngine: EngineStore;
  /** Vehicle renderer: receives current multiplier, phase and gives back the moving element */
  renderVehicle: (args: { multiplier: number; phase: Phase }) => React.ReactNode;
  /** Background scene (grid, stars, water…) */
  renderBackground: () => React.ReactNode;
  /** Theme accent color css var, e.g. "var(--primary)" */
  accent: string;
};

export const CrashGame = ({
  name,
  txTag,
  useEngine,
  renderVehicle,
  renderBackground,
  accent,
}: Props) => {
  const { coins, spendCoins, addCoins, recordGame } = useUserStore();
  const phase = useEngine((s) => s.phase);
  const multiplier = useEngine((s) => s.multiplier);
  const endsAt = useEngine((s) => s.endsAt);
  const bet = useEngine((s) => s.bet);
  const history = useEngine((s) => s.history);
  const start = useEngine((s) => s.start);
  const placeBet = useEngine((s) => s.placeBet);
  const cashOut = useEngine((s) => s.cashOut);

  const [stake, setStake] = useState(10);
  const [countdown, setCountdown] = useState(0);
  const [didAutoCredit, setDidAutoCredit] = useState<number | null>(null);

  // Start the engine (idempotent)
  useEffect(() => {
    start();
  }, [start]);

  // Tick countdown for betting phase
  useEffect(() => {
    if (phase !== "betting") return;
    const i = setInterval(() => {
      setCountdown(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 100);
    return () => clearInterval(i);
  }, [phase, endsAt]);

  // When round crashes, settle: if user had a bet and didn't cash out → it's already lost (no payout)
  useEffect(() => {
    if (phase === "crashed" && bet && bet.cashedAt === null && didAutoCredit !== null) {
      // already lost; nothing to refund
    }
  }, [phase, bet, didAutoCredit]);

  // Reset per-round flag at new betting phase
  useEffect(() => {
    if (phase === "betting") setDidAutoCredit(null);
  }, [phase]);

  const onPlaceBet = () => {
    if (phase !== "betting") {
      toast.error("Wait for next round");
      return;
    }
    if (stake <= 0 || stake > coins) {
      toast.error("Invalid stake");
      return;
    }
    if (!spendCoins(stake, "game_loss", `${txTag} stake (${stake})`)) {
      toast.error("Insufficient coins");
      return;
    }
    const ok = placeBet(stake);
    if (!ok) {
      // refund if rejected
      addCoins(stake, "game_win", `${txTag} refund`);
      toast.error("Could not place bet");
      return;
    }
    recordGame();
    toast.success(`Bet placed: ${stake} coins`);
  };

  const onCashOut = () => {
    const r = cashOut();
    if (!r) return;
    addCoins(r.won, "game_win", `${txTag} cashout @ ${r.cashedAt!.toFixed(2)}x`);
    setDidAutoCredit(r.won);
    toast.success(`💰 Cashed out ${r.won} coins @ ${r.cashedAt!.toFixed(2)}×`);
  };

  const isFlying = phase === "flying";
  const isCrashed = phase === "crashed";
  const isBetting = phase === "betting";
  const hasBet = !!bet;
  const cashedOut = !!bet?.cashedAt;

  const multiplierColor = isCrashed
    ? "text-lose"
    : cashedOut
    ? "text-win"
    : "text-gradient-primary";

  return (
    <>
      <Card
        className="relative h-72 overflow-hidden border-primary/30 bg-gradient-card shadow-card"
        style={{ borderColor: `hsl(${accent} / 0.3)` }}
      >
        {renderBackground()}
        {renderVehicle({ multiplier, phase })}

        {/* Live multiplier */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className={`font-display text-7xl font-black ${multiplierColor}`}>
            {multiplier.toFixed(2)}×
          </div>
        </div>

        {/* Phase banner */}
        {isBetting && (
          <div className="absolute inset-x-0 top-3 text-center">
            <span className="rounded-full bg-background/70 px-3 py-1 font-display text-xs font-bold uppercase tracking-widest text-primary backdrop-blur">
              Next round in {countdown}s
            </span>
          </div>
        )}
        {isCrashed && (
          <div className="absolute inset-x-0 top-3 text-center font-display text-sm font-bold uppercase tracking-widest text-lose">
            💥 Crashed @ {multiplier.toFixed(2)}×
          </div>
        )}
        {isFlying && hasBet && !cashedOut && (
          <div className="absolute inset-x-0 top-3 text-center">
            <span className="rounded-full bg-win/20 px-3 py-1 font-display text-xs font-bold uppercase tracking-widest text-win backdrop-blur">
              In flight · {Math.floor((bet?.stake || 0) * multiplier)} coins
            </span>
          </div>
        )}
        {isFlying && cashedOut && (
          <div className="absolute inset-x-0 top-3 text-center">
            <span className="rounded-full bg-win/30 px-3 py-1 font-display text-xs font-bold uppercase tracking-widest text-win backdrop-blur">
              ✓ Cashed @ {bet!.cashedAt!.toFixed(2)}×
            </span>
          </div>
        )}
      </Card>

      {/* History — always visible like Aviator */}
      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
          Past:
        </span>
        {history.map((h) => (
          <span
            key={h.id}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
              h.crashAt >= 10
                ? "bg-coin/30 text-coin"
                : h.crashAt >= 2
                ? "bg-win/20 text-win"
                : "bg-lose/20 text-lose"
            }`}
          >
            {h.crashAt.toFixed(2)}×
          </span>
        ))}
        {history.length === 0 &&
          Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="shrink-0 rounded-full bg-muted/40 px-3 py-1 text-xs font-bold text-muted-foreground/60"
            >
              —
            </span>
          ))}
      </div>

      {/* Controls */}
      <Card className="mt-4 border-border/60 bg-gradient-card p-4">
        <Label htmlFor="stake" className="text-xs uppercase tracking-widest text-muted-foreground">
          Stake (coins) · Balance: {coins}
        </Label>
        <div className="mt-2 flex gap-2">
          <Input
            id="stake"
            type="number"
            min={1}
            max={coins}
            value={stake}
            onChange={(e) => setStake(Math.max(0, parseInt(e.target.value) || 0))}
            disabled={hasBet}
            className="bg-background/60 font-display text-lg font-bold"
          />
          {[10, 50, 100].map((v) => (
            <Button
              key={v}
              type="button"
              variant="secondary"
              size="sm"
              disabled={hasBet || v > coins}
              onClick={() => setStake(v)}
            >
              {v}
            </Button>
          ))}
        </div>

        <div className="mt-4">
          {!hasBet && (
            <Button
              size="lg"
              onClick={onPlaceBet}
              disabled={!isBetting || stake <= 0 || stake > coins}
              className="w-full bg-gradient-primary font-display font-bold shadow-glow hover:opacity-90 disabled:opacity-50"
            >
              {isBetting
                ? `🎯 Place Bet (${stake} coins)`
                : isFlying
                ? "⏳ Round in progress…"
                : "⏳ Round ended…"}
            </Button>
          )}
          {hasBet && !cashedOut && (
            <Button
              size="lg"
              onClick={onCashOut}
              disabled={!isFlying}
              className="w-full bg-gradient-coin font-display font-black text-coin-foreground shadow-coin hover:opacity-90 disabled:opacity-50"
            >
              {isFlying
                ? `💰 Cash Out ${Math.floor((bet?.stake || 0) * multiplier)} coins`
                : isBetting
                ? "✓ Bet locked — wait for takeoff"
                : "💥 Round crashed"}
            </Button>
          )}
          {hasBet && cashedOut && (
            <Button
              size="lg"
              disabled
              className="w-full bg-win/30 font-display font-black text-win"
            >
              ✓ Cashed Out {bet!.won} coins
            </Button>
          )}
        </div>

        <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          {name} runs 24/7 · cash out before crash · winnings are virtual coins (no withdrawal)
        </p>
      </Card>
    </>
  );
};
