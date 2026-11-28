import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Loader2, Coins } from "lucide-react";
import { toast } from "sonner";
import { useUserStore } from "@/store/userStore";

type Child = {
  id: string;
  slug: string;
  name: string;
  url: string;
  enabled: boolean;
  free_trial_seconds: number;
  continuation_price_coins: number;
};

const ServiceLauncher = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { coins, syncFromSupabase } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [child, setChild] = useState<Child | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!slug) { setError("Service not found"); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      const { data: c, error: cErr } = await supabase
        .from("child_projects")
        .select("id, slug, name, url, enabled, free_trial_seconds, continuation_price_coins")
        .eq("slug", slug)
        .maybeSingle();
      if (cErr || !c || !c.enabled) {
        if (!active) return;
        setError("Service unavailable"); setLoading(false); return;
      }
      setChild(c as Child);
      setSecondsLeft(c.free_trial_seconds || 30);

      const { data: tokenRes, error: tokErr } = await supabase.functions.invoke(
        "techwolf254-get-transfer-token",
        { body: { child_slug: slug } }
      );
      if (tokErr || !tokenRes?.token) {
        if (!active) return;
        setError("Could not start session"); setLoading(false); return;
      }

      // Append as query params so SPAs using hash routing keep working.
      let url: string;
      try {
        const u = new URL(c.url);
        u.searchParams.set("twh_token", tokenRes.token);
        u.searchParams.set("slug", slug);
        url = u.toString();
      } catch {
        const sep = c.url.includes("?") ? "&" : "?";
        url = `${c.url}${sep}twh_token=${encodeURIComponent(tokenRes.token)}&slug=${encodeURIComponent(slug)}`;
      }
      if (!active) return;
      setIframeUrl(url);
      setLoading(false);

    })();
    return () => { active = false; };
  }, [slug, navigate]);

  // Free-trial countdown
  useEffect(() => {
    if (paid || paywall || secondsLeft == null) return;
    if (secondsLeft <= 0) { setPaywall(true); return; }
    const t = setTimeout(() => setSecondsLeft((s) => (s == null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, paywall, paid]);

  const payToContinue = async () => {
    if (!child) return;
    const cost = child.continuation_price_coins || 0;
    if (cost <= 0) { setPaid(true); setPaywall(false); return; }
    if (coins < cost) { toast.error(`Insufficient balance. You need ${cost} coins.`); return; }
    setPaying(true);
    const { data, error } = await supabase.functions.invoke("techwolf254-deduct-wallet", {
      body: {
        child_slug: child.slug,
      },
    });
    setPaying(false);
    if (error || (data as { error?: string })?.error) {
      const msg = (data as { error?: string })?.error || error?.message || "Payment failed";
      toast.error(msg);
      return;
    }
    toast.success("Payment successful — enjoy!");
    setPaid(true);
    setPaywall(false);
    await syncFromSupabase();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/services")} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="font-display text-sm font-bold">{child?.name || "Service"}</div>
        <div className="min-w-16 text-right text-[11px] text-muted-foreground">
          {!paid && secondsLeft != null && secondsLeft > 0 && !paywall && `Free: ${secondsLeft}s`}
          {paid && "Unlocked"}
        </div>
      </div>

      <div className="relative flex-1 bg-background">
        {loading && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading service…
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-destructive">
            {error}
          </div>
        )}
        {iframeUrl && (!paywall || paid) && (
          <iframe
            ref={iframeRef}
            title={child?.name || "Service"}
            src={iframeUrl}
            referrerPolicy="no-referrer"
            allow="clipboard-read; clipboard-write; microphone; camera; autoplay; fullscreen; geolocation; encrypted-media"
            className="absolute inset-0 h-full w-full border-0"
            style={{ touchAction: "manipulation" }}
          />
        )}

        {paywall && !paid && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-background/90 backdrop-blur p-6">
            <Card className="w-full max-w-sm border-primary/30 bg-gradient-card p-6 text-center shadow-glow">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
                <Coins className="h-7 w-7 text-primary-foreground" />
              </div>
              <h3 className="mt-3 font-display text-lg font-black">Free trial ended</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Continue using <strong>{child?.name}</strong> by paying from your balance.
              </p>
              <div className="mt-4 rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Cost</div>
                <div className="font-display text-2xl font-black text-coin">
                  {child?.continuation_price_coins ?? 0} coins
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">Your balance: {coins}</div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => navigate("/services")}>Exit</Button>
                <Button
                  className="flex-1 bg-gradient-primary font-bold shadow-glow"
                  disabled={paying || coins < (child?.continuation_price_coins ?? 0)}
                  onClick={payToContinue}
                >
                  {paying ? "Processing…" : coins < (child?.continuation_price_coins ?? 0) ? "Insufficient" : "Pay & continue"}
                </Button>
              </div>
              {coins < (child?.continuation_price_coins ?? 0) && (
                <Button variant="link" size="sm" className="mt-2" onClick={() => navigate("/buy")}>
                  Top up coins →
                </Button>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceLauncher;
