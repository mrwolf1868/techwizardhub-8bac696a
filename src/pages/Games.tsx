import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Plane, Sparkles, Rocket, Anchor } from "lucide-react";

const Games = () => {
  return (
    <AppLayout>
      <h2 className="font-display text-2xl font-black">Games</h2>
      <p className="text-sm text-muted-foreground">
        Crash games run 24/7. Place a bet, cash out before it crashes.
      </p>

      <div className="mt-5 grid gap-4">
        <Link to="/games/avicoins">
          <Card className="group relative overflow-hidden border-primary/30 bg-gradient-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-glow">
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-primary/20 blur-3xl transition-all group-hover:bg-primary/30" />
            <div className="relative flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
                <Plane className="h-8 w-8 -rotate-12 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <div className="font-display text-xl font-black">Avicoins</div>
                <div className="text-sm text-muted-foreground">
                  Crash game — cash out before it flies away
                </div>
              </div>
              <div className="rounded-full bg-primary/20 px-3 py-1 text-xs font-bold uppercase text-primary">
                Live
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/games/rocketcoins">
          <Card className="group relative overflow-hidden border-accent/30 bg-gradient-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-magenta">
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-magenta shadow-magenta">
                <Rocket className="h-8 w-8 text-accent-foreground" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <div className="font-display text-xl font-black">Rocketcoins</div>
                <div className="text-sm text-muted-foreground">
                  Launch to the moon — cash out before fuel runs out
                </div>
              </div>
              <div className="rounded-full bg-accent/20 px-3 py-1 text-xs font-bold uppercase text-accent">
                Live
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/games/dive">
          <Card className="group relative overflow-hidden border-win/30 bg-gradient-card p-6 shadow-card transition-all hover:-translate-y-1">
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-win/20 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-win/30 shadow-card">
                <Anchor className="h-8 w-8 text-win" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <div className="font-display text-xl font-black">Deepdive</div>
                <div className="text-sm text-muted-foreground">
                  Dive deep — surface before the pressure crushes you
                </div>
              </div>
              <div className="rounded-full bg-win/20 px-3 py-1 text-xs font-bold uppercase text-win">
                Live
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/games/spin">
          <Card className="group relative overflow-hidden border-coin/30 bg-gradient-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-coin">
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-coin/20 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-coin shadow-coin">
                <Sparkles className="h-8 w-8 text-coin-foreground" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <div className="font-display text-xl font-black">Lucky Spin</div>
                <div className="text-sm text-muted-foreground">Spin the wheel of fortune</div>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <Card className="mt-6 border-lose/30 bg-lose/10 p-4 text-sm text-muted-foreground">
        <strong className="text-lose">⚠ Risk warning:</strong> All staked coins can be lost. Coins
        are virtual credits — winnings cannot be withdrawn, only used to deploy bots. Play
        responsibly.
      </Card>
    </AppLayout>
  );
};

export default Games;
