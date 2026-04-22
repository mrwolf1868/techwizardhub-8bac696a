import { Link } from "react-router-dom";
import { Rocket, LogOut, ShieldCheck } from "lucide-react";
import { CoinBalance } from "./CoinBalance";
import { useUserStore } from "@/store/userStore";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const AppHeader = () => {
  const signOutLocal = useUserStore((s) => s.signOutLocal);
  const isAdmin = useUserStore((s) => s.isAdmin);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    signOutLocal();
    toast.success("Signed out");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Rocket className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-xl font-black tracking-wider">
            <span className="text-gradient-primary">TECHWIZARD</span>
            <span className="ml-1 text-foreground">Hub</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <CoinBalance />
          {isAdmin && (
            <Button asChild variant="ghost" size="icon" aria-label="Admin panel">
              <Link to="/admin">
                <ShieldCheck className="h-4 w-4 text-primary" />
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
