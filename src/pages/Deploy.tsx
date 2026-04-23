import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/store/userStore";
import { toast } from "sonner";
import { Rocket, Copy, Smartphone, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { normalizePhone, formatPhoneDisplay } from "@/lib/phone";
import { supabase } from "@/integrations/supabase/client";

const phoneSchema = z
  .string()
  .trim()
  .refine((v) => normalizePhone(v) !== null, "Enter a valid number with country code (e.g. 254712345678)");

const Deploy = () => {
  const { coins, deployBot, bots, markBotConnected } = useUserStore();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const onDeploy = async () => {
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    if (coins < 70) return toast.error("Need 70 coins to deploy a bot");
    const normalized = normalizePhone(parsed.data)!;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-pair-code", {
        body: { phone: normalized },
      });
      if (error) throw error;
      const code = (data as { code?: string })?.code;
      if (!code) throw new Error("No pairing code returned");
      const bot = deployBot(normalized, code);
      if (!bot) {
        toast.error("Deployment failed");
        return;
      }
      toast.success("✅ Bot deployed! Use the pairing code below.");
      setPhone("");
    } catch (e) {
      toast.error((e as Error).message || "Could not fetch pairing code");
    } finally {
      setLoading(false);
    }
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
          WhatsApp number (with country code)
        </Label>
        <div className="mt-2 flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          <Input
            id="phone"
            inputMode="tel"
            placeholder="254712345678 or 256701234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={18}
            className="bg-background/60"
          />
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Any country supported. Local Kenyan 07/011 numbers auto-detected.
        </p>
        <Button
          size="lg"
          onClick={onDeploy}
          disabled={loading || coins < 70}
          className="mt-4 w-full bg-gradient-primary font-display font-bold shadow-glow hover:opacity-90"
        >
          {loading ? "Generating pairing code..." : `🚀 Deploy Bot (-70 coins)`}
        </Button>
      </Card>

      <Card className="mt-4 border-border/60 bg-gradient-card p-4">
        <div className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          How to connect
        </div>
        <ol className="mt-2 space-y-1 text-xs text-foreground/80">
          <li>1. Open <strong>WhatsApp</strong> on your phone.</li>
          <li>2. Tap <strong>Settings → Linked devices → Link a device</strong>.</li>
          <li>3. Choose <strong>Link with phone number instead</strong>.</li>
          <li>4. Enter the <strong>pairing code</strong> shown after deploying.</li>
          <li>5. Wait a few seconds — your bot is live ✅</li>
        </ol>
      </Card>

      {bots.length > 0 && (
        <>
          <h3 className="mt-6 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Your bots ({bots.length})
          </h3>
          <div className="mt-3 space-y-3">
            {bots.map((b) => {
              const isConnected = b.status === "connected";
              return (
                <Card key={b.id} className="border-border/60 bg-gradient-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CheckCircle2
                          className={`h-4 w-4 ${isConnected ? "text-win" : "text-muted-foreground"}`}
                        />
                        <div className="font-display text-base font-bold">
                          {formatPhoneDisplay(b.phoneNumber)}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isConnected ? "Connected" : "Awaiting pairing"} ·{" "}
                        {new Date(b.deployedAt).toLocaleString()}
                      </div>
                    </div>
                    {!isConnected && (
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => {
                          navigator.clipboard.writeText(b.code);
                          toast.success("Code copied");
                        }}
                        aria-label="Copy code"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {!isConnected && (
                    <>
                      <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Pairing code
                        </div>
                        <div className="mt-1 font-mono text-2xl font-black tracking-[0.3em] text-gradient-primary">
                          {b.code}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          markBotConnected(b.id);
                          toast.success("Marked as connected ✅");
                        }}
                        className="mt-3 w-full"
                      >
                        I've paired — mark as connected
                      </Button>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default Deploy;
