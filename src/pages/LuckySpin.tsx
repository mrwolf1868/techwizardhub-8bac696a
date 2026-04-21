import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/store/userStore";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

// 8 segments. Wins multiply stake; losses return 0.
const SEGMENTS = [
  { label: "0×", mult: 0, win: false, color: "hsl(var(--lose))" },
  { label: "1.5×", mult: 1.5, win: true, color: "hsl(var(--win))" },
  { label: "0×", mult: 0, win: false, color: "hsl(var(--lose))" },
  { label: "2×", mult: 2, win: true, color: "hsl(var(--primary))" },
  { label: "0×", mult: 0, win: false, color: "hsl(var(--lose))" },
  { label: "1.5×", mult: 1.5, win: true, color: "hsl(var(--win))" },
  { label: "5×", mult: 5, win: true, color: "hsl(var(--coin))" },
  { label: "0×", mult: 0, win: false, color: "hsl(var(--lose))" },
];

const SEG = 360 / SEGMENTS.length;

const LuckySpin = () => {
  const { coins, spendCoins, addCoins, recordGame } = useUserStore();
  const [stake, setStake] = useState(10);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const spin = () => {
    if (spinning) return;
    if (stake <= 0 || stake > coins) {
      toast.error("Invalid stake");
      return;
    }
    if (!spendCoins(stake, "game_loss", `Lucky Spin stake (${stake})`)) {
      toast.error("Insufficient coins");
      return;
    }
    recordGame();
    const idx = Math.floor(Math.random() * SEGMENTS.length);
    const seg = SEGMENTS[idx];
    // Pointer is fixed at top (12 o'clock = 0° in conic-gradient space).
    // Segment i occupies [i*SEG, (i+1)*SEG] clockwise from top, center at i*SEG + SEG/2.
    // To bring that center under the pointer, rotate wheel by -(center) mod 360.
    const segCenter = idx * SEG + SEG / 2;
    const currentMod = ((rotation % 360) + 360) % 360;
    const desiredMod = (360 - segCenter) % 360;
    let delta = desiredMod - currentMod;
    if (delta <= 0) delta += 360;
    const turns = 5;
    const final = rotation + turns * 360 + delta;
    setSpinning(true);
    setRotation(final);
    setTimeout(() => {
      setSpinning(false);
      if (seg.win) {
        const win = Math.floor(stake * seg.mult);
        addCoins(win, "game_win", `Lucky Spin ${seg.label}`);
        toast.success(`🎉 ${seg.label} — won ${win} coins!`);
      } else {
        toast.error(`💔 ${seg.label} — stake lost`);
      }
    }, 4100);
  };

  return (
    <AppLayout>
      <Link to="/games" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to games
      </Link>

      <Card className="relative grid place-items-center overflow-hidden border-accent/30 bg-gradient-card p-6 shadow-card">
        <div className="absolute inset-0 bg-gradient-magenta opacity-10" />

        <div className="relative">
          {/* Pointer */}
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1">
            <div
              className="h-0 w-0 border-x-[14px] border-t-[24px] border-x-transparent"
              style={{ borderTopColor: "hsl(var(--coin))", filter: "drop-shadow(0 0 8px hsl(var(--coin)))" }}
            />
          </div>

          {/* Wheel */}
          <div
            className="relative h-72 w-72 rounded-full border-4 border-coin shadow-coin transition-transform"
            style={{
              transform: `rotate(${rotation}deg)`,
              transitionDuration: "4s",
              transitionTimingFunction: "cubic-bezier(0.17, 0.67, 0.21, 0.99)",
              background: `conic-gradient(${SEGMENTS.map(
                (s, i) => `${s.color} ${i * SEG}deg ${(i + 1) * SEG}deg`
              ).join(",")})`,
            }}
          >
            {SEGMENTS.map((s, i) => {
              // conic-gradient 0° is at top; CSS rotate 0° is at right (3 o'clock).
              // Offset by -90° so labels align with their colored slices.
              const angle = i * SEG + SEG / 2 - 90;
              return (
                <div
                  key={i}
                  className="pointer-events-none absolute left-1/2 top-1/2 font-display text-base font-black text-background"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${angle}deg) translate(100px) rotate(90deg)`,
                  }}
                >
                  {s.label}
                </div>
              );
            })}
            {/* hub */}
            <div className="absolute inset-0 m-auto grid h-16 w-16 place-items-center rounded-full bg-background shadow-glow">
              <Sparkles className="h-7 w-7 text-coin" strokeWidth={2.5} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-4 border-border/60 bg-gradient-card p-4">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Stake (coins)</Label>
        <div className="mt-2 flex gap-2">
          <Input
            type="number"
            min={1}
            max={coins}
            value={stake}
            onChange={(e) => setStake(Math.max(0, parseInt(e.target.value) || 0))}
            disabled={spinning}
            className="bg-background/60 font-display text-lg font-bold"
          />
          {[10, 50, 100].map((v) => (
            <Button key={v} variant="secondary" size="sm" disabled={spinning || v > coins} onClick={() => setStake(v)}>
              {v}
            </Button>
          ))}
        </div>
        <Button
          size="lg"
          onClick={spin}
          disabled={spinning}
          className="mt-4 w-full bg-gradient-magenta font-display font-bold shadow-magenta hover:opacity-90"
        >
          {spinning ? "Spinning..." : `🎰 Spin (${stake} coins)`}
        </Button>
      </Card>
    </AppLayout>
  );
};

export default LuckySpin;
