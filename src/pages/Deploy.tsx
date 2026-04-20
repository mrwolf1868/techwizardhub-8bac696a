import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/store/userStore";
import { toast } from "sonner";
import { Rocket, ExternalLink, Copy } from "lucide-react";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

const phoneSchema = z
  .string()
  .trim()
  .refine((v) => normalizePhone(v) !== null, "Enter a valid number with country code (e.g. 254712345678)");

const Deploy = () => {
  const { coins, deployBot, bots } = useUserStore();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const onDeploy = async () => {
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    if (coins < 70) return toast.error("Need 70 coins to deploy a bot");
    const normalized = normalizePhone(parsed.data)!;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    const bot = deployBot(normalized);
    setLoading(false);
    if (!bot) return toast.error("Deployment failed");
    toast.success("✅ Bot deployed! Open the link to connect.");
    setPhone("");
  };

  return (
    <AppLayout>
      <h2 className="font-display text-2xl font-black">Deploy a Bot</h2>
      <p className="text-sm text-muted-foreground">70 coins per deployment</p>

      <Card className="mt-4 border-primary/30 bg-gradient-card p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Rocket className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display text-lg font-bold">New deployment</div>
            <div className="text-xs text-muted-foreground">Cost: 70 coins · Balance: {coins}</div>
          </div>
        </div>

        <Label htmlFor="phone" className="mt-5 block text-xs uppercase tracking-widest text-muted-foreground">
          WhatsApp number
        </Label>
        <Input
          id="phone"
          inputMode="tel"
          placeholder="0712345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={15}
          className="mt-2 bg-background/60"
        />
        <Button
          size="lg"
          onClick={onDeploy}
          disabled={loading || coins < 70}
          className="mt-4 w-full bg-gradient-primary font-display font-bold shadow-glow hover:opacity-90"
        >
          {loading ? "Deploying..." : `🚀 Deploy Bot (-70 coins)`}
        </Button>
      </Card>

      {bots.length > 0 && (
        <>
          <h3 className="mt-6 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Your bots ({bots.length})
          </h3>
          <div className="mt-3 space-y-3">
            {bots.map((b) => (
              <Card key={b.id} className="border-border/60 bg-gradient-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-base font-bold">{b.phoneNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(b.deployedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(b.link);
                        toast.success("Link copied");
                      }}
                      aria-label="Copy link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      asChild
                      className="bg-gradient-primary shadow-glow"
                      aria-label="Open bot link"
                    >
                      <a href={b.link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="mt-2 truncate rounded-md border border-border bg-background/40 px-2 py-1 font-mono text-xs text-muted-foreground">
                  {b.link}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default Deploy;
