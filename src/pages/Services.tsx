import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import * as Icons from "lucide-react";
import { Rocket, ArrowRight } from "lucide-react";

type Service = {
  id: string;
  name: string;
  description: string | null;
  url: string;
  icon: string | null;
};

const Services = () => {
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name, description, url, icon")
        .eq("enabled", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (!active) return;
      setItems((data || []) as Service[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const open = (s: Service) => {
    if (s.url.startsWith("/")) {
      navigate(s.url);
      return;
    }
    // External link — open silently in new tab; no URL is shown to the user
    window.open(s.url, "_blank", "noopener,noreferrer");
  };

  const renderIcon = (name: string | null) => {
    const Lookup = (name && (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[name]) || Rocket;
    return <Lookup className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />;
  };

  return (
    <AppLayout>
      <h2 className="font-display text-2xl font-black">Services</h2>
      <p className="text-sm text-muted-foreground">Tap a service to open it.</p>

      <div className="mt-4 space-y-3">
        {loading && (
          <div className="text-center text-sm text-muted-foreground py-8">Loading services…</div>
        )}

        {!loading && items.length === 0 && (
          <Card className="bg-gradient-card p-6 text-center text-sm text-muted-foreground">
            No services available yet.
          </Card>
        )}

        {items.map((s) => (
          <Card key={s.id} className="border-primary/20 bg-gradient-card p-4 shadow-card">
            <button
              type="button"
              onClick={() => open(s)}
              className="flex w-full items-center gap-3 text-left"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-primary shadow-glow">
                {renderIcon(s.icon)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base font-bold">{s.name}</div>
                {s.description && (
                  <div className="truncate text-xs text-muted-foreground">{s.description}</div>
                )}
              </div>
              <Button size="sm" variant="secondary" className="shrink-0" tabIndex={-1}>
                Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </button>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
};

export default Services;
