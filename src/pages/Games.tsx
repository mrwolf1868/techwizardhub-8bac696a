import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Chess } from "chess.js";
import { ArrowRight } from "lucide-react";
import { AppLayout, PageSection } from "@/components/AppLayout";
import { GAMES, GameGrid, type GameId } from "@/components/CatalogCards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/userStore";
import { initialDraughts } from "@/lib/draughts";
import { entryFee } from "@/lib/matchFees";
import { toast } from "sonner";

type M = { id: string; game_type: string; stake: number; creator_id: string; opponent_id: string | null; status: string };

const Lobby = ({ game }: { game: GameId }) => {
  const nav = useNavigate();
  const info = GAMES.find((g) => g.id === game)!;
  const { syncFromSupabase, userId: me } = useUserStore();
  const [matches, setMatches] = useState<M[]>([]);
  const [stake, setStake] = useState("20");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("game_matches").select("id,game_type,stake,creator_id,opponent_id,status")
        .eq("game_type", game).in("status", ["waiting", "active"]).order("created_at", { ascending: false }).limit(50);
      setMatches((data as M[]) || []);
    };
    load();
    const ch = supabase.channel(`lobby-${game}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_matches" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [game]);

  const s = parseInt(stake, 10) || 0;

  const create = async () => {
    if (s < 1) return toast.error("Enter a valid stake");
    setBusy(true);
    const state = game === "chess" ? new Chess().fen() : initialDraughts();
    const { data, error } = await supabase.rpc("game_create_match", { _game: game, _stake: s, _state: state });
    setBusy(false);
    if (error) return toast.error(error.message);
    await syncFromSupabase();
    nav(`/games/match/${data}`);
  };
  const join = async (m: M) => {
    if (m.creator_id === me || m.opponent_id === me) return nav(`/games/match/${m.id}`);
    setBusy(true);
    const { error } = await supabase.rpc("game_join_match", { _id: m.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    await syncFromSupabase();
    nav(`/games/match/${m.id}`);
  };

  return (
    <PageSection title={info.title}>
      <div className="match-entry">
        <img src={info.image} alt={`${info.title} board`} />
        <div className="match-entry-copy">
          <span className="eyebrow">{info.tag}</span>
          <h2>Create a match</h2>
          <p className="text-sm text-muted-foreground">Pick your stake. An opponent joins with the same stake and the winner takes both stakes. A 5% entry fee is charged when you enter.</p>
          <label className="field-label" htmlFor="stake">Stake (KSh)</label>
          <Input id="stake" type="number" min={1} value={stake} onChange={(e) => setStake(e.target.value)} className="mt-2 h-12" />
          <p className="mt-2 text-xs text-muted-foreground">You pay {s + entryFee(s)} · Winner receives {s * 2}</p>
          <Button className="mt-4" disabled={busy} onClick={create}>Create match<ArrowRight /></Button>
        </div>
      </div>
      <div className="move-history">
        <h2>Open & my matches</h2>
        {matches.length === 0 && <p className="text-sm text-muted-foreground">No open matches yet — create one.</p>}
        {matches.map((m) => {
          const mine = m.creator_id === me || m.opponent_id === me;
          return (
            <div key={m.id} className="lobby-row">
              <div><strong>Stake KSh {m.stake}</strong><small>Pot KSh {m.stake * 2} · {m.status === "waiting" ? "Waiting for opponent" : "In progress"}</small></div>
              <Button size="sm" disabled={busy || (!mine && m.status !== "waiting")} onClick={() => join(m)} variant={mine ? "secondary" : "default"}>
                {mine ? "Open" : `Join · KSh ${m.stake + entryFee(m.stake)}`}
              </Button>
            </div>
          );
        })}
      </div>
    </PageSection>
  );
};

const Games = () => {
  const { game } = useParams<{ game?: string }>();
  if (game && game !== "chess" && game !== "draughts") return <Navigate to="/games" replace />;
  return (
    <AppLayout>
      {game ? <Lobby game={game as GameId} /> : <PageSection title="Games"><GameGrid /></PageSection>}
    </AppLayout>
  );
};
export default Games;
