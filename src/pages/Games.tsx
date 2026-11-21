import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Chess } from "chess.js";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/userStore";
import { initialDraughts } from "@/lib/draughts";
import { Crown, Grid3x3 } from "lucide-react";
import { toast } from "sonner";

type M = { id: string; game_type: string; stake: number; creator_id: string; opponent_id: string | null; status: string };

const Games = () => {
  const nav = useNavigate();
  const { syncFromSupabase } = useUserStore();
  const [me, setMe] = useState<string | null>(null);
  const [matches, setMatches] = useState<M[]>([]);
  const [stake, setStake] = useState("20");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("game_matches").select("id,game_type,stake,creator_id,opponent_id,status")
      .in("status", ["waiting", "active"]).order("created_at", { ascending: false }).limit(50);
    setMatches((data as M[]) || []);
  };
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
    load();
    const ch = supabase.channel(`lobby-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_matches" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const create = async (game: "chess" | "draughts") => {
    if (!me) return nav("/login");
    const s = parseInt(stake, 10);
    if (!s || s < 1) return toast.error("Enter a valid stake");
    setBusy(true);
    const state = game === "chess" ? new Chess().fen() : initialDraughts();
    const { data, error } = await supabase.rpc("game_create_match", { _game: game, _stake: s, _state: state });
    setBusy(false);
    if (error) return toast.error(error.message);
    await syncFromSupabase();
    nav(`/games/match/${data}`);
  };
  const join = async (m: M) => {
    if (!me) return nav("/login");
    if (m.creator_id === me || m.opponent_id === me) return nav(`/games/match/${m.id}`);
    setBusy(true);
    const { error } = await supabase.rpc("game_join_match", { _id: m.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    await syncFromSupabase();
    nav(`/games/match/${m.id}`);
  };

  return (
    <AppLayout>
      <h2 className="font-display text-2xl font-black">Games</h2>
      <p className="text-sm text-muted-foreground">Play real opponents. Winner takes the pot (5% platform fee).</p>

      <Card className="mt-5 border-primary/30 bg-gradient-card p-5 shadow-card">
        <label className="text-xs uppercase tracking-widest text-muted-foreground">Stake (coins)</label>
        <Input type="number" min={1} value={stake} onChange={(e) => setStake(e.target.value)} className="mt-1" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button disabled={busy} onClick={() => create("chess")} className="bg-gradient-primary font-bold shadow-glow">
            <Crown className="mr-1 h-4 w-4" /> New Chess
          </Button>
          <Button disabled={busy} onClick={() => create("draughts")} className="bg-gradient-magenta font-bold shadow-magenta">
            <Grid3x3 className="mr-1 h-4 w-4" /> New Draughts
          </Button>
        </div>
      </Card>

      <h3 className="mt-6 font-display text-lg font-bold">Open & my matches</h3>
      <div className="mt-2 grid gap-2">
        {matches.length === 0 && <p className="text-sm text-muted-foreground">No matches yet — create one.</p>}
        {matches.map((m) => {
          const mine = m.creator_id === me || m.opponent_id === me;
          return (
            <Card key={m.id} className="flex items-center justify-between p-3">
              <div>
                <div className="font-bold capitalize">{m.game_type}</div>
                <div className="text-xs text-muted-foreground">Stake {m.stake} · Pot {m.stake * 2} · {m.status}</div>
              </div>
              <Button size="sm" disabled={busy} onClick={() => join(m)} variant={mine ? "secondary" : "default"}>
                {mine ? "Open" : `Join (${m.stake})`}
              </Button>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 border-lose/30 bg-lose/10 p-4 text-sm text-muted-foreground">
        <strong className="text-lose">⚠ Risk warning:</strong> Staked coins go to the winner. Coins are virtual credits and cannot be withdrawn.
      </Card>
    </AppLayout>
  );
};
export default Games;
