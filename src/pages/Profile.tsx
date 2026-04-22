import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/store/userStore";
import { toast } from "sonner";
import { Copy, Gift, History, Share2, User as UserIcon } from "lucide-react";

const Profile = () => {
  const { phoneNumber, email, referralCode, redeemReferral, transactions, coins, botsDeployed, gamesPlayed } =
    useUserStore();
  const [refInput, setRefInput] = useState("");

  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast.success("Referral code copied");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied");
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join TECHWIZARD Hub",
          text: `Sign up with my link and we both get coins! Code: ${referralCode}`,
          url: referralLink,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      copyLink();
    }
  };

  const redeem = () => {
    const code = refInput.trim().toUpperCase();
    if (!code) return toast.error("Enter a code");
    const ok = redeemReferral(code);
    if (ok) {
      toast.success("🎉 +30 coins from referral");
      setRefInput("");
    } else {
      toast.error("Invalid or already-used code");
    }
  };

  return (
    <AppLayout>
      <Card className="border-primary/30 bg-gradient-card p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
            <UserIcon className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display text-xl font-black">My Profile</div>
            <div className="text-xs text-muted-foreground">{phoneNumber || "Phone not set"}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-background/40 p-2">
            <div className="text-xs text-muted-foreground">Coins</div>
            <div className="font-display text-lg font-black text-coin">{coins}</div>
          </div>
          <div className="rounded-lg bg-background/40 p-2">
            <div className="text-xs text-muted-foreground">Bots</div>
            <div className="font-display text-lg font-black">{botsDeployed}</div>
          </div>
          <div className="rounded-lg bg-background/40 p-2">
            <div className="text-xs text-muted-foreground">Games</div>
            <div className="font-display text-lg font-black">{gamesPlayed}</div>
          </div>
        </div>
      </Card>

      <Card className="mt-4 border-border/60 bg-gradient-card p-4">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Account</Label>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-mono">{phoneNumber || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-mono text-xs">{email || "—"}</span>
          </div>
        </div>
      </Card>

      <Card className="mt-4 border-coin/30 bg-gradient-card p-4">
        <div className="flex items-center gap-2 text-coin">
          <Gift className="h-5 w-5" />
          <span className="font-display font-bold">Refer & Earn 30 coins</span>
        </div>
        <Label className="mt-3 block text-xs uppercase tracking-widest text-muted-foreground">
          Your referral code
        </Label>
        <div className="mt-2 flex gap-2">
          <div className="flex-1 rounded-md border border-coin/30 bg-coin/10 px-3 py-2 font-mono text-lg font-bold text-coin">
            {referralCode}
          </div>
          <Button onClick={copyCode} variant="secondary" size="icon" aria-label="Copy code">
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        <Label className="mt-4 block text-xs uppercase tracking-widest text-muted-foreground">
          Your referral link
        </Label>
        <div className="mt-2 flex gap-2">
          <div className="flex-1 truncate rounded-md border border-coin/20 bg-background/40 px-3 py-2 font-mono text-xs">
            {referralLink}
          </div>
          <Button onClick={copyLink} variant="secondary" size="icon" aria-label="Copy link">
            <Copy className="h-4 w-4" />
          </Button>
          <Button onClick={shareLink} className="bg-gradient-coin text-coin-foreground" size="icon" aria-label="Share">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Friends who sign up via your link automatically earn you 30 coins.
        </p>

        <Label className="mt-4 block text-xs uppercase tracking-widest text-muted-foreground">
          Or redeem a friend's code manually
        </Label>
        <div className="mt-2 flex gap-2">
          <Input
            value={refInput}
            onChange={(e) => setRefInput(e.target.value.toUpperCase())}
            placeholder="TWXXXXXX"
            maxLength={20}
            className="bg-background/60 font-mono uppercase"
          />
          <Button onClick={redeem} className="bg-gradient-coin text-coin-foreground">
            Redeem
          </Button>
        </div>
      </Card>

      <Card className="mt-4 border-border/60 bg-gradient-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <History className="h-4 w-4" />
          <span className="font-display text-sm font-bold uppercase tracking-widest">Recent activity</span>
        </div>
        <div className="mt-3 divide-y divide-border">
          {transactions.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No activity yet</p>
          )}
          {transactions.slice(0, 15).map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm">{t.description}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(t.timestamp).toLocaleString()}
                </div>
              </div>
              <div className={`font-display font-bold ${t.amount > 0 ? "text-win" : "text-lose"}`}>
                {t.amount > 0 ? "+" : ""}
                {t.amount}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </AppLayout>
  );
};

export default Profile;
