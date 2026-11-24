import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { Chess, Square } from "chess.js";
import { ArrowLeft, Copy, Flag, Search, Trophy, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChessPiece, DraughtPiece } from "@/components/GamePieces";
import { GameChat } from "@/components/GameChat";
import { C4_COLS, c4Drop, gameName, gridOutcome, tttPlay } from "@/lib/games";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/userStore";
import { applyMove, legalMoves, Move, Side } from "@/lib/draughts";
import { entryCost, entryFee, winnerPayout } from "@/lib/matchFees";

type M = { id: string; game_type: string; stake: number; creator_id: string; opponent_id: string | null; invited_user_id: string | null; status: string; state: string | null; turn: string | null; winner_id: string | null; house_fee: number; match_mode: "open" | "friend" | "challenge"; invite_code: string | null };
const tag = (id: string | null) => (id ? id.slice(-4).toUpperCase() : "—");

const GameMatch = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const syncFromSupabase = useUserStore((s) => s.syncFromSupabase);
  const me = useUserStore((s) => s.userId);
  const [m, setM] = useState<M | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("game_matches").select("*").eq("id", id).maybeSingle();
    setM(data as M | null);
    setMatchLoading(false);
    if (data && data.status !== "waiting") void syncFromSupabase();
  }, [id, syncFromSupabase]);

  useEffect(() => {
    if (!id) { setMatchLoading(false); return; }
    setMatchLoading(true);
    void load();
    const ch = supabase.channel(`match-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_matches", filter: `id=eq.${id}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [id, load]);

  const isCreator = !!m && me === m.creator_id;
  const isPlayer = !!m && (isCreator || me === m.opponent_id);
  const searching = !!m && m.status === "waiting" && isCreator;
  const playing = !!m && m.status === "active" && isPlayer;
  const guarded = (searching || playing) && !leaving;

  // Ask before leaving a search or an active match (in-app links, back button, and closing the tab).
  const blocker = useBlocker(({ currentLocation, nextLocation }) => guarded && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => { if (blocker.state === "blocked") setConfirmOpen(true); }, [blocker.state]);
  useEffect(() => {
    if (!guarded) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [guarded]);

  const side: Side = isCreator ? "w" : "b";
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
    if (m.game_type === "tictactoe" || m.game_type === "connect4") {
      const next = m.game_type === "tictactoe" ? tttPlay(m.state, i, side) : c4Drop(m.state, i % C4_COLS, side);
      if (!next) return;
      void send(next, gridOutcome(m.game_type, next));
      return;
    }
    if (chess) {
      const p = chess.get(sqName(i));
      if (p && p.color === side) { setSel(i); return; }
      if (sel === null) return;
      try { chess.move({ from: sqName(sel), to: sqName(i), promotion: "q" }); } catch { setSel(null); return; }
      void send(chess.fen(), chess.isCheckmate() ? "win" : chess.isDraw() || chess.isStalemate() ? "draw" : "");
    } else {
      if (m.state[i] !== "." && m.state[i].toLowerCase() === side) { setSel(i); return; }
      const mv = dMoves.find((x: Move) => x.from === sel && x.path[x.path.length - 1] === i);
      if (!mv) return;
      const next = applyMove(m.state, mv);
      const opp: Side = side === "w" ? "b" : "w";
      void send(next, legalMoves(next, opp).length === 0 ? "win" : "");
    }
  };

  const stay = () => {
    setConfirmOpen(false);
    if (blocker.state === "blocked") blocker.reset();
  };

  const joinThis = async () => {
    if (!m) return;
    setJoining(true);
    const { error } = await supabase.rpc("game_join_match", { _id: m.id });
    setJoining(false);
    if (error) return toast.error(error.message.includes("not available") ? "Someone else already joined this match" : error.message);
    await syncFromSupabase();
    void load();
  };

  const confirmLeave = async () => {
    if (!m) return;
    setLeaving(true);
    const { error } = await supabase.rpc("game_resign", { _id: m.id });
    if (error) {
      setLeaving(false);
      setConfirmOpen(false);
      if (blocker.state === "blocked") blocker.reset();
      return toast.error(error.message);
    }
    await syncFromSupabase();
    setConfirmOpen(false);
    toast.success(searching ? "Search cancelled. Nothing was charged." : `You quit. Your opponent received KSh ${winnerPayout(m.stake)}.`);
    if (blocker.state === "blocked") blocker.proceed();
    else void load();
  };

  if (matchLoading) return <AppLayout><section className="page-section"><div className="match-card text-sm text-muted-foreground">Loading match…</div></section></AppLayout>;
  if (!m) return <AppLayout><section className="page-section"><p className="text-sm text-muted-foreground">This match is unavailable or has ended.</p><Button asChild className="mt-4"><Link to="/games">Back to games</Link></Button></section></AppLayout>;

  const gameTitle = gameName(m.game_type);
  const grid = m.game_type === "tictactoe" || m.game_type === "connect4";
  const viewing = m.status === "waiting" && !isCreator;
  const canJoin = viewing && (m.match_mode === "open" || (m.match_mode === "challenge" && m.invited_user_id === me));
  const cells = Array.from({ length: 64 }, (_, k) => (flip ? 63 - k : k));
  const targets = new Set<number>();
  if (sel !== null && myTurn) {
    if (chess) chess.moves({ square: sqName(sel), verbose: true }).forEach((x) => targets.add("abcdefgh".indexOf(x.to[0]) + (8 - +x.to[1]) * 8));
    else dMoves.filter((x) => x.from === sel).forEach((x) => targets.add(x.path[x.path.length - 1]));
  }

  const won = m.status === "finished" && m.winner_id === me;
  const lost = m.status === "finished" && !!m.winner_id && m.winner_id !== me;
  const status = m.status === "waiting"
    ? isCreator
      ? m.match_mode === "challenge" ? "Waiting for the invited player to accept" : m.match_mode === "friend" ? "Waiting for your friend to join with the code" : "Searching for an opponent"
      : "This match is waiting for players"
    : m.status === "cancelled" ? "Match cancelled"
    : m.status === "finished" ? (m.winner_id ? (won ? `You won KSh ${winnerPayout(m.stake)}` : "You lost this match") : "Draw — stakes returned")
    : myTurn ? "Your move" : "Opponent's move";

  const mySwatch = side === "w" ? "light" : "dark";
  const oppSwatch = side === "w" ? "dark" : "light";
  const opponentId = isCreator ? m.opponent_id : m.creator_id;

  return (
    <AppLayout>
      <section className="page-section">
        <button type="button" onClick={() => navigate(`/games/${m.game_type}`)} className="back-button inline-flex items-center gap-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to {gameTitle}
        </button>

        {viewing ? (
          <div className="match-search">
            <div className="search-animation"><span /><span /><span /><Search /></div>
            <h2>Player {tag(m.creator_id)} is looking for an opponent</h2>
            <p>{gameTitle} · Stake KSh {m.stake} · Winner gets KSh {winnerPayout(m.stake)}. You pay KSh {entryCost(m.stake)} (stake + KSh {entryFee(m.stake)} entry fee) only if you join.</p>
            {canJoin ? (
              <Button disabled={joining} onClick={() => void joinThis()}><UserPlus />{joining ? "Joining…" : `Join match · KSh ${entryCost(m.stake)}`}</Button>
            ) : (
              <p className="text-sm text-muted-foreground">{m.match_mode === "friend" ? "This is a private friend match. Ask the player for the code." : "This invitation is for another player."}</p>
            )}
            <Button variant="outline" onClick={() => navigate(`/games/${m.game_type}`)}>Back to lobby</Button>
          </div>
        ) : searching ? (
          <div className="match-search">
            <div className="search-animation"><span /><span /><span /><Search /></div>
            <h2>{status}</h2>
            <p>{gameTitle} · Stake KSh {m.stake}. Nothing is charged until an opponent joins. Players who are online have been notified.</p>
            {m.match_mode === "friend" && m.invite_code && (
              <div className="invite-code-display">
                <div><small>Friend code</small><strong>{m.invite_code}</strong></div>
                <Button variant="outline" size="icon" aria-label="Copy friend code" title="Copy friend code"
                  onClick={() => void navigator.clipboard.writeText(m.invite_code ?? "").then(() => toast.success("Code copied"), () => toast.error("Could not copy code"))}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="search-track"><progress aria-label="Searching for an opponent" /></div>
            <Button variant="outline" onClick={() => setConfirmOpen(true)}>Cancel search</Button>
          </div>
        ) : (
          <div className="live-match mt-4">
            <div>
              <div className={`player-strip ${m.status === "active" && m.turn === opponentId ? "is-turn" : ""}`}>
                <span><span className="player-swatch-piece" aria-hidden="true"><DraughtPiece color={oppSwatch === "light" ? "w" : "b"} king={false} /></span><span><strong>Opponent</strong><br /><small>Player {tag(opponentId)}</small></span></span>
                {m.status === "active" && m.turn === opponentId && <span className="turn-pill">Thinking…</span>}
              </div>
              <div className={`board-frame ${grid ? `grid-frame ${m.game_type}-frame` : ""}`}>
                {grid ? (
                  <div className={m.game_type === "tictactoe" ? "ttt-board" : "c4-board"}>
                    {(m.state || "").split("").map((c, i) => (
                      <button key={i} type="button" onClick={() => click(i)} disabled={!myTurn}
                        aria-label={m.game_type === "tictactoe" ? `Cell ${i + 1}` : `Column ${(i % C4_COLS) + 1}`}
                        className={`grid-cell ${c === "." && myTurn ? "is-open" : ""}`}>
                        {c !== "." && <DraughtPiece color={c as "w" | "b"} king={false} />}
                      </button>
                    ))}
                  </div>
                ) : (
                <div className="play-board">
                  {cells.map((i) => {
                    const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
                    let piece: React.ReactNode = null;
                    if (chess) {
                      const p = chess.get(sqName(i));
                      if (p) piece = <ChessPiece type={p.type} color={p.color} />;
                    } else if (m.state && m.state[i] !== ".") {
                      const p = m.state[i];
                      piece = <DraughtPiece color={p.toLowerCase() as "w" | "b"} king={p === p.toUpperCase()} />;
                    }
                    return (
                      <button key={i} type="button" onClick={() => click(i)} aria-label={sqName(i)}
                        className={`board-square grid place-items-center ${dark ? "square-dark" : "square-light"} ${sel === i ? "square-selected" : ""} ${targets.has(i) ? "square-target" : ""}`}>
                        {piece}
                      </button>
                    );
                  })}
                </div>
                )}
              </div>
              <div className={`player-strip ${myTurn ? "is-turn" : ""}`}>
                <span><span className="player-swatch-piece" aria-hidden="true"><DraughtPiece color={mySwatch === "light" ? "w" : "b"} king={false} /></span><span><strong>You</strong><br /><small>{side === "w" ? "Cream · moves first" : "Black"}</small></span></span>
                {myTurn && <span className="turn-pill">Your move</span>}
              </div>
            </div>

            <aside className="match-sidebar">
              <div className="match-card">
                <h3>{gameTitle}</h3>
                <div className={`status-line ${won ? "win" : lost ? "lose" : ""}`}>{won && <Trophy className="h-4 w-4" />}{status}</div>
                {chess?.inCheck() && m.status === "active" && <p className="mt-2 text-sm font-semibold text-lose">Check</p>}
                {m.status === "active" && <p className="mt-2 text-xs text-muted-foreground">{m.game_type === "tictactoe" ? "Tap an empty square. Three in a row wins." : m.game_type === "connect4" ? "Tap a column to drop your disc. Four in a line wins." : "Tap one of your pieces, then a highlighted square."}</p>}
              </div>
              <div className="match-card">
                <h3>Stake and prize</h3>
                <div className="prize-grid">
                  <div><small>Stake</small><strong>KSh {m.stake}</strong></div>
                  <div><small>Entry fee</small><strong>KSh {entryFee(m.stake)}</strong></div>
                  <div className="prize-win"><small>Winner gets</small><strong>KSh {winnerPayout(m.stake)}</strong></div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{m.status === "cancelled" ? "This match did not start." : `Each player pays KSh ${entryCost(m.stake)} when the match starts. A draw returns both stakes.`}</p>
              </div>
              {playing && (
                <Button variant="destructive" className="mt-3 w-full" onClick={() => setConfirmOpen(true)}><Flag /> Quit match</Button>
              )}
              {isPlayer && m.status !== "waiting" && <GameChat room={`match:${m.id}`} title="Match chat" labelFor={() => "Opponent"} />}
              {m.status !== "active" && m.status !== "waiting" && (
                <Button className="mt-3 w-full" onClick={() => navigate(`/games/${m.game_type}`)}>Play again</Button>
              )}
            </aside>
          </div>
        )}
      </section>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => { if (!open) stay(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{searching ? "Stop searching for an opponent?" : "Quit this match?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {searching
                ? "Your match search will be cancelled. Nothing has been charged, so your balance stays the same."
                : `Warning: quitting counts as a loss. Your opponent will immediately receive both stakes (KSh ${winnerPayout(m.stake)}), and your KSh ${entryCost(m.stake)} entry will not be returned. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={stay}>{searching ? "Keep searching" : "Keep playing"}</AlertDialogCancel>
            <AlertDialogAction className={searching ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"} disabled={leaving}
              onClick={(event) => { event.preventDefault(); void confirmLeave(); }}>
              {searching ? "Cancel search" : "I agree, quit and pay opponent"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};
export default GameMatch;
