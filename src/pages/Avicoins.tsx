import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/store/userStore";
import { toast } from "sonner";
import { Plane, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

type Phase = "idle" | "flying" | "crashed" | "cashed";

// Win ratio 4:6 → 40% chance the player can cash out at >=2x
// Distribution: 60% crashes early (1.0–1.8x), 40% goes higher (2x–10x)
const generateCrashPoint = () => {
  const r = Math.random();
  if (r < 0.6) return 1 + Math.random() * 0.8; // 1.0 - 1.8 (likely loss if user waits)
  if (r < 0.9) return 2 + Math.random() * 3;   // 2.0 - 5.0
  return 5 + Math.random() * 5;                // 5.0 - 10.0
};

const Avicoins = () => {
  const { coins, spendCoins, addCoins, recordGame } = useUserStore();
  const [stake, setStake] = useState(10);
  const [phase, setPhase] = useState<Phase>("idle");
  const [multiplier, setMultiplier] = useState(1);
  const [crashAt, setCrashAt] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const rafRef = useRef<number>();
  const startRef = useRef(0);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const start = () => {
    if (phase === "flying") return;
    if (stake <= 0 || stake > coins) {
      toast.error("Invalid stake");
      return;
    }
    if (!spendCoins(stake, "game_loss", `Avicoins stake (${stake})`)) {
      toast.error("Insufficient coins");
      return;
    }
    recordGame();
    const target = generateCrashPoint();
    setCrashAt(target);
    setMultiplier(1);
    setPhase("flying");
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - startRef.current) / 1000;
      // exponential growth
      const m = Math.pow(1.07, elapsed * 6);
      if (m >= target) {
        setMultiplier(target);
        setPhase("crashed");
        setHistory((h) => [target, ...h].slice(0, 8));
        toast.error(`💥 Crashed at ${target.toFixed(2)}x — stake lost`);
        return;
      }
      setMultiplier(m);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const cashOut = () => {
    if (phase !== "flying") return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const winnings = Math.floor(stake * multiplier);
    addCoins(winnings, "game_win", `Avicoins cashout @ ${multiplier.toFixed(2)}x`);
    setPhase("cashed");
    setHistory((h) => [multiplier, ...h].slice(0, 8));
    toast.success(`🎉 Cashed out ${winnings} coins @ ${multiplier.toFixed(2)}x`);
  };

  const reset = () => {
    setPhase("idle");
    setMultiplier(1);
  };

  const isFlying = phase === "flying";
  const planeY = Math.min(80, (multiplier - 1) * 20);
  const planeX = Math.min(80, (multiplier - 1) * 25);

  return (
    <AppLayout>
      <Link to="/games" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to games
      </Link>

      <Card className="relative h-72 overflow-hidden border-primary/30 bg-gradient-card shadow-card">
        {/* grid bg */}
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "linear-gradient(hsl(var(--primary)/0.3) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--primary)/0.3) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }} />
        {/* Plane */}
        <div
          className="absolute transition-all duration-100 ease-out"
          style={{
            bottom: `${10 + planeY}%`,
            left: `${10 + planeX}%`,
            transform: `rotate(${isFlying ? -25 : phase === "crashed" ? 45 : 0}deg)`,
          }}
        >
          <Plane
            className={`h-12 w-12 ${phase === "crashed" ? "text-lose" : "text-primary"} drop-shadow-[0_0_12px_currentColor]`}
            strokeWidth={2.5}
          />
        </div>
        {/* Multiplier */}
        <div className="absolute inset-0 grid place-items-center">
          <div
            className={`font-display text-7xl font-black ${
              phase === "crashed" ? "text-lose" : phase === "cashed" ? "text-win" : "text-gradient-primary"
            }`}
          >
            {multiplier.toFixed(2)}×
          </div>
        </div>
        {phase === "crashed" && (
          <div className="absolute inset-x-0 top-4 text-center font-display text-sm font-bold uppercase tracking-widest text-lose">
            💥 Crashed
          </div>
        )}
      </Card>

      {/* History */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {history.map((h, i) => (
          <span
            key={i}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
              h >= 2 ? "bg-win/20 text-win" : "bg-lose/20 text-lose"
            }`}
          >
            {h.toFixed(2)}×
          </span>
        ))}
      </div>

      {/* Controls */}
      <Card className="mt-4 border-border/60 bg-gradient-card p-4">
        <Label htmlFor="stake" className="text-xs uppercase tracking-widest text-muted-foreground">
          Stake (coins)
        </Label>
        <div className="mt-2 flex gap-2">
          <Input
            id="stake"
            type="number"
            min={1}
            max={coins}
            value={stake}
            onChange={(e) => setStake(Math.max(0, parseInt(e.target.value) || 0))}
            disabled={isFlying}
            className="bg-background/60 font-display text-lg font-bold"
          />
          {[10, 50, 100].map((v) => (
            <Button
              key={v}
              type="button"
              variant="secondary"
              size="sm"
              disabled={isFlying || v > coins}
              onClick={() => setStake(v)}
            >
              {v}
            </Button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {phase === "idle" || phase === "crashed" || phase === "cashed" ? (
            <Button
              size="lg"
              onClick={phase === "idle" ? start : reset}
              className="col-span-2 bg-gradient-primary font-display font-bold shadow-glow hover:opacity-90"
            >
              {phase === "idle" ? `🚀 Launch (${stake} coins)` : "Play Again"}
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={cashOut}
              className="col-span-2 bg-gradient-coin font-display font-black text-coin-foreground shadow-coin hover:opacity-90"
            >
              💰 Cash Out {Math.floor(stake * multiplier)} coins
            </Button>
          )}
        </div>
      </Card>
    </AppLayout>
  );
};

export default Avicoins;
