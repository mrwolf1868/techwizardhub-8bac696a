import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users as UsersIcon,
  Swords,
  Wallet,
  TrendingUp,
  Activity as ActivityIcon,
  Settings as SettingsIcon,
  ShieldCheck,
  LogOut,
  Search,
  Trash2,
  Ban,
  CheckCircle2,
  Power,
  Download,
  RefreshCcw,
  Rocket,
  Plus,
  Pencil,
  X,
  Send,
  Megaphone,
  User as UserIcon,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { normalizePhone } from "@/lib/phone";
import { canWithdrawProfit } from "@/lib/matchFees";

type Profile = {
  user_id: string;
  phone: string;
  email: string | null;
  coins: number;
  games_played: number;
  banned: boolean;
  banned_at: string | null;
  last_active: string;
  created_at: string;
};



type ActivityLog = {
  id: string;
  user_id: string | null;
  actor_id: string | null;
  event: string;
  detail: string | null;
  created_at: string;
};

type Match = {
  id: string;
  game_type: string;
  stake: number;
  status: string;
  creator_id: string;
  opponent_id: string | null;
  invited_user_id: string | null;
  match_mode: "open" | "friend" | "challenge";
  winner_id: string | null;
  house_fee: number;
  created_at: string;
  updated_at: string;
};

type FeeTx = { amount: number; created_at: string };
type ProfitSummary = { total_fees: number; total_withdrawn: number; available: number };
type WalletWithdrawal = { id: string; user_id: string; phone: string; amount: number; status: string; created_at: string; processed_at: string | null };
type ProfitWithdrawal = { id: string; created_by: string; phone: string; amount: number; status: string; result_desc: string | null; created_at: string };

type MpesaTx = {
  id: string;
  phone: string;
  amount: number;
  status: string;
  mpesa_receipt: string | null;
  created_at: string;
};

type Section =
  | "dashboard"
  | "users"
  | "matches"
  | "messages"
  | "activity"
  | "payments"
  | "withdrawals"
  | "services"
  | "settings";

