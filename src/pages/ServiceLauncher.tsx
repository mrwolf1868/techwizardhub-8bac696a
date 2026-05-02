import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

/**
 * Hidden launcher for child mini-services.
 * - Resolves slug -> child project (URL is fetched server-side, never shown)
 * - Mints a one-time transfer token via TECHWOLF254_API
 * - Loads the child app inside an iframe so the parent URL bar stays on TechwizardHub
 *
 * Note: the child site must allow being embedded by this domain (no X-Frame-Options/CSP block).
 * If the child blocks framing, the iframe will fail silently — that is a hosting-side decision
 * we cannot bypass from here.
 */
const ServiceLauncher = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState<string>("Service");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!slug) {
        setError("Service not found");
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      // Fetch child project (RLS allows authed reads of enabled rows)
      const { data: child, error: childErr } = await supabase
        .from("child_projects")
        .select("slug, name, url, enabled")
        .eq("slug", slug)
        .maybeSingle();
      if (childErr || !child || !child.enabled) {
        if (!active) return;
        setError("Service unavailable");
        setLoading(false);
        return;
      }
      setServiceName(child.name);

      // Mint transfer token
      const { data: tokenRes, error: tokErr } = await supabase.functions.invoke(
        "techwolf254-get-transfer-token",
        { body: { child_slug: slug } }
      );
      if (tokErr || !tokenRes?.token) {
        if (!active) return;
        setError("Could not start session");
        setLoading(false);
        return;
      }

      // Build embedded URL — token rides in URL fragment so it's not in HTTP referer/server logs
      const sep = child.url.includes("#") ? "&" : "#";
      const url = `${child.url}${sep}twh_token=${encodeURIComponent(tokenRes.token)}&slug=${encodeURIComponent(slug)}`;
      if (!active) return;
      setIframeUrl(url);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [slug, navigate]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/services")}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="font-display text-sm font-bold">{serviceName}</div>
        <div className="w-16" />
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
        {iframeUrl && (
          <iframe
            ref={iframeRef}
            title={serviceName}
            src={iframeUrl}
            // Prevent leaking the child URL via referrer; sandbox keeps it isolated but functional
            referrerPolicy="no-referrer"
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals"
            className="absolute inset-0 h-full w-full border-0"
          />
        )}
      </div>
    </div>
  );
};

export default ServiceLauncher;
