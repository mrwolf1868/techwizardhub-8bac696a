import { useState } from "react";
import { useUserStore } from "@/store/userStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck } from "lucide-react";

export const AgreementGate = () => {
  const agreed = useUserStore((s) => s.agreedToTerms);
  const accept = useUserStore((s) => s.acceptTerms);
  const [checked, setChecked] = useState(false);

  return (
    <Dialog open={!agreed}>
      <DialogContent
        className="max-w-md border-primary/30 bg-gradient-card"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
            <ShieldCheck className="h-7 w-7 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center font-display text-2xl">
            User Agreement
          </DialogTitle>
          <DialogDescription className="text-center">
            You must accept the terms to use TECHWIZARD Hub.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-56 rounded-lg border border-border bg-background/40 p-4 text-sm">
          <ul className="space-y-3 text-muted-foreground">
            <li>
              <strong className="text-foreground">Virtual credits.</strong> Coins are virtual platform credits with no monetary value off-platform.
            </li>
            <li>
              <strong className="text-foreground">No refunds or withdrawals.</strong> All purchases are final. Coins cannot be exchanged for cash.
            </li>
            <li>
              <strong className="text-foreground">Purchased coins usage.</strong> Purchased coins can only be used for bot deployment.
            </li>
            <li>
              <strong className="text-foreground">Game risk.</strong> Coins staked in games (Avicoins, Lucky Spin) may be lost. Play responsibly.
            </li>
            <li>
              <strong className="text-foreground">Fair use.</strong> Cheating, abuse of the referral system, or fraudulent payments will result in account suspension.
            </li>
            <li>
              <strong className="text-foreground">Payments.</strong> M-Pesa payments are for platform usage only.
            </li>
          </ul>
        </ScrollArea>

        <label className="flex items-start gap-3 rounded-lg border border-border p-3">
          <Checkbox
            id="agree"
            checked={checked}
            onCheckedChange={(v) => setChecked(v === true)}
            className="mt-0.5"
          />
          <span className="text-sm">
            I have read and agree to the TECHWIZARD Hub terms.
          </span>
        </label>

        <Button
          variant="default"
          size="lg"
          disabled={!checked}
          onClick={accept}
          className="w-full bg-gradient-primary font-display font-bold tracking-wider shadow-glow hover:opacity-90"
        >
          Accept & Continue
        </Button>
      </DialogContent>
    </Dialog>
  );
};
