import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/userStore";
import { gameName } from "@/lib/games";

type Pending = { id: string; game_type: string; stake: number; match_mode: string; creator_charged: boolean };

export const PENDING_KEY = (me: string | null) => ["my-pending-matches", me];

/** Always-visible strip for the player's own open match search, with View and Cancel. */
export const PendingMatchBar = () => {
  const me = useUserStore((s) => s.userId);
  const syncFromSupabase = useUserStore((s) => s.syncFromSupabase);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [confirm, setConfirm] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: pending = [] } = useQuery({
    queryKey: PENDING_KEY(me),
    enabled: !!me,
    queryFn: async () => {
      if (!me) return [];
      const { data, error } = await supabase.from("game_matches").select("id,game_type,stake,match_mode,creator_charged")
        .eq("creator_id", me).eq("status", "waiting").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Pending[];
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`my-pending-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_matches", filter: `creator_id=eq.${me}` }, () => {
        void queryClient.invalidateQueries({ queryKey: PENDING_KEY(me) });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [me, queryClient]);

  const visible = pending.filter((p) => location.pathname !== `/games/match/${p.id}`);

  const cancel = async () => {
    if (!confirm) return;
    setBusy(true);
    const { error } = await supabase.rpc("game_resign", { _id: confirm.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(confirm.creator_charged ? "Search cancelled. Your stake was returned." : "Search cancelled. Nothing was charged.");
    setConfirm(null);
    void queryClient.invalidateQueries({ queryKey: PENDING_KEY(me) });
    void syncFromSupabase();
  };

  if (visible.length === 0) return null;

  return (
    <>
      <div className="pending-bar" role="status">
        {visible.map((p) => (
          <div key={p.id} className="pending-item">
            <span className="pending-pulse" aria-hidden="true"><Search className="h-3.5 w-3.5" /></span>
            <span className="pending-text"><strong>{gameName(p.game_type)} search open</strong><small>Stake KSh {p.stake} · waiting for an opponent</small></span>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/games/match/${p.id}`)}><Eye />View</Button>
            <Button size="sm" variant="outline" onClick={() => setConfirm(p)}><X />Cancel</Button>
          </div>
        ))}
      </div>
      <AlertDialog open={!!confirm} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this match search?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.creator_charged ? "Your stake will be returned to your balance." : "Nothing has been charged, so your balance stays the same."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep searching</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void cancel(); }}>Cancel search</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
