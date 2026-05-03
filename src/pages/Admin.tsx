import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useUserStore } from "@/store/userStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users as UsersIcon,
  Radio,
  KeyRound,
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
} from "lucide-react";
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

type Profile = {
  user_id: string;
  phone: string;
  email: string | null;
  coins: number;
  games_played: number;
  bots_deployed: number;
  referral_code: string;
  banned: boolean;
  banned_at: string | null;
  last_active: string;
  created_at: string;
};

type Bot = {
  id: string;
  user_id: string;
  phone_number: string;
  code: string;
  status: string;
  last_active: string;
  disconnected_at: string | null;
  deployed_at: string;
};

type PairingLog = {
  id: string;
  user_id: string | null;
  phone_number: string;
  status: string;
  detail: string | null;
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
  | "sessions"
  | "users"
  | "pairing"
  | "activity"
  | "payments"
  | "services"
  | "pricing"
  | "child"
  | "settings";

const Admin = () => {
  const { isAdmin, userId } = useUserStore();
  const [section, setSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [pairing, setPairing] = useState<PairingLog[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [mpesa, setMpesa] = useState<MpesaTx[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});

  const load = async () => {
    const [{ data: p }, { data: b }, { data: pl }, { data: al }, { data: m }, { data: s }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("bots").select("*").order("deployed_at", { ascending: false }).limit(500),
      supabase.from("pairing_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("mpesa_transactions").select("id, phone, amount, status, mpesa_receipt, created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("admin_settings").select("key, value"),
    ]);
    setProfiles((p || []) as Profile[]);
    setBots((b || []) as Bot[]);
    setPairing((pl || []) as PairingLog[]);
    setActivity((al || []) as ActivityLog[]);
    setMpesa((m || []) as MpesaTx[]);
    const sObj: Record<string, unknown> = {};
    (s || []).forEach((row: { key: string; value: unknown }) => { sObj[row.key] = row.value; });
    setSettings(sObj);
  };

  useEffect(() => {
    if (!isAdmin) return;
    load();

    const channel = supabase
      .channel("admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bots" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "pairing_logs" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  if (!userId) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const totalUsers = profiles.length;
  const activeSessions = bots.filter((b) => b.status === "connected").length;
  const disconnectedSessions = bots.filter((b) => b.status !== "connected").length;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const navItems: Array<{ key: Section; label: string; icon: React.ElementType }> = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "sessions", label: "Sessions", icon: Radio },
    { key: "users", label: "Users", icon: UsersIcon },
    { key: "pairing", label: "Pairing logs", icon: KeyRound },
    { key: "activity", label: "Activity", icon: ActivityIcon },
    { key: "payments", label: "Payments", icon: CheckCircle2 },
    { key: "services", label: "Services", icon: Rocket },
    { key: "pricing", label: "Service pricing", icon: SettingsIcon },
    { key: "child", label: "Child projects", icon: Rocket },
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
            <div className="text-[10px] text-muted-foreground">TechwizardHub</div>
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
            <Dashboard
              totalUsers={totalUsers}
              activeSessions={activeSessions}
              disconnectedSessions={disconnectedSessions}
              activity={activity}
            />
          )}
          {section === "sessions" && (
            <SessionsPanel bots={bots} profiles={profiles} onChange={load} />
          )}
          {section === "users" && (
            <UsersPanel profiles={profiles} onChange={load} />
          )}
          {section === "pairing" && <PairingPanel logs={pairing} />}
          {section === "activity" && <ActivityPanel logs={activity} profiles={profiles} />}
          {section === "payments" && <PaymentsPanel mpesa={mpesa} />}
          {section === "services" && <ServicesPanel />}
          {section === "pricing" && <PricingPanel />}
          {section === "child" && <ChildProjectsPanel />}
          {section === "settings" && <SettingsPanel settings={settings} onSaved={load} />}
        </div>
      </main>
    </div>
  );
};

/* ---------- Dashboard ---------- */
const Dashboard = ({
  totalUsers, activeSessions, disconnectedSessions, activity,
}: {
  totalUsers: number; activeSessions: number; disconnectedSessions: number; activity: ActivityLog[];
}) => (
  <>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard label="Total users" value={totalUsers} icon={UsersIcon} tone="primary" />
      <StatCard label="Active sessions" value={activeSessions} icon={Radio} tone="win" />
      <StatCard label="Disconnected" value={disconnectedSessions} icon={Power} tone="lose" />
      <StatCard label="Events (24h)" value={activity.filter((a) => Date.now() - new Date(a.created_at).getTime() < 86400000).length} icon={ActivityIcon} tone="coin" />
    </div>
    <Card className="mt-4 bg-gradient-card p-4">
      <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Live activity
      </h2>
      <div className="max-h-[400px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activity.slice(0, 30).map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {a.event}
                  </span>
                </TableCell>
                <TableCell className="text-xs">{a.detail || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  </>
);

const StatCard = ({
  label, value, icon: Icon, tone,
}: { label: string; value: number; icon: React.ElementType; tone: "primary" | "win" | "lose" | "coin" }) => {
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
      <div className={`font-display text-3xl font-black ${toneMap[tone]}`}>{value.toLocaleString()}</div>
    </Card>
  );
};

/* ---------- Sessions ---------- */
const SessionsPanel = ({
  bots, profiles, onChange,
}: { bots: Bot[]; profiles: Profile[]; onChange: () => void }) => {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "connected" | "disconnected">("all");

  const phoneByUser = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach((p) => { m[p.user_id] = p.phone; });
    return m;
  }, [profiles]);

  const filtered = bots.filter((b) => {
    if (filter === "connected" && b.status !== "connected") return false;
    if (filter === "disconnected" && b.status === "connected") return false;
    if (!q) return true;
    const ql = q.toLowerCase();
    return b.phone_number.includes(q) || (phoneByUser[b.user_id] || "").includes(q) || b.code.toLowerCase().includes(ql);
  });

  const toggleOne = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((b) => b.id)));
  };

  const disconnect = async (id: string) => {
    const b = bots.find((x) => x.id === id);
    if (!b) return;
    const { error } = await supabase.from("bots")
      .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("activity_logs").insert({
      user_id: b.user_id, event: "disconnect",
      detail: `Session ${b.phone_number} disconnected by admin`,
    });
    toast.success("Disconnected");
    onChange();
  };

  const delSession = async (id: string) => {
    const b = bots.find((x) => x.id === id);
    if (!b) return;
    const { error } = await supabase.from("bots").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("activity_logs").insert({
      user_id: b.user_id, event: "session_deleted",
      detail: `Session ${b.phone_number} force-removed`,
    });
    toast.success("Deleted");
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    onChange();
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} sessions?`)) return;
    const ids = Array.from(selected);
    const rows = bots.filter((b) => ids.includes(b.id));
    const { error } = await supabase.from("bots").delete().in("id", ids);
    if (error) return toast.error(error.message);
    await supabase.from("activity_logs").insert(rows.map((r) => ({
      user_id: r.user_id, event: "session_deleted",
      detail: `Bulk delete: ${r.phone_number}`,
    })));
    toast.success(`Deleted ${ids.length} sessions`);
    setSelected(new Set());
    onChange();
  };

  return (
    <Card className="bg-gradient-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search phone / code" className="pl-9" />
        </div>
        <div className="flex gap-1 rounded-lg border border-border/60 p-1">
          {(["all", "connected", "disconnected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs capitalize ${
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <Button variant="destructive" size="sm" disabled={selected.size === 0} onClick={bulkDelete}>
          <Trash2 className="mr-1 h-4 w-4" /> Bulk delete ({selected.size})
        </Button>
      </div>

      <div className="max-h-[600px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox checked={selected.size > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deployed</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((b) => {
              const since = new Date(b.deployed_at).getTime();
              const duration = formatDuration(Date.now() - since);
              return (
                <TableRow key={b.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggleOne(b.id)} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{b.phone_number}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      b.status === "connected" ? "bg-win/20 text-win" : "bg-muted text-muted-foreground"
                    }`}>
                      {b.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {duration} ago
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(b.last_active).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {b.status === "connected" && (
                        <Button size="sm" variant="secondary" onClick={() => disconnect(b.id)}>
                          <Power className="mr-1 h-3 w-3" /> Disconnect
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => delSession(b.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

/* ---------- Users ---------- */
const UsersPanel = ({ profiles, onChange }: { profiles: Profile[]; onChange: () => void }) => {
  const [q, setQ] = useState("");
  const filtered = profiles.filter((p) =>
    !q || p.phone.includes(q) || (p.email || "").toLowerCase().includes(q.toLowerCase()) || p.referral_code.toLowerCase().includes(q.toLowerCase())
  );

  const adjustCoins = async (uid: string, delta: number) => {
    const row = profiles.find((x) => x.user_id === uid);
    if (!row) return;
    const newCoins = Math.max(0, row.coins + delta);
    const { error } = await supabase.from("profiles").update({ coins: newCoins }).eq("user_id", uid);
    if (error) return toast.error(error.message);
    await supabase.from("transactions").insert({
      user_id: uid, type: delta > 0 ? "purchase" : "game_loss",
      amount: delta, description: `Admin adjustment (${delta > 0 ? "+" : ""}${delta})`,
    });
    toast.success("Coins updated");
    onChange();
  };

  const toggleBan = async (p: Profile) => {
    const banned = !p.banned;
    const { error } = await supabase.from("profiles").update({
      banned, banned_at: banned ? new Date().toISOString() : null,
    }).eq("user_id", p.user_id);
    if (error) return toast.error(error.message);
    await supabase.from("activity_logs").insert({
      user_id: p.user_id, event: banned ? "ban" : "unban",
      detail: `${banned ? "Banned" : "Unbanned"} ${p.phone}`,
    });
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
              <TableHead>Bots</TableHead>
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
                <TableCell className="text-xs">{p.bots_deployed}</TableCell>
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

/* ---------- Pairing logs ---------- */
const PairingPanel = ({ logs }: { logs: PairingLog[] }) => (
  <Card className="bg-gradient-card p-4">
    <div className="max-h-[600px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Detail</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-mono text-xs">{l.phone_number}</TableCell>
              <TableCell>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  l.status === "success" ? "bg-win/20 text-win" : "bg-lose/20 text-lose"
                }`}>
                  {l.status}
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

/* ---------- Settings ---------- */
const SettingsPanel = ({ settings, onSaved }: { settings: Record<string, unknown>; onSaved: () => void }) => {
  const [shortcode, setShortcode] = useState("");
  const [till, setTill] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [passkey, setPasskey] = useState("");
  const [env, setEnv] = useState<"sandbox" | "production">("sandbox");
  const [maxSessions, setMaxSessions] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("");
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
    setMaxSessions(String(settings.max_sessions_per_user ?? ""));
    setMaxAttempts(String(settings.max_pairing_attempts_per_hour ?? ""));
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

      <Card className="bg-gradient-card p-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Max sessions per user
        </h3>
        <div className="mt-3 flex gap-2">
          <Input type="number" value={maxSessions} onChange={(e) => setMaxSessions(e.target.value)} />
          <Button disabled={saving} onClick={() => save("max_sessions_per_user", Number(maxSessions), "Max sessions")}>
            Save
          </Button>
        </div>
      </Card>

      <Card className="bg-gradient-card p-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Anti-spam: pairing attempts per hour
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Maximum pairing requests allowed per phone number per hour.
        </p>
        <div className="mt-3 flex gap-2">
          <Input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
          <Button disabled={saving} onClick={() => save("max_pairing_attempts_per_hour", Number(maxAttempts), "Max pairing attempts")}>
            Save
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
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="bot, vault" className="mt-1 font-mono" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="WhatsApp Bot" className="mt-1" />
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
            <Input value={serviceKey} onChange={(e) => setServiceKey(e.target.value)} placeholder="e.g. bot_deploy" className="mt-1 font-mono" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Display name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. WhatsApp Bot Deploy" className="mt-1" />
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
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="bot, paywall, vault" className="mt-1 font-mono" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Display name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="WhatsApp Bot" className="mt-1" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Hidden URL</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://child.example.com" className="mt-1 font-mono" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Linked service key (optional)</label>
            <Input value={serviceKey} onChange={(e) => setServiceKey(e.target.value)} placeholder="bot_deploy" className="mt-1 font-mono" />
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

export default Admin;
