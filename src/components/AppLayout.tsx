import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, useLocation, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, Gamepad2, Home, Plus, ShieldCheck, UserRound, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/userStore";
import { supabase } from "@/integrations/supabase/client";
import { MessagesInbox } from "./MessagesInbox";
import { MatchInvites } from "./MatchInvites";
import { PendingMatchBar } from "./PendingMatchBar";
import { useAppSettings } from "@/hooks/useAppSettings";

const nav = [
  { to: "/", title: "Home", icon: Home },
  { to: "/games", title: "Games", icon: Gamepad2 },
  { to: "/services", title: "Services", icon: BriefcaseBusiness },
  { to: "/buy", title: "Deposit", icon: Plus },
  { to: "/profile", title: "Profile", icon: UserRound },
];

const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029Vb6Vxo960eBmxo0Q5z0Z";
const openWhatsApp = () => { window.open(WHATSAPP_CHANNEL, "_blank", "noopener,noreferrer"); };

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.7-.3-1.4-.7-2-1.3-.6-.5-1-1.1-1.4-1.8-.1-.2 0-.4.1-.5l.4-.4.2-.4v-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.6.6-.9 1.4-.9 2.2 0 .9.4 1.8.9 2.5 1 1.5 2.3 2.7 3.9 3.4 1.6.7 2.2.7 3 .6.6-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z" />
  </svg>
);

export const formatKsh = (n: number) => `KSh ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const init = useUserStore((s) => s.init);
  const syncFromSupabase = useUserStore((s) => s.syncFromSupabase);
  const userId = useUserStore((s) => s.userId);
  const coins = useUserStore((s) => s.coins);
  const isAdmin = useUserStore((s) => s.isAdmin);
  const phone = useUserStore((s) => s.phoneNumber);
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState<boolean>(!!userId);
  const location = useLocation();
  const navigate = useNavigate();
  const { announcement } = useAppSettings();

  useEffect(() => {
    let mounted = true;
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthed(!!session);
      if (session && event === "SIGNED_IN") window.setTimeout(() => { void syncFromSupabase().catch(() => undefined); }, 0);
    });
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setAuthed(!!data.session);
      if (data.session && data.session.user.id !== userId) await syncFromSupabase();
      else if (data.session) void syncFromSupabase().catch(() => undefined);
      if (mounted) setChecking(false);
    }).catch(() => {
      if (mounted) setChecking(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [init, syncFromSupabase, userId]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [location.pathname]);

  if (checking) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!authed) return <Navigate to="/login" state={{ from: location }} replace />;

  const initial = (phone || "P").replace(/\D/g, "").slice(-1) || "P";

  return (
    <div className="techwolf-app">
      <MatchInvites />
      <header className="topbar">
        <Button variant="ghost" className="brand-button" onClick={() => navigate("/")}>
          <span><strong>TECHWOLFpro</strong><small>PLAY • COMPETE • WIN</small></span>
        </Button>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" className="header-wallet" onClick={() => navigate("/buy")}>
            <WalletIcon /><span><small>Balance</small><strong>{formatKsh(coins)}</strong></span>
          </Button>
          <Button variant="ghost" size="icon" className="whatsapp-button" aria-label="Join our WhatsApp channel" title="Join our WhatsApp channel" onClick={openWhatsApp}>
            <WhatsAppIcon />
          </Button>
          <MessagesInbox />
          {isAdmin && (
            <Button asChild variant="ghost" size="icon" aria-label="Admin panel">
              <Link to="/admin"><ShieldCheck className="h-4 w-4 text-primary" /></Link>
            </Button>
          )}
          <Button size="icon" className="player-avatar" aria-label="Open profile" onClick={() => navigate("/profile")}>
            {phone ? initial : <UserRound />}
          </Button>
        </div>
      </header>
      {announcement.enabled && announcement.text.trim() && <div className="site-announcement" role="note">{announcement.text}</div>}
      <PendingMatchBar />
      <main className="app-content">{children}</main>
      <nav className="bottom-navigation" aria-label="Main navigation">
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"}
            className={({ isActive }) => `inline-flex items-center justify-center rounded-md nav-item${isActive ? " active" : ""}`}>
            <item.icon /><span>{item.title}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export const PageSection = ({ title, children }: { title: string; children?: React.ReactNode }) => {
  const navigate = useNavigate();
  return (
    <section className="page-section">
      <Button variant="ghost" className="back-button" onClick={() => navigate("/")}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
        Home
      </Button>
      <h1>{title}</h1>
      {children}
    </section>
  );
};
