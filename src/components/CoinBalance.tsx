import { Coins } from "lucide-react";
import { useUserStore } from "@/store/userStore";

export const CoinBalance = ({ size = "sm" }: { size?: "sm" | "lg" }) => {
  const coins = useUserStore((s) => s.coins);
  if (size === "lg") {
    return (
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-coin shadow-coin animate-pulse-glow">
          <Coins className="h-7 w-7 text-coin-foreground" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Coin balance</span>
          <span className="font-display text-4xl font-black text-gradient-coin leading-none">
            {coins.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-full border border-coin/30 bg-coin/10 px-3 py-1.5">
      <Coins className="h-4 w-4 text-coin" strokeWidth={2.5} />
      <span className="font-display text-sm font-bold text-coin">{coins.toLocaleString()}</span>
    </div>
  );
};
