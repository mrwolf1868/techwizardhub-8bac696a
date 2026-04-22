import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUserStore } from "@/store/userStore";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { AgreementGate } from "./AgreementGate";

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const init = useUserStore((s) => s.init);
  const syncFromSupabase = useUserStore((s) => s.syncFromSupabase);
  const userId = useUserStore((s) => s.userId);
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState<boolean>(!!userId);
  const location = useLocation();

  useEffect(() => {
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
      if (session) {
        setTimeout(() => {
          syncFromSupabase();
        }, 0);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      if (data.session) syncFromSupabase();
      setChecking(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [init, syncFromSupabase]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!authed) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav />
      <AgreementGate />
    </div>
  );
};
