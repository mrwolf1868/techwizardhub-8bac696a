import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/userStore";
import { entryCost } from "@/lib/matchFees";

type Row = { id: string; game_type: string; stake: number; creator_id: string; invited_user_id: string | null; status: string; match_mode: string };

const gameName = (game: string) => (game === "chess" ? "Chess" : "Draughts");

/** Notifies every signed-in player while a new match search or a direct challenge is open. */
export const MatchInvites = () => {
  const me = useUserStore((s) => s.userId);
  const syncFromSupabase = useUserStore((s) => s.syncFromSupabase);
  const navigate = useNavigate();

  useEffect(() => {
    if (!me) return;
    const join = async (row: Row) => {
      const { error } = await supabase.rpc("game_join_match", { _id: row.id });
      if (error) return toast.error(error.message.includes("not available") ? "Someone else already joined this match" : error.message);
      await syncFromSupabase();
      navigate(`/games/match/${row.id}`);
    };
    const channel = supabase
      .channel(`match-invites-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_matches" }, (payload) => {
        const row = payload.new as Row;
        if (row.status !== "waiting" || row.creator_id === me) return;
        const forMe = row.match_mode === "challenge" && row.invited_user_id === me;
        if (row.match_mode !== "open" && !forMe) return;
        toast(forMe ? `Challenge: ${gameName(row.game_type)} for KSh ${row.stake}` : `${gameName(row.game_type)} match available`, {
          id: `invite-${row.id}`,
          description: `Player ${row.creator_id.slice(-4).toUpperCase()} wants a match with a stake of KSh ${row.stake}. You pay KSh ${entryCost(row.stake)} only if you join.`,
          duration: 30_000,
          action: { label: "Join", onClick: () => void join(row) },
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_matches" }, (payload) => {
        const row = payload.new as Row;
        if (row.status !== "waiting") toast.dismiss(`invite-${row.id}`);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [me, navigate, syncFromSupabase]);

  return null;
};
