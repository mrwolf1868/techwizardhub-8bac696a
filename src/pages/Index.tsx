import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { CoinBalance } from "@/components/CoinBalance";
import { useUserStore } from "@/store/userStore";
import { Card } from "@/components/ui/card";
import { Gamepad2, Rocket, Wallet, User, Bot, TrendingUp } from "lucide-react";

const StatCard = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bot;
  label: string;
  value: number | string;
}) => (
  <Card className="border-border/60 bg-gradient-card p-4 shadow-card">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4" />
      <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
    </div>
    <div className="mt-2 font-display text-3xl font-black">{value}</div>
  </Card>
);

const ActionTile = ({
  to,
  title,
  subtitle,
  icon: Icon,
  variant = "primary",
}: {
  to: string;
  title: string;
  subtitle: string;
  icon: typeof Bot;
  variant?: "primary" | "magenta" | "coin" | "muted";
}) => {
  const styles = {
    primary: "bg-gradient-primary text-primary-foreground shadow-glow",
    magenta: "bg-gradient-magenta text-accent-foreground shadow-magenta",
    coin: "bg-gradient-coin text-coin-foreground shadow-coin",
    muted: "bg-secondary text-foreground border border-border",
  }[variant];
  return (
    <Link to={to} className="group">
      <Card className="overflow-hidden border-border/60 bg-gradient-card p-4 shadow-card transition-all hover:-translate-y-1 hover:border-primary/40">
        <div className={`mb-3 grid h-12 w-12 place-items-center rounded-xl ${styles} transition-transform group-hover:scale-110`}>
          <Icon className="h-6 w-6" strokeWidth={2.5} />
        </div>
        <div className="font-display text-base font-bold">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
      </Card>
    </Link>
  );
};

const Dashboard = () => {
  const { botsDeployed, gamesPlayed } = useUserStore();

  return (
    <AppLayout>
      {/* Hero balance card */}
      <Card className="relative overflow-hidden border-primary/30 bg-gradient-card p-6 shadow-glow">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative">
          <CoinBalance size="lg" />
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
            <Rocket className="h-3 w-3 text-primary" />
            70 coins = 1 bot deployment
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard icon={Bot} label="Bots deployed" value={botsDeployed} />
        <StatCard icon={TrendingUp} label="Games played" value={gamesPlayed} />
      </div>

      {/* Action tiles */}
      <h2 className="mt-6 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Quick actions
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <ActionTile to="/games" title="Play games" subtitle="Stake & win big" icon={Gamepad2} variant="magenta" />
        <ActionTile to="/deploy" title="Deploy bot" subtitle="70 coins" icon={Rocket} variant="primary" />
        <ActionTile to="/buy" title="Buy coins" subtitle="1 KES = 1 coin" icon={Wallet} variant="coin" />
        <ActionTile to="/profile" title="Profile" subtitle="Refer & earn 30" icon={User} variant="muted" />
      </div>
    </AppLayout>
  );
};

export default Dashboard;
