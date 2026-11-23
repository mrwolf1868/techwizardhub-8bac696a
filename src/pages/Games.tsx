import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Chess } from "chess.js";
import { ArrowRight, Copy, UsersRound } from "lucide-react";
import { AppLayout, PageSection } from "@/components/AppLayout";
import { GAMES, GameGrid, type GameId } from "@/components/CatalogCards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/userStore";
import { initialDraughts } from "@/lib/draughts";
import { entryCost, entryFee } from "@/lib/matchFees";
import { toast } from "sonner";

type MatchMode = "open" | "friend" | "challenge";
type LobbyMode = "open" | "friend" | "online";
type M = {
  id: string;
  game_type: string;
  stake: number;
  creator_id: string;
  opponent_id: string | null;
  invited_user_id: string | null;
  status: string;
  match_mode: MatchMode;
  invite_code: string | null;
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const createFriendCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => CODE_CHARS[byte % CODE_CHARS.length]).join("");
};

const Lobby = ({ game }: { game: GameId }) => {
  const nav = useNavigate();
  const info = GAMES.find((item) => item.id === game);
  const { syncFromSupabase, userId: me } = useUserStore();
  const [matches, setMatches] = useState<M[]>([]);
  const [matchesLoaded, setMatchesLoaded] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState<string[]>([]);
  const [mode, setMode] = useState<LobbyMode>("open");
  const [stake, setStake] = useState("20");
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [codeToJoin, setCodeToJoin] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshMatches = useCallback(async () => {
    const { data } = await supabase
      .from("game_matches")
      .select("id,game_type,stake,creator_id,opponent_id,invited_user_id,status,match_mode,invite_code")
      .eq("game_type", game)
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: false })
      .limit(50);
    setMatches((data || []) as M[]);
    setMatchesLoaded(true);
  }, [game]);

  useEffect(() => {
    void refreshMatches();
    const channel = supabase
      .channel(`lobby-${game}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_matches" }, () => {
        void refreshMatches();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [game, refreshMatches]);

  useEffect(() => {
    if (!me) return;
    let active = true;
    const presence = supabase
      .channel("matchmaking-online", { config: { presence: { key: me } } })
      .on("presence", { event: "sync" }, () => {
        if (!active) return;
        const state = presence.presenceState();
        const ids = Object.values(state).flatMap((members) =>
          members.flatMap((member) => {
            const memberId = (member as { user_id?: string }).user_id;
            return memberId && memberId !== me ? [memberId] : [];
          })
        );
        setOnlinePlayers([...new Set(ids)]);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void presence.track({ user_id: me });
      });

    return () => {
      active = false;
      void supabase.removeChannel(presence);
    };
  }, [me]);

  const amount = Number.parseInt(stake, 10) || 0;

  const createMatch = async (matchMode: MatchMode, opponentId?: string) => {
    if (amount < 1 || amount > 100000) return toast.error("Enter a stake from 1 to 100,000");
    if (matchMode === "challenge" && !opponentId) return toast.error("Choose an online player first");

    const code = matchMode === "friend" ? createFriendCode() : null;
    const state = game === "chess" ? new Chess().fen() : initialDraughts();
    setBusy(true);
    const { data, error } = await supabase.rpc("game_create_match_with_mode", {
      _game: game,
      _stake: amount,
      _state: state,
      _match_mode: matchMode,
      _opponent_id: opponentId,
      _invite_code: code ?? undefined,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("The match could not be created");

    await syncFromSupabase();
    await refreshMatches();
    if (matchMode === "open") nav(`/games/match/${data}`);
    if (matchMode === "friend") {
      setFriendCode(code);
      toast.success("Friend match created. Share the code to invite your opponent.");
    }
    if (matchMode === "challenge") toast.success("Invitation sent to the online player");
  };

  const join = async (match: M) => {
    if (match.creator_id === me) return nav(`/games/match/${match.id}`);
    setBusy(true);
    const { error } = await supabase.rpc("game_join_match", { _id: match.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    await syncFromSupabase();
    nav(`/games/match/${match.id}`);
  };

  const joinByCode = async () => {
    const code = codeToJoin.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (code.length !== 6) return toast.error("Enter the 6-character friend code");
    setBusy(true);
    const { data, error } = await supabase.rpc("game_join_match_by_code", { _code: code });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("Friend match not found");
    await syncFromSupabase();
    nav(`/games/match/${data}`);
  };

  if (!info) return null;

  return (
    <PageSection title={info.title}>
      <div className="match-entry">
        <img src={info.image} alt={`${info.title} board`} />
        <div className="match-entry-copy">
          <span className="eyebrow">{info.tag}</span>
          <h2>Choose how to play</h2>
          <div className="mode-picker" role="group" aria-label="Choose match mode">
            <Button variant={mode === "open" ? "default" : "outline"} aria-pressed={mode === "open"} onClick={() => setMode("open")}>Open lobby</Button>
            <Button variant={mode === "friend" ? "default" : "outline"} aria-pressed={mode === "friend"} onClick={() => setMode("friend")}>Play with a friend</Button>
            <Button variant={mode === "online" ? "default" : "outline"} aria-pressed={mode === "online"} onClick={() => setMode("online")}>Challenge online</Button>
          </div>

          <p className="text-sm text-muted-foreground">Choose a stake. Each player pays the stake plus a 5% entry fee; the winner receives both stakes.</p>
          <label className="field-label" htmlFor="stake">Stake (KSh)</label>
          <Input id="stake" type="number" min={1} max={100000} value={stake} onChange={(event) => setStake(event.target.value)} className="mt-2 h-12" />
          <p className="mt-2 text-xs text-muted-foreground">You pay {entryCost(amount)} · Winner receives {amount * 2}</p>

          {mode === "open" && (
            <Button className="mt-4" disabled={busy} onClick={() => createMatch("open")}>Create open match<ArrowRight /></Button>
          )}

          {mode === "friend" && (
            <div className="friend-mode mt-4">
              <Button disabled={busy} onClick={() => createMatch("friend")}>Create friend match<UsersRound /></Button>
              {friendCode && (
                <div className="invite-code-display">
                  <div><small>Friend code</small><strong>{friendCode}</strong></div>
                  <Button variant="outline" size="icon" aria-label="Copy friend code" title="Copy friend code"
                    onClick={() => void navigator.clipboard.writeText(friendCode).then(() => toast.success("Code copied"), () => toast.error("Could not copy code"))}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <label htmlFor="friend-code">Join a friend with their code</label>
              <div className="friend-code-form">
                <Input id="friend-code" maxLength={6} autoCapitalize="characters" value={codeToJoin}
                  onChange={(event) => setCodeToJoin(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="6-character code" />
                <Button disabled={busy} onClick={joinByCode}>Join</Button>
              </div>
              <small>Both players pay the same stake and entry fee.</small>
            </div>
          )}

          {mode === "online" && (
            <div className="online-players mt-4">
              <h3>Players online <span>{onlinePlayers.length}</span></h3>
              {onlinePlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No other players are online right now. Try the open lobby instead.</p>
              ) : onlinePlayers.map((playerId) => (
                <div className="online-player-row" key={playerId}>
                  <span><i aria-hidden="true" /> Player · {playerId.slice(-4).toUpperCase()}</span>
                  <Button size="sm" disabled={busy} onClick={() => createMatch("challenge", playerId)}>
                    Invite · KSh {entryCost(amount)}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="move-history">
        <h2>Matches</h2>
        {matchesLoaded && matches.length === 0 && <p className="text-sm text-muted-foreground">No matches available yet.</p>}
        {matches.map((match) => {
          const incoming = match.match_mode === "challenge" && match.invited_user_id === me && match.creator_id !== me && match.status === "waiting";
          const ownMatch = match.creator_id === me || match.opponent_id === me;
          const privateCode = match.match_mode === "friend" && match.creator_id === me && match.status === "waiting" ? match.invite_code : null;
          const buttonText = incoming
            ? `Accept · KSh ${entryCost(match.stake)}`
            : ownMatch
              ? match.status === "waiting" && match.match_mode === "challenge" ? "Invitation sent" : "Open"
              : `Join · KSh ${entryCost(match.stake)}`;

          return (
            <div key={match.id} className="lobby-row">
              <div>
                <strong>Stake KSh {match.stake}</strong>
                <small>
                  Pot KSh {match.stake * 2} · {incoming ? "Invitation for you" : match.status === "waiting" ? match.match_mode === "challenge" ? "Waiting for invited player" : "Waiting for opponent" : "In progress"}
                  {privateCode ? ` · Code ${privateCode}` : ""}
                </small>
              </div>
              <Button size="sm" disabled={busy || (!ownMatch && match.status !== "waiting") || (ownMatch && !incoming && match.status === "waiting" && match.match_mode === "challenge")}
                onClick={() => incoming || (!ownMatch && match.status === "waiting") ? join(match) : nav(`/games/match/${match.id}`)}
                variant={ownMatch && !incoming ? "secondary" : "default"}>
                {buttonText}
              </Button>
            </div>
          );
        })}
        <p className="mt-3 text-xs text-muted-foreground">Entry fee: {entryFee(amount)} KSh per player · Fees are charged when you create or join a match.</p>
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