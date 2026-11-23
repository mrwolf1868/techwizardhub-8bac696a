import { useCallback, useEffect, useRef, useState } from "react";
import { AppLayout, PageSection, formatKsh } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/store/userStore";
import { toast } from "sonner";
import { Wallet, Smartphone, History } from "lucide-react";
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
const WITHDRAW_LABEL: Record<string, string> = { pending: "Queued", processing: "Sending", paid: "Paid", failed: "Failed · refunded", rejected: "Rejected · refunded" };
type WithdrawalRow = { id: string; amount: number; phone: string; status: string; created_at: string };

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
  const { syncFromSupabase, coins, phoneNumber: profilePhone, userId } = useUserStore();
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(70);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [withdrawPhone, setWithdrawPhone] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const pollRef = useRef<number | null>(null);

  const loadWithdrawals = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("wallet_withdrawals")
      .select("id,amount,phone,status,created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
    setWithdrawals((data || []) as WithdrawalRow[]);
  }, [userId]);

  useEffect(() => { void loadWithdrawals(); }, [loadWithdrawals]);
  const hasProcessing = withdrawals.some((row) => row.status === "processing" || row.status === "pending");
  useEffect(() => {
    if (!hasProcessing) return;
    const timer = window.setInterval(() => { void loadWithdrawals(); void syncFromSupabase(); }, 8000);
    return () => window.clearInterval(timer);
  }, [hasProcessing, loadWithdrawals, syncFromSupabase]);

  useEffect(() => {
    if (profilePhone) {
      setPhone((current) => current || profilePhone);
      setWithdrawPhone((current) => current || profilePhone);
    }
  }, [profilePhone]);

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
    const normalized = normalizePhone(parsed.data.phone);
    if (!normalized) return toast.error("Enter a valid Safaricom number");
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
          // Coins are credited server-side by the M-Pesa callback. Just refresh.
          await syncFromSupabase();
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

  const requestWithdrawal = async () => {
    const normalized = normalizePhone(withdrawPhone);
    if (!normalized || !/^254[17]\d{8}$/.test(normalized)) return toast.error("Enter a valid Safaricom number");
    const requestedAmount = Number(withdrawAmount);
    if (!Number.isInteger(requestedAmount) || requestedAmount < 1) return toast.error("Enter a valid amount");
    if (requestedAmount > coins) return toast.error("Insufficient balance");

    if (requestedAmount < 10) return toast.error("The minimum withdrawal is KSh 10");

    setWithdrawBusy(true);
    const { data, error } = await supabase.functions.invoke("mpesa-payout", {
      body: { action: "wallet", amount: requestedAmount, phone: normalized },
    });
    setWithdrawBusy(false);
    if (error || !data?.success) {
      let message = data?.error as string | undefined;
      if (!message && error && "context" in error) {
        try { message = (await (error as { context: Response }).context.json()).error; } catch { /* ignore */ }
      }
      await Promise.all([syncFromSupabase(), loadWithdrawals()]);
      return toast.error(message || "The withdrawal could not be completed. No money was taken.");
    }
    setWithdrawAmount("");
    await Promise.all([syncFromSupabase(), loadWithdrawals()]);
    toast.success("Withdrawal sent to M-Pesa. You will receive an SMS once Safaricom completes it.");
  };

  return (
    <AppLayout>
      <PageSection title={tab === "deposit" ? "Deposit" : "Withdraw"}>
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Wallet actions">
        <Button role="tab" aria-selected={tab === "deposit"} variant={tab === "deposit" ? "default" : "outline"} onClick={() => setTab("deposit")}>
          Deposit
        </Button>
        <Button role="tab" aria-selected={tab === "withdraw"} variant={tab === "withdraw" ? "default" : "outline"} onClick={() => setTab("withdraw")}>
          Withdraw
        </Button>
      </div>
      {tab === "deposit" ? <>
      <p className="text-sm text-muted-foreground">Top up your Balance with M-Pesa · KSh 1 = 1 coin</p>

      <Card className="mt-4 max-w-xl border-coin/30 bg-gradient-card p-5 shadow-card">
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
      </> : <>
        <p className="text-sm text-muted-foreground">Withdraw your balance directly to M-Pesa.</p>
        <div className="wallet-layout mt-4">
          <Card className="max-w-xl border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-lg bg-muted">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-display text-lg font-bold">M-Pesa withdrawal</div>
                <div className="text-xs text-muted-foreground">Available balance: {coins.toLocaleString()} coins</div>
              </div>
            </div>
            <Label htmlFor="withdraw-phone" className="mt-5 block text-xs uppercase tracking-widest text-muted-foreground">Safaricom number</Label>
            <Input id="withdraw-phone" inputMode="tel" placeholder="0712345678 or 254712345678" value={withdrawPhone}
              onChange={(event) => setWithdrawPhone(event.target.value)} maxLength={18} className="mt-2" disabled={withdrawBusy} />
            <Label htmlFor="withdraw-amount" className="mt-4 block text-xs uppercase tracking-widest text-muted-foreground">Amount (KSh)</Label>
            <Input id="withdraw-amount" type="number" min={10} max={coins} value={withdrawAmount}
              onChange={(event) => setWithdrawAmount(event.target.value)} className="mt-2" disabled={withdrawBusy} />
            <Button className="mt-4 w-full" onClick={requestWithdrawal} disabled={withdrawBusy || coins < 1}>
              {withdrawBusy ? "Sending to M-Pesa…" : "Withdraw to M-Pesa"}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">Money is sent straight to your M-Pesa. If Safaricom declines the payout, your balance is returned automatically.</p>
          </Card>
          <div className="transaction-history">
            <h2>Withdrawal history</h2>
            {withdrawals.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No withdrawals yet.</p> : withdrawals.map((withdrawal) => (
              <div key={withdrawal.id} className="transaction-row">
                <div className="transaction-icon"><History /></div>
                <div className="flex-1">
                  <strong>{formatKsh(withdrawal.amount)} to +{withdrawal.phone}</strong>
                  <small>{new Date(withdrawal.created_at).toLocaleString()}</small>
                </div>
                <strong className={`withdraw-status status-${withdrawal.status}`}>{WITHDRAW_LABEL[withdrawal.status] ?? withdrawal.status}</strong>
              </div>
            ))}
          </div>
        </div>
      </>}
      </PageSection>
    </AppLayout>
  );
};

export default Buy;
