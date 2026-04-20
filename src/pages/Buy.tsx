import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/store/userStore";
import { toast } from "sonner";
import { Wallet, Smartphone } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  phone: z.string().trim().regex(/^(?:\+?254|0)?7\d{8}$/, "Invalid Safaricom number"),
  amount: z.number().int().min(10, "Min 10 KES").max(70000, "Max 70,000 KES"),
});

const PRESETS = [70, 150, 350, 700, 1500];

const Buy = () => {
  const { addCoins } = useUserStore();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(70);
  const [loading, setLoading] = useState(false);

  const buy = async () => {
    const parsed = schema.safeParse({ phone, amount });
    if (!parsed.success) {
      return toast.error(parsed.error.errors[0].message);
    }
    setLoading(true);
    toast.info("📲 STK push sent (mock). Approve on your phone...");
    await new Promise((r) => setTimeout(r, 2200));
    // Mock M-Pesa success: 1 KES = 1 coin
    addCoins(parsed.data.amount, "purchase", `M-Pesa ${parsed.data.amount} KES`);
    setLoading(false);
    toast.success(`✅ Payment confirmed — ${parsed.data.amount} coins added`);
  };

  return (
    <AppLayout>
      <h2 className="font-display text-2xl font-black">Buy Coins</h2>
      <p className="text-sm text-muted-foreground">1 KES = 1 coin · Till 5529503</p>

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
          Safaricom number
        </Label>
        <div className="mt-2 flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          <Input
            id="mpesa-phone"
            inputMode="tel"
            placeholder="0712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={15}
            className="bg-background/60"
          />
        </div>

        <Label htmlFor="amount" className="mt-4 block text-xs uppercase tracking-widest text-muted-foreground">
          Amount (KES)
        </Label>
        <Input
          id="amount"
          type="number"
          min={10}
          max={70000}
          value={amount}
          onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
          className="mt-2 bg-background/60 font-display text-lg font-bold"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((v) => (
            <Button key={v} type="button" variant="secondary" size="sm" onClick={() => setAmount(v)}>
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

        <p className="mt-3 text-xs text-muted-foreground">
          🔒 Mock payment for now. Live Daraja STK push will be wired up with Lovable Cloud edge functions in v2.
        </p>
      </Card>
    </AppLayout>
  );
};

export default Buy;
