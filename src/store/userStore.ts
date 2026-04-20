import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Transaction = {
  id: string;
  type: "welcome" | "referral" | "purchase" | "deploy" | "game_win" | "game_loss";
  amount: number; // positive credit, negative debit
  description: string;
  timestamp: number;
};

export type Bot = {
  id: string;
  phoneNumber: string;
  deployedAt: number;
  link: string;
};

type UserState = {
  initialized: boolean;
  phoneNumber: string | null;
  coins: number;
  gamesPlayed: number;
  botsDeployed: number;
  referralCode: string;
  agreedToTerms: boolean;
  transactions: Transaction[];
  bots: Bot[];

  init: () => void;
  acceptTerms: () => void;
  setPhone: (phone: string) => void;
  addCoins: (amount: number, type: Transaction["type"], description: string) => void;
  spendCoins: (amount: number, type: Transaction["type"], description: string) => boolean;
  recordGame: () => void;
  deployBot: (phoneNumber: string) => Bot | null;
  redeemReferral: (code: string) => boolean;
  reset: () => void;
};

const generateReferralCode = () =>
  "TW" + Math.random().toString(36).substring(2, 8).toUpperCase();

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      initialized: false,
      phoneNumber: null,
      coins: 0,
      gamesPlayed: 0,
      botsDeployed: 0,
      referralCode: "",
      agreedToTerms: false,
      transactions: [],
      bots: [],

      init: () => {
        const s = get();
        if (s.initialized) return;
        set({
          initialized: true,
          coins: 70,
          referralCode: generateReferralCode(),
          transactions: [
            {
              id: crypto.randomUUID(),
              type: "welcome",
              amount: 70,
              description: "Welcome bonus 🎉",
              timestamp: Date.now(),
            },
          ],
        });
      },

      acceptTerms: () => set({ agreedToTerms: true }),
      setPhone: (phone) => set({ phoneNumber: phone }),

      addCoins: (amount, type, description) => {
        const s = get();
        set({
          coins: s.coins + amount,
          transactions: [
            { id: crypto.randomUUID(), type, amount, description, timestamp: Date.now() },
            ...s.transactions,
          ].slice(0, 50),
        });
      },

      spendCoins: (amount, type, description) => {
        const s = get();
        if (s.coins < amount) return false;
        set({
          coins: s.coins - amount,
          transactions: [
            { id: crypto.randomUUID(), type, amount: -amount, description, timestamp: Date.now() },
            ...s.transactions,
          ].slice(0, 50),
        });
        return true;
      },

      recordGame: () => set({ gamesPlayed: get().gamesPlayed + 1 }),

      deployBot: (phoneNumber) => {
        const s = get();
        if (s.coins < 70) return null;
        const ok = get().spendCoins(70, "deploy", `Bot deploy for ${phoneNumber}`);
        if (!ok) return null;
        const bot: Bot = {
          id: crypto.randomUUID(),
          phoneNumber,
          deployedAt: Date.now(),
          link: `https://web-production-2646.up.railway.app/?number=${encodeURIComponent(phoneNumber)}`,
        };
        set({ bots: [bot, ...get().bots], botsDeployed: get().botsDeployed + 1 });
        return bot;
      },

      redeemReferral: (code) => {
        const s = get();
        if (!code || code === s.referralCode) return false;
        // Prevent reuse
        const used = s.transactions.some(
          (t) => t.type === "referral" && t.description.includes(code)
        );
        if (used) return false;
        get().addCoins(30, "referral", `Referral bonus from ${code}`);
        return true;
      },

      reset: () =>
        set({
          initialized: false,
          phoneNumber: null,
          coins: 0,
          gamesPlayed: 0,
          botsDeployed: 0,
          referralCode: "",
          agreedToTerms: false,
          transactions: [],
          bots: [],
        }),
    }),
    { name: "techwizard-hub-user" }
  )
);