const Admin = () => {
  const { isAdmin, userId } = useUserStore();
  const [section, setSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [fees, setFees] = useState<FeeTx[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [mpesa, setMpesa] = useState<MpesaTx[]>([]);
  const [walletWithdrawals, setWalletWithdrawals] = useState<WalletWithdrawal[]>([]);
  const [profitWithdrawals, setProfitWithdrawals] = useState<ProfitWithdrawal[]>([]);
  const [profitSummary, setProfitSummary] = useState<ProfitSummary>({ total_fees: 0, total_withdrawn: 0, available: 0 });
  const [settings, setSettings] = useState<Record<string, unknown>>({});

  const load = async () => {
    const [{ data: p }, { data: gm }, { data: fx }, { data: al }, { data: m }, { data: s }, { data: wr }, { data: profit }, { data: pw }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("game_matches").select("id, game_type, stake, status, creator_id, opponent_id, invited_user_id, match_mode, winner_id, house_fee, created_at, updated_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("transactions").select("amount, created_at").eq("type", "house_fee").order("created_at", { ascending: false }).limit(5000),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("mpesa_transactions").select("id, phone, amount, status, mpesa_receipt, created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("admin_settings").select("key, value"),
      supabase.from("wallet_withdrawals").select("id,user_id,phone,amount,status,created_at,processed_at").order("created_at", { ascending: false }).limit(200),
      supabase.rpc("admin_get_profit_summary"),
      supabase.from("admin_profit_withdrawals").select("id,created_by,phone,amount,status,result_desc,created_at").order("created_at", { ascending: false }).limit(100),
    ]);
    setProfiles((p || []) as Profile[]);
    setMatches((gm || []) as Match[]);
    setFees((fx || []) as FeeTx[]);
    setActivity((al || []) as ActivityLog[]);
    setMpesa((m || []) as MpesaTx[]);
    setWalletWithdrawals((wr || []) as WalletWithdrawal[]);
    setProfitWithdrawals((pw || []) as ProfitWithdrawal[]);
    const currentProfit = profit?.[0];
    if (currentProfit) {
      setProfitSummary({
        total_fees: Number(currentProfit.total_fees) || 0,
        total_withdrawn: Number(currentProfit.total_withdrawn) || 0,
        available: Number(currentProfit.available) || 0,
      });
    }
    const sObj: Record<string, unknown> = {};
    (s || []).forEach((row: { key: string; value: unknown }) => { sObj[row.key] = row.value; });
    setSettings(sObj);
  };

  useEffect(() => {
    if (!isAdmin) return;
    load();

    const channel = supabase
      .channel(`admin-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_matches" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  if (!userId) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;


  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const navItems: Array<{ key: Section; label: string; icon: React.ElementType }> = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "users", label: "Users", icon: UsersIcon },
    { key: "matches", label: "Matches", icon: Swords },
    { key: "messages", label: "Messages", icon: Send },
    { key: "activity", label: "Activity", icon: ActivityIcon },
    { key: "payments", label: "Payments", icon: CheckCircle2 },
    { key: "withdrawals", label: "Withdrawals", icon: Wallet },
    { key: "services", label: "Services", icon: Rocket },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-border/60 bg-card/95 backdrop-blur transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-border/60 p-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary shadow-glow">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display text-sm font-black">Admin</div>
            <div className="text-[10px] text-muted-foreground">TECHWOLFpro</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {navItems.map((it) => {
            const Icon = it.icon;
            const active = section === it.key;
            return (
              <button
                key={it.key}
                onClick={() => { setSection(it.key); setSidebarOpen(false); }}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-primary/15 text-primary font-bold"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </button>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-border/60 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <main className="flex-1 overflow-x-hidden">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-border/60 p-2 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <h1 className="font-display text-lg font-black capitalize">{section}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </header>

        <div className="p-4">
          {section === "dashboard" && (
            <Dashboard profiles={profiles} matches={matches} fees={fees} mpesa={mpesa} activity={activity} profitSummary={profitSummary} />
          )}
          {section === "matches" && <MatchesPanel matches={matches} profiles={profiles} onChange={load} />}
          {section === "users" && (
            <UsersPanel profiles={profiles} onChange={load} />
          )}
          {section === "messages" && <MessagesPanel profiles={profiles} />}
          {section === "activity" && <ActivityPanel logs={activity} profiles={profiles} />}
          {section === "payments" && <PaymentsPanel mpesa={mpesa} />}
          {section === "withdrawals" && <WithdrawalsPanel requests={walletWithdrawals} profitWithdrawals={profitWithdrawals} profitSummary={profitSummary} profiles={profiles} onChange={load} />}
          {section === "services" && <ServicesPanel />}
          {section === "settings" && <SettingsPanel settings={settings} onSaved={load} />}
        </div>
      </main>
    </div>
  );
};

/* ---------- Dashboard ---------- */
const DAY = 86400000;
const ksh = (n: number) => `KSh ${n.toLocaleString()}`;

const Dashboard = ({
  profiles, matches, fees, mpesa, activity, profitSummary,
}: {
  profiles: Profile[]; matches: Match[]; fees: FeeTx[]; mpesa: MpesaTx[]; activity: ActivityLog[]; profitSummary: ProfitSummary;
}) => {
  const now = Date.now();
  const sum = (xs: { amount: number }[]) => xs.reduce((t, x) => t + (x.amount || 0), 0);
  const feesToday = sum(fees.filter((f) => now - new Date(f.created_at).getTime() < DAY));
  const fees7 = sum(fees.filter((f) => now - new Date(f.created_at).getTime() < 7 * DAY));
  const paid = mpesa.filter((m) => m.status === "success" || m.status === "completed");
  const depositsToday = sum(paid.filter((m) => now - new Date(m.created_at).getTime() < DAY));
  const liveMatches = matches.filter((m) => m.status === "active").length;
  const waitingMatches = matches.filter((m) => m.status === "waiting").length;
  const staked = matches.filter((m) => m.status === "active").reduce((t, m) => t + m.stake * 2, 0)
    + matches.filter((m) => m.status === "waiting").reduce((t, m) => t + m.stake, 0);
  const newUsers = profiles.filter((p) => now - new Date(p.created_at).getTime() < DAY).length;
  const activeUsers = profiles.filter((p) => now - new Date(p.last_active).getTime() < DAY).length;
  const banned = profiles.filter((p) => p.banned).length;
  const balances = profiles.reduce((t, p) => t + p.coins, 0);
  const top = [...profiles].sort((a, b) => b.coins - a.coins).slice(0, 5);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total users" value={profiles.length} icon={UsersIcon} tone="primary" />
        <StatCard label="Active (24h)" value={activeUsers} icon={ActivityIcon} tone="win" />
        <StatCard label="New today" value={newUsers} icon={Plus} tone="coin" />
        <StatCard label="Banned" value={banned} icon={Ban} tone="lose" />
        <StatCard label="Fees today" value={ksh(feesToday)} icon={TrendingUp} tone="win" />
        <StatCard label="Fees (7 days)" value={ksh(fees7)} icon={TrendingUp} tone="primary" />
        <StatCard label="Deposits today" value={ksh(depositsToday)} icon={CheckCircle2} tone="coin" />
        <StatCard label="User balances" value={ksh(balances)} icon={Wallet} tone="primary" />
        <StatCard label="Live matches" value={liveMatches} icon={Swords} tone="win" />
        <StatCard label="Waiting matches" value={waitingMatches} icon={Swords} tone="coin" />
        <StatCard label="Coins in play" value={ksh(staked)} icon={Wallet} tone="primary" />
        <StatCard label="Profit available" value={ksh(profitSummary.available)} icon={Wallet} tone="coin" />
        <StatCard label="Events (24h)" value={activity.filter((a) => now - new Date(a.created_at).getTime() < DAY).length} icon={ActivityIcon} tone="coin" />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card className="bg-gradient-card p-4">
          <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">Top balances</h2>
          <Table>
            <TableHeader><TableRow><TableHead>Phone</TableHead><TableHead>Balance</TableHead><TableHead>Games</TableHead></TableRow></TableHeader>
            <TableBody>
              {top.map((p) => (
                <TableRow key={p.user_id}>
                  <TableCell className="font-mono text-xs">{p.phone}</TableCell>
                  <TableCell className="text-xs">{ksh(p.coins)}</TableCell>
                  <TableCell className="text-xs">{p.games_played}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <Card className="bg-gradient-card p-4">
          <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">Live activity</h2>
          <div className="max-h-[360px] overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Detail</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
              <TableBody>
                {activity.slice(0, 30).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell><span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{a.event}</span></TableCell>
                    <TableCell className="text-xs">{a.detail || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </>
  );
};

/* ---------- Matches ---------- */
const MatchesPanel = ({ matches, profiles, onChange }: { matches: Match[]; profiles: Profile[]; onChange: () => void }) => {
  const [filter, setFilter] = useState<"all" | "waiting" | "active" | "finished" | "cancelled">("all");
  const [game, setGame] = useState<"all" | "chess" | "draughts">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const phone = (id: string | null) => (id ? profiles.find((p) => p.user_id === id)?.phone || id.slice(0, 8) : "—");
  const rows = matches.filter((m) => (filter === "all" || m.status === filter) && (game === "all" || m.game_type === game));

  const cancel = async (m: Match) => {
    if (!confirm(`Cancel this ${m.game_type} match and refund each player's stake of KSh ${m.stake}?`)) return;
    setBusy(m.id);
    const { error } = await supabase.rpc("admin_cancel_match", { _id: m.id });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Match cancelled and stakes refunded");
    onChange();
  };

  const exportCsv = () => {
    const header = "game,status,stake,fees,creator,opponent_or_invited_player,winner,created_at\n";
    const body = rows.map((m) => [m.game_type, m.status, m.stake, m.house_fee, phone(m.creator_id), phone(m.opponent_id || m.invited_user_id), phone(m.winner_id), m.created_at].join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `matches-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-gradient-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["all", "waiting", "active", "finished", "cancelled"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">{f}</Button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        {(["all", "chess", "draughts"] as const).map((g) => (
          <Button key={g} size="sm" variant={game === g ? "secondary" : "ghost"} onClick={() => setGame(g)} className="capitalize">{g === "draughts" ? "Draft" : g}</Button>
        ))}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={exportCsv}><Download className="mr-1 h-4 w-4" />Export</Button>
      </div>
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Game</TableHead><TableHead>Status</TableHead><TableHead>Stake</TableHead><TableHead>Fees</TableHead>
              <TableHead>Players</TableHead><TableHead>Winner</TableHead><TableHead>Created</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">No matches</TableCell></TableRow>}
            {rows.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-xs font-bold">{m.game_type === "draughts" ? "Draft" : "Chess"}</TableCell>
                <TableCell className="text-xs capitalize">{m.status}{m.status === "waiting" && m.match_mode !== "open" ? ` · ${m.match_mode === "challenge" ? "invited" : "private"}` : ""}</TableCell>
                <TableCell className="text-xs">{ksh(m.stake)}</TableCell>
                <TableCell className="text-xs">{ksh(m.house_fee)}</TableCell>
                <TableCell className="font-mono text-[11px]">{phone(m.creator_id)}<br />{phone(m.opponent_id || m.invited_user_id)}</TableCell>
                <TableCell className="font-mono text-[11px]">{phone(m.winner_id)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  {(m.status === "waiting" || m.status === "active") && (
                    <Button size="sm" variant="outline" disabled={busy === m.id} onClick={() => cancel(m)}>
                      <X className="mr-1 h-3.5 w-3.5" />Cancel & refund
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

const StatCard = ({
  label, value, icon: Icon, tone,
}: { label: string; value: number | string; icon: React.ElementType; tone: "primary" | "win" | "lose" | "coin" }) => {
  const toneMap = {
    primary: "text-primary",
    win: "text-win",
    lose: "text-lose",
    coin: "text-coin",
  };
  return (
    <Card className="bg-gradient-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${toneMap[tone]}`} /> {label}
      </div>
      <div className={`font-display text-3xl font-black ${toneMap[tone]}`}>{typeof value === "number" ? value.toLocaleString() : value}</div>
    </Card>
  );
};

/* ---------- Users ---------- */
const UsersPanel = ({ profiles, onChange }: { profiles: Profile[]; onChange: () => void }) => {
  const [q, setQ] = useState("");
  const filtered = profiles.filter((p) =>
    !q || p.phone.includes(q) || (p.email || "").toLowerCase().includes(q.toLowerCase())
  );

  const adjustCoins = async (uid: string, delta: number) => {
    const row = profiles.find((x) => x.user_id === uid);
    if (!row) return;
    const { error } = await supabase.rpc("admin_adjust_user_coins", { _user_id: uid, _delta: delta });
    if (error) return toast.error(error.message);
    toast.success("Coins updated");
    onChange();
  };

  const toggleBan = async (p: Profile) => {
    const banned = !p.banned;
    const { error } = await supabase.rpc("admin_set_user_banned", { _user_id: p.user_id, _banned: banned });
    if (error) return toast.error(error.message);
    toast.success(banned ? "User banned" : "User unbanned");
    onChange();
  };

  return (
    <Card className="bg-gradient-card p-4">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search phone / email / ref" className="pl-9" />
      </div>
      <div className="max-h-[600px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Coins</TableHead>
              <TableHead>Games</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.user_id} className={p.banned ? "opacity-60" : ""}>
                <TableCell className="font-mono text-xs">{p.phone}</TableCell>
                <TableCell className="text-xs">{p.email || "—"}</TableCell>
                <TableCell className="text-right font-bold text-coin">{p.coins}</TableCell>
                <TableCell className="text-xs">{p.games_played}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(p.last_active).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {p.banned ? (
                    <span className="rounded-full bg-lose/20 px-2 py-0.5 text-[10px] font-bold text-lose">banned</span>
                  ) : (
                    <span className="rounded-full bg-win/20 px-2 py-0.5 text-[10px] font-bold text-win">active</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => adjustCoins(p.user_id, 100)}>+100</Button>
                    <Button size="sm" variant="secondary" onClick={() => adjustCoins(p.user_id, -100)}>-100</Button>
                    <Button size="sm" variant={p.banned ? "default" : "destructive"} onClick={() => toggleBan(p)}>
                      <Ban className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

/* ---------- Activity logs ---------- */
const ActivityPanel = ({ logs, profiles }: { logs: ActivityLog[]; profiles: Profile[] }) => {
  const exportCsv = () => {
    const header = "event,detail,user_phone,created_at\n";
    const phoneByUser: Record<string, string> = {};
    profiles.forEach((p) => { phoneByUser[p.user_id] = p.phone; });
    const rows = logs.map((l) =>
      [l.event, (l.detail || "").replace(/"/g, '""'), phoneByUser[l.user_id || ""] || "", l.created_at]
        .map((c) => `"${c}"`).join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `activity-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-gradient-card p-4">
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="secondary" onClick={exportCsv}>
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
      </div>
      <div className="max-h-[600px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {l.event}
                  </span>
                </TableCell>
                <TableCell className="text-xs">{l.detail || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

/* ---------- Payments ---------- */
const PaymentsPanel = ({ mpesa }: { mpesa: MpesaTx[] }) => (
  <Card className="bg-gradient-card p-4">
    <div className="max-h-[600px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">KES</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Receipt</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mpesa.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-mono text-xs">{m.phone}</TableCell>
              <TableCell className="text-right font-bold">{m.amount}</TableCell>
              <TableCell>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  m.status === "success" ? "bg-win/20 text-win"
                  : m.status === "pending" ? "bg-muted text-muted-foreground"
                  : "bg-lose/20 text-lose"
                }`}>
                  {m.status}
                </span>
              </TableCell>
              <TableCell className="font-mono text-[10px]">{m.mpesa_receipt || "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </Card>
);

/* ---------- Wallet and fee withdrawals ---------- */
const WithdrawalsPanel = ({
  requests, profitWithdrawals, profitSummary, profiles, onChange,
}: {
  requests: WalletWithdrawal[];
  profitWithdrawals: ProfitWithdrawal[];
  profitSummary: ProfitSummary;
  profiles: Profile[];
  onChange: () => Promise<void>;
}) => {
  const adminPhone = useUserStore((state) => state.phoneNumber);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingProfit, setSavingProfit] = useState(false);

  useEffect(() => {
    if (adminPhone) setPhone((current) => current || adminPhone);
  }, [adminPhone]);

  const [payoutReady, setPayoutReady] = useState<boolean | null>(null);
  useEffect(() => {
    void supabase.functions.invoke("mpesa-payout", { body: { action: "status" } })
      .then(({ data }) => setPayoutReady(!!data?.ready), () => setPayoutReady(false));
  }, []);

  const callPayout = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("mpesa-payout", { body });
    if (!error && data?.success) return null;
    let message = data?.error as string | undefined;
    if (!message && error && "context" in error) {
      try { message = (await (error as { context: Response }).context.json()).error; } catch { /* ignore */ }
    }
    return message || "The payout could not be sent";
  };

  const recordProfitWithdrawal = async () => {
    const requested = Number(amount);
    const normalized = normalizePhone(phone);
    if (!canWithdrawProfit(requested, profitSummary.available)) return toast.error("Enter an amount within the available profit");
    if (requested < 10) return toast.error("The minimum payout is KSh 10");
    if (!normalized || !/^254[17]\d{8}$/.test(normalized)) return toast.error("Enter a valid Safaricom number");
    setSavingProfit(true);
    const failure = await callPayout({ action: "profit", amount: requested, phone: normalized });
    setSavingProfit(false);
    await onChange();
    if (failure) return toast.error(failure);
    setAmount("");
    toast.success("Payout sent to M-Pesa. Available profit updates when Safaricom confirms.");
  };

  const sendRequest = async (request: WalletWithdrawal) => {
    setBusyId(request.id);
    const failure = await callPayout({ action: "send_pending", withdrawalId: request.id });
    setBusyId(null);
    await onChange();
    if (failure) return toast.error(failure);
    toast.success("Payout sent to M-Pesa");
  };

  const rejectRequest = async (request: WalletWithdrawal) => {
    if (!confirm("Reject this request and return the balance to the player?")) return;
    setBusyId(request.id);
    const { error } = await supabase.rpc("admin_resolve_wallet_withdrawal", { _id: request.id, _status: "rejected" });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Request rejected and balance returned");
    await onChange();
  };

  const profilePhone = (userId: string) => profiles.find((profile) => profile.user_id === userId)?.phone || userId.slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Fees earned" value={ksh(profitSummary.total_fees)} icon={TrendingUp} tone="win" />
        <StatCard label="Withdrawn" value={ksh(profitSummary.total_withdrawn)} icon={Wallet} tone="primary" />
        <StatCard label="Available profit" value={ksh(profitSummary.available)} icon={Wallet} tone="coin" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-gradient-card p-4">
          <h2 className="font-display text-sm font-bold">Withdraw profit to M-Pesa</h2>
          <p className="mt-1 text-xs text-muted-foreground">Sends your match fees straight to M-Pesa. Available profit drops only by the amount sent; failed payouts return to profit.</p>
          <div className={`payout-setup mt-3 ${payoutReady ? "ready" : ""}`} role="status">
            {payoutReady === null ? "Checking M-Pesa payout setup…" : payoutReady ? "M-Pesa payouts are ready." : "M-Pesa payouts are not set up yet. Withdrawals are refused until the payout keys are added securely."}
          </div>
          <div className="mt-4 grid gap-3">
            <div>
              <label htmlFor="profit-phone" className="text-xs text-muted-foreground">M-Pesa number</label>
              <Input id="profit-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0712345678" className="mt-1" />
            </div>
            <div>
              <label htmlFor="profit-amount" className="text-xs text-muted-foreground">Amount (KSh)</label>
              <Input id="profit-amount" type="number" min={1} max={profitSummary.available} value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1" />
            </div>
            <Button disabled={savingProfit || profitSummary.available < 10 || payoutReady === false} onClick={recordProfitWithdrawal}>
              {savingProfit ? "Sending…" : "Withdraw to M-Pesa"}
            </Button>
          </div>
          {profitWithdrawals.length > 0 && (
            <div className="mt-5 overflow-auto">
              <h3 className="mb-2 text-xs font-bold uppercase text-muted-foreground">Recent withdrawals</h3>
              <Table>
                <TableHeader><TableRow><TableHead>Amount</TableHead><TableHead>Number</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>{profitWithdrawals.slice(0, 10).map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell>{ksh(withdrawal.amount)}</TableCell>
                    <TableCell className="font-mono text-xs">{withdrawal.phone}</TableCell>
                    <TableCell className="text-xs capitalize" title={withdrawal.result_desc ?? undefined}>{withdrawal.status}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(withdrawal.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </Card>

        <Card className="bg-gradient-card p-4">
          <h2 className="font-display text-sm font-bold">Player withdrawal requests</h2>
          <p className="mt-1 text-xs text-muted-foreground">Player withdrawals go to M-Pesa automatically. Queued requests can be sent or rejected; failed and rejected ones return the balance.</p>
          <div className="mt-3 max-h-[520px] overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Player</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {requests.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No withdrawal requests</TableCell></TableRow>}
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="text-xs"><span className="block font-mono">{profilePhone(request.user_id)}</span><span className="text-muted-foreground">to +{request.phone}</span></TableCell>
                    <TableCell>{ksh(request.amount)}</TableCell>
                    <TableCell className="capitalize">{request.status}</TableCell>
                    <TableCell>
                      {request.status === "pending" ? <div className="flex gap-1">
                        <Button size="sm" disabled={busyId === request.id || payoutReady === false} onClick={() => sendRequest(request)}>Send</Button>
                        <Button size="sm" variant="outline" disabled={busyId === request.id} onClick={() => rejectRequest(request)}>Reject</Button>
                      </div> : <span className="text-xs text-muted-foreground">{request.processed_at ? new Date(request.processed_at).toLocaleDateString() : "—"}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
};

/* ---------- Settings ---------- */
const SettingsPanel = ({ settings, onSaved }: { settings: Record<string, unknown>; onSaved: () => void }) => {
  const [shortcode, setShortcode] = useState("");
  const [till, setTill] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [passkey, setPasskey] = useState("");
  const [env, setEnv] = useState<"sandbox" | "production">("sandbox");
  const [saving, setSaving] = useState(false);

  const asStr = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

  const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mpesa-callback`;

  useEffect(() => {
    setShortcode(asStr(settings.mpesa_shortcode) || asStr(settings.mpesa_till));
    setTill(asStr(settings.mpesa_till));
    setConsumerKey(asStr(settings.mpesa_consumer_key));
    setConsumerSecret(asStr(settings.mpesa_consumer_secret));
    setPasskey(asStr(settings.mpesa_passkey));
    const e = asStr(settings.mpesa_env);
    setEnv(e === "production" ? "production" : "sandbox");
  }, [settings]);

  const save = async (key: string, value: unknown, label: string) => {
    setSaving(true);
    const { error } = await supabase.from("admin_settings").upsert({
      key, value: value as never, updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    await supabase.from("activity_logs").insert({
      event: "setting_change", detail: `${label} set to ${JSON.stringify(value)}`,
    });
    toast.success(`${label} saved`);
    onSaved();
  };

  const saveAllMpesa = async () => {
    if (!/^\d{4,10}$/.test(shortcode)) return toast.error("Business Shortcode must be 4-10 digits");
    if (!/^\d{4,10}$/.test(till)) return toast.error("Till Number must be 4-10 digits");
    if (!consumerKey.trim() || !consumerSecret.trim() || !passkey.trim())
      return toast.error("Consumer key, secret and passkey are required");
    setSaving(true);
    const rows = [
      { key: "mpesa_shortcode", value: shortcode },
      { key: "mpesa_till", value: till },
      { key: "mpesa_consumer_key", value: consumerKey.trim() },
      { key: "mpesa_consumer_secret", value: consumerSecret.trim() },
      { key: "mpesa_passkey", value: passkey.trim() },
      { key: "mpesa_env", value: env },
    ].map((r) => ({ ...r, value: r.value as never, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from("admin_settings").upsert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    await supabase.from("activity_logs").insert({
      event: "setting_change", detail: `M-Pesa credentials updated (env: ${env})`,
    });
    toast.success("M-Pesa credentials saved");
    onSaved();
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-card p-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          M-Pesa BuyGoods (STK push) credentials
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          All fields below are required to start STK push for Buy Goods Online.
          Coins are only granted after the M-Pesa callback confirms the payment was successful.
        </p>

        <div className="mt-4 grid gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Environment</label>
            <div className="mt-1 flex w-fit gap-1 rounded-lg border border-border/60 p-1">
              {(["sandbox", "production"] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEnv(e)}
                  className={`rounded-md px-3 py-1 text-xs capitalize ${
                    env === e ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Use Sandbox for testing, Production for live payments.</p>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Consumer Key</label>
            <Input value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxx" className="mt-1 font-mono" />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Consumer Secret</label>
            <Input type="password" value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} placeholder="••••••••••••" className="mt-1 font-mono" />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Business Shortcode (Head Office / Store Number)
            </label>
            <Input value={shortcode} onChange={(e) => setShortcode(e.target.value)} placeholder="7797502" className="mt-1 font-mono" />
            <p className="mt-1 text-[10px] text-muted-foreground">Used to authenticate the STK push request.</p>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Till Number (PartyB)
            </label>
            <Input value={till} onChange={(e) => setTill(e.target.value)} placeholder="9744173" className="mt-1 font-mono" />
            <p className="mt-1 text-[10px] text-muted-foreground">Where customer payments actually settle.</p>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Passkey (Lipa Na M-Pesa)</label>
            <Input type="password" value={passkey} onChange={(e) => setPasskey(e.target.value)} placeholder="••••••••••••" className="mt-1 font-mono" />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Callback URL</label>
            <Input value={callbackUrl} readOnly className="mt-1 font-mono text-xs" />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Paste this exact URL into your Daraja app's STK callback configuration.
            </p>
          </div>

          <Button disabled={saving} onClick={saveAllMpesa} className="mt-1">
            Save M-Pesa credentials
          </Button>
        </div>
      </Card>

    </div>
  );
};

/* ---------- Services manager (unified with child_projects) ---------- */
type ServiceRow = {
  id: string;
  slug: string;
  name: string;
  url: string;
  description: string | null;
  icon: string | null;
  price_coins: number;
  continuation_price_coins: number;
  free_trial_seconds: number;
  continuation_duration_value: number;
  continuation_duration_unit: string;
  enabled: boolean;
};

const ServicesPanel = () => {
  const [items, setItems] = useState<ServiceRow[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [price, setPrice] = useState("0");
  const [contPrice, setContPrice] = useState("0");
  const [freeSecs, setFreeSecs] = useState("30");
  const [contDurValue, setContDurValue] = useState("1");
  const [contDurUnit, setContDurUnit] = useState("days");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("child_projects")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setItems((data || []) as ServiceRow[]);
  };

  useEffect(() => { load(); }, []);

  const reset = () => {
    setEditing(null);
    setSlug(""); setName(""); setUrl(""); setDescription(""); setIcon("");
    setPrice("0"); setContPrice("0"); setFreeSecs("30");
    setContDurValue("1"); setContDurUnit("days");
  };

  const submit = async () => {
    if (!slug.trim() || !name.trim() || !url.trim())
      return toast.error("Slug, name and link are required");
    setSaving(true);
    const payload = {
      slug: slug.trim().toLowerCase(),
      name: name.trim(),
      url: url.trim(),
      description: description.trim() || null,
      icon: icon.trim() || null,
      price_coins: Math.max(0, Number(price) || 0),
      continuation_price_coins: Math.max(0, Number(contPrice) || 0),
      free_trial_seconds: Math.max(5, Number(freeSecs) || 30),
      continuation_duration_value: Math.max(1, Number(contDurValue) || 1),
      continuation_duration_unit: ["days", "weeks", "months"].includes(contDurUnit) ? contDurUnit : "days",
    };
    const { error } = editing
      ? await supabase.from("child_projects").update(payload).eq("id", editing)
      : await supabase.from("child_projects").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Service updated" : "Service added");
    reset();
    load();
  };

  const toggle = async (s: ServiceRow) => {
    const { error } = await supabase.from("child_projects").update({ enabled: !s.enabled }).eq("id", s.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this service?")) return;
    const { error } = await supabase.from("child_projects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const startEdit = (s: ServiceRow) => {
    setEditing(s.id);
    setSlug(s.slug);
    setName(s.name);
    setUrl(s.url);
    setDescription(s.description || "");
    setIcon(s.icon || "");
    setPrice(String(s.price_coins ?? 0));
    setContPrice(String(s.continuation_price_coins ?? 0));
    setFreeSecs(String(s.free_trial_seconds ?? 30));
    setContDurValue(String(s.continuation_duration_value ?? 1));
    setContDurUnit(s.continuation_duration_unit ?? "days");
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-card p-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          {editing ? "Edit service" : "Add a service"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Users see only the name. The link stays hidden — they open it via /s/&lt;slug&gt;.
        </p>
        <div className="mt-3 grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Slug</label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="virtual-numbers" className="mt-1 font-mono" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Virtual Numbers" className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Hidden link / URL</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (never shown to users)" className="mt-1 font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short tagline" className="mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Icon name</label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Rocket / Globe" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Price (coins)</label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Continuation</label>
              <Input type="number" value={contPrice} onChange={(e) => setContPrice(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Free trial (sec)</label>
              <Input type="number" value={freeSecs} onChange={(e) => setFreeSecs(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Continuation duration (how long the paid unlock lasts)
            </label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={1}
                value={contDurValue}
                onChange={(e) => setContDurValue(e.target.value)}
                placeholder="e.g. 7"
              />
              <select
                value={contDurUnit}
                onChange={(e) => setContDurUnit(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button disabled={saving} onClick={submit}>
              {editing ? "Save changes" : <><Plus className="mr-1 h-4 w-4" /> Add service</>}
            </Button>
            {editing && (
              <Button variant="ghost" onClick={reset}>
                <X className="mr-1 h-4 w-4" /> Cancel
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-card p-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          All services ({items.length})
        </h3>
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Cont.</TableHead>
              <TableHead>Trial</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="font-mono text-[11px]">{s.slug}</TableCell>
                <TableCell>{s.price_coins}</TableCell>
                <TableCell>{s.continuation_price_coins}</TableCell>
                <TableCell>{s.free_trial_seconds}s</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.enabled ? "bg-win/20 text-win" : "bg-muted text-muted-foreground"}`}>
                    {s.enabled ? "live" : "hidden"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => toggle(s)}>{s.enabled ? "Hide" : "Show"}</Button>
                    <Button size="icon" variant="secondary" onClick={() => startEdit(s)} aria-label="Edit">
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="destructive" onClick={() => remove(s.id)} aria-label="Delete">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

/* ---------- Service pricing manager ---------- */
type Pricing = {
  id: string;
  service_key: string;
  name: string;
  price_coins: number;
  continuation_price_coins: number;
  enabled: boolean;
};

const PricingPanel = () => {
  const [items, setItems] = useState<Pricing[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [serviceKey, setServiceKey] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [contPrice, setContPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("service_pricing")
      .select("*")
      .order("created_at", { ascending: true });
    setItems((data || []) as Pricing[]);
  };
  useEffect(() => { load(); }, []);

  const reset = () => {
    setEditing(null);
    setServiceKey(""); setName(""); setPrice(""); setContPrice("");
  };

  const submit = async () => {
    if (!serviceKey.trim() || !name.trim()) return toast.error("Key and name required");
    setSaving(true);
    const payload = {
      service_key: serviceKey.trim(),
      name: name.trim(),
      price_coins: Math.max(0, Number(price) || 0),
      continuation_price_coins: Math.max(0, Number(contPrice) || 0),
    };
    const { error } = editing
      ? await supabase.from("service_pricing").update(payload).eq("id", editing)
      : await supabase.from("service_pricing").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Pricing updated" : "Pricing added");
    reset(); load();
  };

  const toggle = async (p: Pricing) => {
    const { error } = await supabase.from("service_pricing").update({ enabled: !p.enabled }).eq("id", p.id);
    if (error) return toast.error(error.message);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this pricing entry?")) return;
    const { error } = await supabase.from("service_pricing").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const startEdit = (p: Pricing) => {
    setEditing(p.id);
    setServiceKey(p.service_key);
    setName(p.name);
    setPrice(String(p.price_coins));
    setContPrice(String(p.continuation_price_coins));
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-card p-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          {editing ? "Edit price" : "Add service price"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Centralized price list used by all mini services via TECHWOLF254_API.
        </p>
        <div className="mt-3 grid gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Service key</label>
            <Input value={serviceKey} onChange={(e) => setServiceKey(e.target.value)} placeholder="e.g. virtual_numbers" className="mt-1 font-mono" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Display name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Virtual Numbers" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Price (coins)</label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Continuation (coins)</label>
              <Input type="number" value={contPrice} onChange={(e) => setContPrice(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button disabled={saving} onClick={submit}>
              {editing ? "Save" : <><Plus className="mr-1 h-4 w-4" /> Add</>}
            </Button>
            {editing && <Button variant="ghost" onClick={reset}><X className="mr-1 h-4 w-4" /> Cancel</Button>}
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-card p-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          All prices ({items.length})
        </h3>
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Cont.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-[11px]">{p.service_key}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.price_coins}</TableCell>
                <TableCell>{p.continuation_price_coins}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.enabled ? "bg-win/20 text-win" : "bg-muted text-muted-foreground"}`}>
                    {p.enabled ? "live" : "off"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => toggle(p)}>{p.enabled ? "Disable" : "Enable"}</Button>
                    <Button size="icon" variant="secondary" onClick={() => startEdit(p)} aria-label="Edit"><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="destructive" onClick={() => remove(p.id)} aria-label="Delete"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

/* ---------- Child projects (hidden mini-service registry) ---------- */
type ChildProject = {
  id: string;
  slug: string;
  name: string;
  url: string;
  service_key: string | null;
  enabled: boolean;
};

const ChildProjectsPanel = () => {
  const [items, setItems] = useState<ChildProject[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("child_projects").select("*").order("created_at", { ascending: true });
    setItems((data || []) as ChildProject[]);
  };
  useEffect(() => { load(); }, []);

  const reset = () => { setEditing(null); setSlug(""); setName(""); setUrl(""); setServiceKey(""); };

  const submit = async () => {
    if (!slug.trim() || !name.trim() || !url.trim()) return toast.error("Slug, name, URL required");
    setSaving(true);
    const payload = {
      slug: slug.trim().toLowerCase(),
      name: name.trim(),
      url: url.trim(),
      service_key: serviceKey.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("child_projects").update(payload).eq("id", editing)
      : await supabase.from("child_projects").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Updated" : "Added");
    reset(); load();
  };
  const toggle = async (c: ChildProject) => {
    const { error } = await supabase.from("child_projects").update({ enabled: !c.enabled }).eq("id", c.id);
    if (error) return toast.error(error.message);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this child project?")) return;
    const { error } = await supabase.from("child_projects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const startEdit = (c: ChildProject) => {
    setEditing(c.id);
    setSlug(c.slug); setName(c.name); setUrl(c.url); setServiceKey(c.service_key || "");
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-card p-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          {editing ? "Edit child project" : "Register child project"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          URLs are kept hidden. Users open the service via /s/&lt;slug&gt; and never see the underlying link.
        </p>
        <div className="mt-3 grid gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Slug</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="virtual-numbers" className="mt-1 font-mono" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Display name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Virtual Numbers" className="mt-1" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Hidden URL</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://child.example.com" className="mt-1 font-mono" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Linked service key (optional)</label>
            <Input value={serviceKey} onChange={(e) => setServiceKey(e.target.value)} placeholder="virtual_numbers" className="mt-1 font-mono" />
          </div>
          <div className="flex gap-2">
            <Button disabled={saving} onClick={submit}>
              {editing ? "Save" : <><Plus className="mr-1 h-4 w-4" /> Add</>}
            </Button>
            {editing && <Button variant="ghost" onClick={reset}><X className="mr-1 h-4 w-4" /> Cancel</Button>}
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-card p-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Registered ({items.length})
        </h3>
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>Slug</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Service key</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-[11px]">{c.slug}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground">{c.service_key || "—"}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.enabled ? "bg-win/20 text-win" : "bg-muted text-muted-foreground"}`}>
                    {c.enabled ? "live" : "off"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => toggle(c)}>{c.enabled ? "Disable" : "Enable"}</Button>
                    <Button size="icon" variant="secondary" onClick={() => startEdit(c)} aria-label="Edit"><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="destructive" onClick={() => remove(c.id)} aria-label="Delete"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

/* ---------- helpers ---------- */
const formatDuration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

/* ---------- Messages ---------- */
type AdminMessage = {
  id: string;
  sender_label: string;
  title: string | null;
  body: string;
  recipient_id: string | null;
  created_at: string;
};

const MessagesPanel = ({ profiles }: { profiles: Profile[] }) => {
  const { userId } = useUserStore();
  const [mode, setMode] = useState<"broadcast" | "individual">("broadcast");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<AdminMessage[]>([]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setMessages((data || []) as AdminMessage[]);
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const filteredUsers = profiles.filter(
    (p) =>
      !search ||
      p.phone.includes(search) ||
      (p.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const phoneFor = (uid: string | null) =>
    uid ? profiles.find((p) => p.user_id === uid)?.phone || "Unknown user" : null;

  const send = async () => {
    if (!body.trim()) return toast.error("Message body is required");
    if (mode === "individual" && !recipient) return toast.error("Select a recipient");
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      sender_label: "TECHWOLFpro",
      title: title.trim() || null,
      body: body.trim(),
      recipient_id: mode === "broadcast" ? null : recipient,
      created_by: userId,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success(mode === "broadcast" ? "Broadcast sent to all users" : "Message sent");
    setTitle("");
    setBody("");
    setRecipient("");
    setSearch("");
    loadMessages();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Message deleted");
    loadMessages();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="bg-gradient-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary shadow-glow">
            <Send className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-display text-sm font-black">Compose message</h2>
            <p className="text-[10px] text-muted-foreground">Sent as TECHWOLFpro</p>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("broadcast")}
            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
              mode === "broadcast"
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Megaphone className="h-4 w-4" /> All users
          </button>
          <button
            type="button"
            onClick={() => setMode("individual")}
            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
              mode === "individual"
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserIcon className="h-4 w-4" /> Individual
          </button>
        </div>

        {mode === "individual" && (
          <div className="mb-3">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search user phone / email / ref"
                className="pl-9"
              />
            </div>
            <div className="max-h-40 overflow-auto rounded-lg border border-border/60">
              {filteredUsers.length === 0 && (
                <div className="p-3 text-center text-xs text-muted-foreground">No users found</div>
              )}
              {filteredUsers.slice(0, 50).map((p) => (
                <button
                  key={p.user_id}
                  type="button"
                  onClick={() => setRecipient(p.user_id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                    recipient === p.user_id ? "bg-primary/15 text-primary" : "hover:bg-muted/50"
                  }`}
                >
                  <span className="font-mono">{p.phone}</span>
                  <span className="text-muted-foreground">{p.email || "—"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="mb-2"
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message..."
          rows={5}
          className="mb-3"
        />
        <Button onClick={send} disabled={sending} className="w-full">
          <Send className="mr-2 h-4 w-4" />
          {sending ? "Sending..." : mode === "broadcast" ? "Send to all users" : "Send message"}
        </Button>
      </Card>

      <Card className="bg-gradient-card p-4">
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Sent messages
        </h2>
        <div className="max-h-[600px] space-y-2 overflow-auto">
          {messages.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">No messages yet</div>
          )}
          {messages.map((m) => (
            <div key={m.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    m.recipient_id
                      ? "bg-coin/20 text-coin"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  {m.recipient_id ? phoneFor(m.recipient_id) : "Broadcast — all users"}
                </span>
                <button
                  onClick={() => remove(m.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete message"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {m.title && <div className="text-sm font-bold">{m.title}</div>}
              <div className="whitespace-pre-wrap text-xs text-muted-foreground">{m.body}</div>
              <div className="mt-1 text-[10px] text-muted-foreground/70">
                {new Date(m.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Admin;
