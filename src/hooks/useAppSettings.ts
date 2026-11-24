import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WalletLimits = { min_deposit: number; max_deposit: number; min_withdraw: number; max_withdraw: number };
export type StakeLimits = { min: number; max: number };
export type Announcement = { enabled: boolean; text: string };
export type AppSettings = { lockedGames: string[]; stakeLimits: StakeLimits; walletLimits: WalletLimits; announcement: Announcement };

export const DEFAULT_SETTINGS: AppSettings = {
  lockedGames: [],
  stakeLimits: { min: 1, max: 100000 },
  walletLimits: { min_deposit: 1, max_deposit: 70000, min_withdraw: 10, max_withdraw: 150000 },
  announcement: { enabled: false, text: "" },
};

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback);

export const APP_SETTINGS_KEY = ["app-settings"];

/** Public game and wallet rules the admin controls. The server enforces the same values. */
export const useAppSettings = () => {
  const { data } = useQuery({
    queryKey: APP_SETTINGS_KEY,
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase.from("admin_settings").select("key,value")
        .in("key", ["locked_games", "stake_limits", "wallet_limits", "site_announcement"]);
      if (error) throw error;
      const map = Object.fromEntries((data || []).map((row) => [row.key, row.value])) as Record<string, unknown>;
      const stake = (map.stake_limits ?? {}) as Record<string, unknown>;
      const wallet = (map.wallet_limits ?? {}) as Record<string, unknown>;
      const ann = (map.site_announcement ?? {}) as Record<string, unknown>;
      const d = DEFAULT_SETTINGS;
      return {
        lockedGames: Array.isArray(map.locked_games) ? (map.locked_games as unknown[]).filter((x): x is string => typeof x === "string") : [],
        stakeLimits: { min: Math.max(1, num(stake.min, d.stakeLimits.min)), max: Math.min(100000, num(stake.max, d.stakeLimits.max)) },
        walletLimits: {
          min_deposit: Math.max(1, num(wallet.min_deposit, d.walletLimits.min_deposit)),
          max_deposit: Math.min(70000, num(wallet.max_deposit, d.walletLimits.max_deposit)),
          min_withdraw: Math.max(1, num(wallet.min_withdraw, d.walletLimits.min_withdraw)),
          max_withdraw: Math.min(150000, num(wallet.max_withdraw, d.walletLimits.max_withdraw)),
        },
        announcement: { enabled: ann.enabled === true, text: typeof ann.text === "string" ? ann.text : "" },
      };
    },
    staleTime: 30_000,
  });
  return data ?? DEFAULT_SETTINGS;
};
