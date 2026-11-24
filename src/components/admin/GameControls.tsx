import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { GAMES } from "@/components/CatalogCards";
import { APP_SETTINGS_KEY, useAppSettings } from "@/hooks/useAppSettings";

const heading = "font-display text-sm font-bold uppercase tracking-widest text-muted-foreground";
const label = "text-[10px] uppercase tracking-widest text-muted-foreground";

const useSaveSetting = () => {
  const queryClient = useQueryClient();
  return async (key: string, value: unknown, detail: string) => {
    const { error } = await supabase.from("admin_settings").upsert({ key, value: value as never, updated_at: new Date().toISOString() });
    if (error) { toast.error(error.message); return false; }
    await supabase.from("activity_logs").insert({ event: "setting_change", detail });
    await queryClient.invalidateQueries({ queryKey: APP_SETTINGS_KEY });
    return true;
  };
};

type MatchLite = { game_type: string; status: string; house_fee: number };

/** Lock or unlock each game and set the allowed stake range. */
export const GamesPanel = ({ matches }: { matches: MatchLite[] }) => {
  const { lockedGames, stakeLimits } = useAppSettings();
  const save = useSaveSetting();
  const [minStake, setMinStake] = useState(String(stakeLimits.min));
  const [maxStake, setMaxStake] = useState(String(stakeLimits.max));
  useEffect(() => { setMinStake(String(stakeLimits.min)); setMaxStake(String(stakeLimits.max)); }, [stakeLimits.min, stakeLimits.max]);

  const toggle = async (id: string, title: string) => {
    const next = lockedGames.includes(id) ? lockedGames.filter((g) => g !== id) : [...lockedGames, id];
    if (await save("locked_games", next, `${title} ${next.includes(id) ? "locked" : "unlocked"}`)) toast.success(`${title} ${next.includes(id) ? "locked" : "unlocked"}`);
  };

  const saveStakes = async () => {
    const min = Number.parseInt(minStake, 10), max = Number.parseInt(maxStake, 10);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max > 100000 || min > max) return toast.error("Use whole numbers from 1 to 100,000, with minimum not above maximum");
    if (await save("stake_limits", { min, max }, `Stake limits set to ${min}–${max}`)) toast.success("Stake limits saved");
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-card p-4">
        <h3 className={heading}>Game access</h3>
        <p className="mt-1 text-xs text-muted-foreground">A locked game cannot be searched for or joined. Matches already in progress can finish.</p>
        <div className="mt-4 grid gap-2">
          {GAMES.map((game) => {
            const locked = lockedGames.includes(game.id);
            const Icon = game.icon;
            const live = matches.filter((m) => m.game_type === game.id && (m.status === "active" || m.status === "waiting")).length;
            const fees = matches.filter((m) => m.game_type === game.id).reduce((t, m) => t + (m.house_fee || 0), 0);
            return (
              <div key={game.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <span className="grid h-9 w-9 place-items-center rounded-md bg-muted"><Icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{game.title}</div>
                  <div className="text-xs text-muted-foreground">{live} live or searching · KSh {fees.toLocaleString()} fees (recent)</div>
                </div>
                <span className={`text-xs font-semibold ${locked ? "text-lose" : "text-win"}`}>{locked ? "Locked" : "Open"}</span>
                <Button size="sm" variant={locked ? "default" : "outline"} onClick={() => void toggle(game.id, game.title)}>
                  {locked ? <><LockOpen className="mr-1 h-4 w-4" />Unlock</> : <><Lock className="mr-1 h-4 w-4" />Lock</>}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
      <Card className="bg-gradient-card p-4">
        <h3 className={heading}>Stake limits</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><label className={label} htmlFor="min-stake">Minimum stake (KSh)</label><Input id="min-stake" type="number" min={1} value={minStake} onChange={(e) => setMinStake(e.target.value)} className="mt-1" /></div>
          <div><label className={label} htmlFor="max-stake">Maximum stake (KSh)</label><Input id="max-stake" type="number" max={100000} value={maxStake} onChange={(e) => setMaxStake(e.target.value)} className="mt-1" /></div>
        </div>
        <Button className="mt-3" onClick={() => void saveStakes()}>Save stake limits</Button>
      </Card>
    </div>
  );
};

/** Minimum and maximum deposit and withdrawal amounts. */
export const WalletLimitsCard = () => {
  const { walletLimits } = useAppSettings();
  const save = useSaveSetting();
  const [v, setV] = useState({ min_deposit: "", max_deposit: "", min_withdraw: "", max_withdraw: "" });
  useEffect(() => {
    setV({ min_deposit: String(walletLimits.min_deposit), max_deposit: String(walletLimits.max_deposit), min_withdraw: String(walletLimits.min_withdraw), max_withdraw: String(walletLimits.max_withdraw) });
  }, [walletLimits.min_deposit, walletLimits.max_deposit, walletLimits.min_withdraw, walletLimits.max_withdraw]);

  const submit = async () => {
    const n = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Number.parseInt(x, 10)])) as Record<keyof typeof v, number>;
    if (Object.values(n).some((x) => !Number.isInteger(x) || x < 1)) return toast.error("Enter whole numbers of at least 1");
    if (n.max_deposit > 70000) return toast.error("M-Pesa allows deposits up to KSh 70,000");
    if (n.max_withdraw > 150000) return toast.error("Withdrawals can be at most KSh 150,000");
    if (n.min_deposit > n.max_deposit || n.min_withdraw > n.max_withdraw) return toast.error("A minimum cannot be above its maximum");
    if (await save("wallet_limits", n, `Wallet limits: deposit ${n.min_deposit}–${n.max_deposit}, withdraw ${n.min_withdraw}–${n.max_withdraw}`)) toast.success("Deposit and withdrawal limits saved");
  };

  const field = (key: keyof typeof v, text: string) => (
    <div><label className={label} htmlFor={key}>{text}</label><Input id={key} type="number" min={1} value={v[key]} onChange={(e) => setV((s) => ({ ...s, [key]: e.target.value }))} className="mt-1" /></div>
  );

  return (
    <Card className="bg-gradient-card p-4">
      <h3 className={heading}>Deposit and withdrawal limits</h3>
      <p className="mt-1 text-xs text-muted-foreground">Players see these amounts on the Deposit page, and the server refuses anything outside them.</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {field("min_deposit", "Minimum deposit (KSh)")}
        {field("max_deposit", "Maximum deposit (KSh)")}
        {field("min_withdraw", "Minimum withdrawal (KSh)")}
        {field("max_withdraw", "Maximum withdrawal (KSh)")}
      </div>
      <Button className="mt-3" onClick={() => void submit()}>Save limits</Button>
    </Card>
  );
};

/** Banner shown at the top of every player page. */
export const AnnouncementCard = () => {
  const { announcement } = useAppSettings();
  const save = useSaveSetting();
  const [text, setText] = useState(announcement.text);
  const [enabled, setEnabled] = useState(announcement.enabled);
  useEffect(() => { setText(announcement.text); setEnabled(announcement.enabled); }, [announcement.text, announcement.enabled]);
  const submit = async () => {
    if (enabled && !text.trim()) return toast.error("Write the announcement first");
    if (await save("site_announcement", { enabled, text: text.trim().slice(0, 200) }, enabled ? "Announcement shown" : "Announcement hidden")) toast.success("Announcement saved");
  };
  return (
    <Card className="bg-gradient-card p-4">
      <h3 className={heading}>Site announcement</h3>
      <p className="mt-1 text-xs text-muted-foreground">A short notice at the top of every page, for example maintenance or a new game.</p>
      <Textarea className="mt-3" maxLength={200} value={text} onChange={(e) => setText(e.target.value)} placeholder="Connect Four is now live — try it today!" />
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm"><Switch checked={enabled} onCheckedChange={setEnabled} />Show to players</label>
        <Button onClick={() => void submit()}>Save announcement</Button>
      </div>
    </Card>
  );
};

type ChatRow = { id: string; room: string; user_id: string; body: string; created_at: string };

/** Recent chat from every game lobby and match, with delete. */
export const ChatModerationPanel = ({ phoneFor }: { phoneFor: (userId: string) => string }) => {
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    const { data } = await supabase.from("game_chat_messages").select("id,room,user_id,body,created_at").order("created_at", { ascending: false }).limit(200);
    setRows((data || []) as ChatRow[]);
    setLoading(false);
  };
  useEffect(() => {
    void load();
    const channel = supabase.channel(`admin-chat-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_chat_messages" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);
  const remove = async (id: string) => {
    const { error } = await supabase.from("game_chat_messages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success("Message removed");
  };
  const roomName = (room: string) => room.startsWith("lobby:") ? `${GAMES.find((g) => `lobby:${g.id}` === room)?.title ?? room} lobby` : `Match ${room.slice(-4).toUpperCase()}`;
  return (
    <Card className="bg-gradient-card p-4">
      <h3 className={heading}>Game chat</h3>
      <p className="mt-1 text-xs text-muted-foreground">Latest 200 messages from lobbies and matches. Remove anything abusive; ban repeat offenders from Users.</p>
      <div className="mt-3 divide-y divide-border/60">
        {loading && <p className="py-3 text-sm text-muted-foreground">Loading…</p>}
        {!loading && rows.length === 0 && <p className="py-3 text-sm text-muted-foreground">No chat messages yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-start gap-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted-foreground">{roomName(r.room)} · {phoneFor(r.user_id)} · {new Date(r.created_at).toLocaleString()}</div>
              <div className="break-words text-sm">{r.body}</div>
            </div>
            <Button size="icon" variant="ghost" aria-label="Delete message" onClick={() => void remove(r.id)}><Trash2 className="h-4 w-4 text-lose" /></Button>
          </div>
        ))}
      </div>
    </Card>
  );
};
