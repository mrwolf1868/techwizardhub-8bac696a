import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Chess, Square } from "chess.js";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/userStore";
import { applyMove, legalMoves, Move, Side } from "@/lib/draughts";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type M = { id: string; game_type: string; stake: number; creator_id: string; opponent_id: string | null; status: string; state: string | null; turn: string | null; winner_id: string | null; house_fee: number };
const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

const GameMatch = () => {
  const { id } = useParams();
  const { syncFromSupabase } = useUserStore();
  const [me, setMe] = useState<string | null>(null);
  const [m, setM] = useState<M | null>(null);
  const [sel, setSel] = useState<number | null>(null);

  const load = async () => {
    const { data } = await supabase.from("game_matches").select("*").eq("id", id!).maybeSingle();
    setM(data as M);
    if (data?.status === "finished") syncFromSupabase();
  };
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
    load();
    const ch = supabase.channel(`match-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_matches", filter: `id=eq.${id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const side: Side = m && me === m.creator_id ? "w" : "b";
  const flip = side === "b";
  const myTurn = !!m && m.status === "active" && m.turn === me;

  const dMoves = useMemo(() => (m?.game_type === "draughts" && m.state ? legalMoves(m.state, side) : []), [m, side]);
  const chess = useMemo(() => (m?.game_type === "chess" && m.state ? new Chess(m.state) : null), [m]);

  const send = async (state: string, result: string) => {
    setSel(null);
    const { error } = await supabase.rpc("game_move", { _id: m!.id, _state: state, _result: result });
    if (error) toast.error(error.message);
  };

  const sqName = (i: number) => ("abcdefgh"[i % 8] + (8 - Math.floor(i / 8))) as Square;

  const click = (i: number) => {
    if (!myTurn || !m?.state) return;
    if (chess) {
      const p = chess.get(sqName(i));
      if (sel === null || (p && p.color === side)) { if (p && p.color === side) setSel(i); return; }
      try {
        chess.move({ from: sqName(sel), to: sqName(i), promotion: "q" });
      } catch { setSel(null); return; }
      send(chess.fen(), chess.isCheckmate() ? "win" : chess.isDraw() || chess.isStalemate() ? "draw" : "");
    } else {
      if (m.state[i] !== "." && m.state[i].toLowerCase() === side) { setSel(i); return; }
      const mv = dMoves.find((x: Move) => x.from === sel && x.path[x.path.length - 1] === i);
      if (!mv) return;
      const next = applyMove(m.state, mv);
      const opp: Side = side === "w" ? "b" : "w";
      send(next, legalMoves(next, opp).length === 0 ? "win" : "");
    }
  };

  const resign = async () => {
    if (!confirm(m?.status === "waiting" ? "Cancel and refund your stake?" : "Resign? Your opponent wins the pot.")) return;
    const { error } = await supabase.rpc("game_resign", { _id: m!.id });
    if (error) toast.error(error.message); else syncFromSupabase();
  };

  if (!m) return <AppLayout><p className="text-sm text-muted-foreground">Loading match…</p></AppLayout>;

  const cells = Array.from({ length: 64 }, (_, k) => (flip ? 63 - k : k));
  const targets = new Set<number>();
  if (sel !== null && myTurn) {
    if (chess) chess.moves({ square: sqName(sel), verbose: true }).forEach((x) => targets.add("abcdefgh".indexOf(x.to[0]) + (8 - +x.to[1]) * 8));
    else dMoves.filter((x) => x.from === sel).forEach((x) => targets.add(x.path[x.path.length - 1]));
  }

  const status = m.status === "waiting" ? "Waiting for an opponent to join…"
    : m.status === "cancelled" ? "Match cancelled — stake refunded."
    : m.status === "finished" ? (m.winner_id ? (m.winner_id === me ? `You won ${m.stake * 2 - m.house_fee} coins! 🎉` : "You lost this match.") : "Draw — stakes refunded.")
    : myTurn ? "Your move" : "Opponent's move…";

  return (
    <AppLayout>
      <Link to="/games" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to games
      </Link>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="font-display text-lg font-black capitalize">{m.game_type}</div>
          <div className="text-xs text-muted-foreground">Pot {m.stake * 2} coins</div>
        </div>
        <div className="mt-1 text-sm font-semibold text-primary">{status}</div>
        {chess?.inCheck() && m.status === "active" && <div className="text-xs text-lose">Check!</div>}

        <div className="mt-3 grid aspect-square w-full grid-cols-8 overflow-hidden rounded-lg border border-border">
          {cells.map((i) => {
            const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
            let piece: React.ReactNode = null;
            if (chess) {
              const p = chess.get(sqName(i));
              if (p) piece = <span className={`text-3xl leading-none ${p.color === "w" ? "text-foreground drop-shadow" : "text-background [text-shadow:0_0_2px_hsl(var(--foreground))]"}`}>{GLYPH[p.type]}</span>;
            } else if (m.state && m.state[i] !== ".") {
              const p = m.state[i];
              piece = <span className={`grid h-4/5 w-4/5 place-items-center rounded-full border-2 text-xs font-black ${p.toLowerCase() === "w" ? "border-foreground/40 bg-foreground text-background" : "border-accent bg-accent text-accent-foreground"}`}>{p === p.toUpperCase() ? "♛" : ""}</span>;
            }
            return (
              <button key={i} onClick={() => click(i)}
                className={`grid place-items-center ${dark ? "bg-primary/40" : "bg-muted"} ${sel === i ? "ring-2 ring-inset ring-coin" : ""} ${targets.has(i) ? "ring-2 ring-inset ring-win" : ""}`}>
                {piece}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">You play {side === "w" ? (chess ? "White" : "Light") : (chess ? "Black" : "Dark")}. Tap a piece, then a highlighted square.</p>
        {(m.status === "waiting" || m.status === "active") && (me === m.creator_id || me === m.opponent_id) && (
          <Button variant="destructive" className="mt-3 w-full" onClick={resign}>{m.status === "waiting" ? "Cancel match" : "Resign"}</Button>
        )}
      </Card>
    </AppLayout>
  );
};
export default GameMatch;
