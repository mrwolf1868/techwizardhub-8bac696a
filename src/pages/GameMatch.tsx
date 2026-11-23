import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Chess, Square } from "chess.js";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/userStore";
import { applyMove, legalMoves, Move, Side } from "@/lib/draughts";
import { ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";

type M = { id: string; game_type: string; stake: number; creator_id: string; opponent_id: string | null; invited_user_id: string | null; status: string; state: string | null; turn: string | null; winner_id: string | null; house_fee: number; match_mode: "open" | "friend" | "challenge"; invite_code: string | null };
const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

const GameMatch = () => {
  const { id } = useParams();
  const { syncFromSupabase } = useUserStore();
  const [me, setMe] = useState<string | null>(null);
  const [m, setM] = useState<M | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setMatchLoading(true);
    const load = async () => {
      if (!id) {
        setMatchLoading(false);
        return;
      }
      const { data } = await supabase.from("game_matches").select("*").eq("id", id).maybeSingle();
      if (!active) return;
      setM(data as M | null);
      setMatchLoading(false);
      if (data?.status === "finished") void syncFromSupabase();
    };
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setMe(data.user?.id ?? null);
    });
    void load();
    if (!id) return () => { active = false; };
    const ch = supabase.channel(`match-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_matches", filter: `id=eq.${id}` }, () => { void load(); }).subscribe();
    return () => { active = false; void supabase.removeChannel(ch); };
  }, [id, syncFromSupabase]);

  const side: Side = m && me === m.creator_id ? "w" : "b";
  const flip = side === "b";
  const myTurn = !!m && m.status === "active" && m.turn === me;

  const dMoves = useMemo(() => (m?.game_type === "draughts" && m.state ? legalMoves(m.state, side) : []), [m, side]);
  const chess = useMemo(() => (m?.game_type === "chess" && m.state ? new Chess(m.state) : null), [m]);

  const send = async (state: string, result: string) => {
    if (!m) return;
    setSel(null);
    const { error } = await supabase.rpc("game_move", { _id: m.id, _state: state, _result: result });
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
    if (!confirm(m?.status === "waiting" ? "Cancel and refund your stake? The entry fee is not refunded." : "Quit? Your opponent wins the pot.")) return;
    if (!m) return;
    const { error } = await supabase.rpc("game_resign", { _id: m.id });
    if (error) toast.error(error.message); else syncFromSupabase();
  };

  if (matchLoading) return <AppLayout><p className="text-sm text-muted-foreground">Preparing match…</p></AppLayout>;
  if (!m) return <AppLayout><section className="page-section"><p className="text-sm text-muted-foreground">This match is unavailable or has ended.</p><Button asChild className="mt-4"><Link to="/games">Back to games</Link></Button></section></AppLayout>;

  const cells = Array.from({ length: 64 }, (_, k) => (flip ? 63 - k : k));
  const targets = new Set<number>();
  if (sel !== null && myTurn) {
    if (chess) chess.moves({ square: sqName(sel), verbose: true }).forEach((x) => targets.add("abcdefgh".indexOf(x.to[0]) + (8 - +x.to[1]) * 8));
    else dMoves.filter((x) => x.from === sel).forEach((x) => targets.add(x.path[x.path.length - 1]));
  }

  const status = m.status === "waiting"
    ? m.match_mode === "challenge" ? (m.invited_user_id === me ? "You have a match invitation. Accept it from the lobby." : "Invitation sent — waiting for the player to accept…")
      : m.match_mode === "friend" ? "Waiting for your friend to join with the code…" : "Waiting for an opponent to join…"
    : m.status === "cancelled" ? "Match cancelled — stake refunded."
    : m.status === "finished" ? (m.winner_id ? (m.winner_id === me ? `You won KSh ${m.stake * 2}! 🎉` : "You lost this match.") : "Draw — stakes refunded.")
    : myTurn ? "Your move" : "Opponent's move…";

  return (
    <AppLayout>
      <section className="page-section">
      <Link to={`/games/${m.game_type}`} className="back-button inline-flex items-center gap-2 text-sm">
        <ArrowLeft className="h-4 w-4" /> Back to {m.game_type === "chess" ? "Chess" : "Draft"}
      </Link>
      <Card className="mx-auto max-w-xl p-4">
        <div className="flex items-center justify-between">
          <div className="font-display text-lg font-black">{m.game_type === "chess" ? "Chess" : "Draft"}</div>
          <div className="text-xs text-muted-foreground">Pot KSh {m.stake * 2}</div>
        </div>
        <div className="mt-1 text-sm font-semibold text-primary">{status}</div>
        {chess?.inCheck() && m.status === "active" && <div className="text-xs text-lose">Check!</div>}

        <div className="play-board mt-3">
          {cells.map((i) => {
            const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
            let piece: React.ReactNode = null;
            if (chess) {
              const p = chess.get(sqName(i));
              if (p) piece = <span className={`text-3xl leading-none ${p.color === "w" ? "text-[hsl(var(--piece-light))] [text-shadow:0_0_2px_hsl(var(--piece-outline))]" : "text-[hsl(var(--piece-dark))]"}`}>{GLYPH[p.type]}</span>;
            } else if (m.state && m.state[i] !== ".") {
              const p = m.state[i];
              piece = <span className={`draft-piece ${p.toLowerCase() === "w" ? "piece-light" : "piece-dark"}`}>{p === p.toUpperCase() ? "♛" : ""}</span>;
            }
            return (
              <button key={i} onClick={() => click(i)}
                className={`board-square grid place-items-center ${dark ? "square-dark" : "square-light"} ${sel === i ? "square-selected" : ""} ${targets.has(i) ? "square-target" : ""}`}>
                {piece}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">You play {side === "w" ? (chess ? "White" : "Light") : (chess ? "Black" : "Dark")}. Tap a piece, then a highlighted square.</p>
        {m.match_mode === "friend" && m.invite_code && m.creator_id === me && m.status === "waiting" && (
          <div className="invite-code-display mt-3">
            <div><small>Friend code</small><strong>{m.invite_code}</strong></div>
            <Button variant="outline" size="icon" aria-label="Copy friend code" title="Copy friend code"
              onClick={() => void navigator.clipboard.writeText(m.invite_code ?? "").then(() => toast.success("Code copied"), () => toast.error("Could not copy code"))}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}
        {(m.status === "waiting" || m.status === "active") && (me === m.creator_id || me === m.opponent_id) && (
          <Button variant="destructive" className="mt-3 w-full" onClick={resign}>{m.status === "waiting" ? "Cancel match" : "Quit match"}</Button>
        )}
      </Card>
      </section>
    </AppLayout>
  );
};
export default GameMatch;
