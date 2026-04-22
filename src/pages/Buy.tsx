import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/store/userStore";
import { toast } from "sonner";
import { Wallet, Smartphone } from "lucide-react";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  phone: z
    .string()
    .trim()
    .refine((v) => {
      const n = normalizePhone(v);
      return n !== null && /^254[17]\d{8}$/.test(n);
    }, "Enter a valid Safaricom number (e.g. 0712345678 or 254712345678)"),
  amount: z.number().int().min(1, "Min 1 KES").max(70000, "Max 70,000 KES"),
});

const PRESETS = [70, 150, 350, 700, 1500];

// Persistent client id (used by callback to map payment → this browser)
const getClientId = () => {
  let id = localStorage.getItem("twh-client-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("twh-client-id", id);
  }
  return id;
};

const Buy = () => {
  const { addCoins } = useUserStore();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(70);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const buy = async () => {
    const parsed = schema.safeParse({ phone, amount });
    if (!parsed.success) {
      return toast.error(parsed.error.errors[0].message);
    }
    const normalized = normalizePhone(parsed.data.phone)!;
    const clientId = getClientId();

    setLoading(true);
    setStatusMsg("Sending STK push...");

    const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
      body: { phone: normalized, amount: parsed.data.amount, clientId },
    });

    if (error || !data?.success) {
      setLoading(false);
      setStatusMsg(null);
      return toast.error(data?.error || error?.message || "Failed to send STK push");
    }

    const checkoutId: string = data.checkoutRequestId;
    toast.info(`📲 STK push sent to +${normalized}. Approve on your phone...`);
    setStatusMsg("Waiting for you to approve on your phone...");

    // Poll the transaction row until status changes (or timeout ~90s)
    let attempts = 0;
    const maxAttempts = 45; // 45 * 2s = 90s
    pollRef.current = window.setInterval(async () => {
      attempts++;
      const { data: row } = await supabase
        .from("mpesa_transactions")
        .select("status, amount, mpesa_receipt, result_desc")
        .eq("checkout_request_id", checkoutId)
        .maybeSingle();

      if (row && row.status !== "pending") {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        setLoading(false);

        if (row.status === "success") {
          addCoins(
            row.amount,
            "purchase",
            `M-Pesa ${row.amount} KES${row.mpesa_receipt ? ` · ${row.mpesa_receipt}` : ""}`
          );
          setStatusMsg(null);
          toast.success(`✅ Payment confirmed — ${row.amount} coins added`);
        } else {
          setStatusMsg(null);
          toast.error(row.result_desc || "Payment failed or cancelled");
        }
        return;
      }

      if (attempts >= maxAttempts) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = null;
        setLoading(false);
        setStatusMsg(null);
        toast.error("Timed out waiting for confirmation. If you paid, refresh in a moment.");
      }
    }, 2000);
  };

  return (
    <AppLayout>
      <h2 className="font-display text-2xl font-black">Buy Coins</h2>
      <p className="text-sm text-muted-foreground">1 KES = 1 coin · Pay via M-Pesa</p>

      <Card className="mt-4 border-coin/30 bg-gradient-card p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-coin shadow-coin">
            <Wallet className="h-6 w-6 text-coin-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display text-lg font-bold">M-Pesa STK Push</div>
            <div className="text-xs text-muted-foreground">You'll receive a prompt on your phone</div>
          </div>
        </div>

        <Label htmlFor="mpesa-phone" className="mt-5 block text-xs uppercase tracking-widest text-muted-foreground">
          Safaricom phone number
        </Label>
        <div className="mt-2 flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          <Input
            id="mpesa-phone"
            inputMode="tel"
            placeholder="0712345678 or 254712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={18}
            className="bg-background/60"
            disabled={loading}
          />
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Safaricom numbers only (07XX, 01XX, or 2547XX/2541XX).
        </p>

        <Label htmlFor="amount" className="mt-4 block text-xs uppercase tracking-widest text-muted-foreground">
          Amount (KES)
        </Label>
        <Input
          id="amount"
          type="number"
          min={1}
          max={70000}
          value={amount}
          onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
          className="mt-2 bg-background/60 font-display text-lg font-bold"
          disabled={loading}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((v) => (
            <Button
              key={v}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAmount(v)}
              disabled={loading}
            >
              {v} KES
            </Button>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-coin/30 bg-coin/5 p-3 text-center">
          <div className="text-xs text-muted-foreground">You will receive</div>
          <div className="font-display text-3xl font-black text-gradient-coin">
            {amount.toLocaleString()} coins
          </div>
        </div>

        <Button
          size="lg"
          onClick={buy}
          disabled={loading}
          className="mt-4 w-full bg-gradient-coin font-display font-black text-coin-foreground shadow-coin hover:opacity-90"
        >
          {loading ? "Waiting for confirmation..." : `📲 Pay ${amount} KES via M-Pesa`}
        </Button>

        {statusMsg && (
          <div className="mt-3 rounded-lg border border-coin/30 bg-coin/5 p-3 text-center text-xs text-coin">
            {statusMsg}
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          🔒 Secure payment via Safaricom Daraja. Coins are credited automatically once your payment is confirmed.
        </p>
      </Card>
    </AppLayout>
  );
};

export default Buy;
