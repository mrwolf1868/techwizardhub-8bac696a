import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/integrations/supabase/client";

export type Transaction = {
  id: string;
  type: "welcome" | "referral" | "purchase" | "deploy" | "game_win" | "game_loss";
  amount: number;
  description: string;
  timestamp: number;
};

export type Bot = {
  id: string;
  phoneNumber: string;
  deployedAt: number;
  code: string;
  status?: "connected" | "disconnected" | "pending";
};

type UserState = {
  initialized: boolean;
  userId: string | null;
  phoneNumber: string | null;
  email: string | null;
  coins: number;
  gamesPlayed: number;
  botsDeployed: number;
  referralCode: string;
  agreedToTerms: boolean;
  transactions: Transaction[];
  bots: Bot[];
  isAdmin: boolean;

  init: () => void;
  syncFromSupabase: () => Promise<void>;
  migrateLocalToAccount: (userId: string) => Promise<void>;
  applyPendingReferral: (code: string) => void;
  acceptTerms: () => void;
  setPhone: (phone: string) => void;
  addCoins: (amount: number, type: Transaction["type"], description: string) => void;
  spendCoins: (amount: number, type: Transaction["type"], description: string) => boolean;
  recordGame: () => void;
  deployBot: (phoneNumber: string, code: string) => Bot | null;
  markBotConnected: (botId: string) => void;
  redeemReferral: (code: string) => boolean;
  signOutLocal: () => void;
  reset: () => void;
};

const generateReferralCode = () =>
  "TW" + Math.random().toString(36).substring(2, 8).toUpperCase();

const LOCAL_REF_PENDING = "twh-pending-ref";

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      initialized: false,
      userId: null,
      phoneNumber: null,
      email: null,
      coins: 0,
      gamesPlayed: 0,
      botsDeployed: 0,
      referralCode: "",
      agreedToTerms: false,
      transactions: [],
      bots: [],
      isAdmin: false,

      init: () => {
        const s = get();
        if (s.initialized) return;
        // Welcome bonus is granted server-side on registration (handle_new_user trigger).
        // Do NOT credit coins locally — only a logged-in user will see their balance after sync.
        set({
          initialized: true,
          coins: 0,
          referralCode: s.referralCode || generateReferralCode(),
          transactions: [],
        });
      },

      syncFromSupabase: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          set({ userId: null, isAdmin: false });
          return;
        }

        const [{ data: profile }, { data: txs }, { data: bots }, { data: roles }] =
          await Promise.all([
            supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
            supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
            supabase.from("bots").select("*").eq("user_id", user.id).order("deployed_at", { ascending: false }),
            supabase.from("user_roles").select("role").eq("user_id", user.id),
          ]);

        if (!profile) return;

        set({
          userId: user.id,
          phoneNumber: profile.phone,
          email: profile.email,
          coins: profile.coins,
          gamesPlayed: profile.games_played,
          botsDeployed: profile.bots_deployed,
          referralCode: profile.referral_code,
          isAdmin: (roles || []).some((r: { role: string }) => r.role === "admin"),
          transactions: (txs || []).map((t) => ({
            id: t.id,
            type: t.type as Transaction["type"],
            amount: t.amount,
            description: t.description,
            timestamp: new Date(t.created_at).getTime(),
          })),
          bots: (bots || []).map((b) => ({
            id: b.id,
            phoneNumber: b.phone_number,
            code: b.code,
            deployedAt: new Date(b.deployed_at).getTime(),
            status: (b.status as "connected" | "disconnected") ?? "pending",
          })),
        });
      },

      migrateLocalToAccount: async (userId) => {
        const s = get();

        // Server-side trigger already grants the 70-coin welcome bonus on registration.
        // We ONLY migrate bots from the device — coins and transactions are authoritative on the server
        // to prevent any duplication of the welcome bonus or replayed local activity.
        if (s.bots.length > 0) {
          await supabase.from("bots").insert(
            s.bots.map((b) => ({
              user_id: userId,
              phone_number: b.phoneNumber,
              code: b.code,
            }))
          );
        }
      },

      applyPendingReferral: (code) => {
        const c = code.trim().toUpperCase();
        if (!c) return;
        localStorage.setItem(LOCAL_REF_PENDING, c);
        setTimeout(() => get().redeemReferral(c), 0);
      },

      acceptTerms: () => set({ agreedToTerms: true }),
      setPhone: (phone) => set({ phoneNumber: phone }),

      addCoins: (amount, type, description) => {
        const s = get();
        const newCoins = s.coins + amount;
        set({
          coins: newCoins,
          transactions: [
            { id: crypto.randomUUID(), type, amount, description, timestamp: Date.now() },
            ...s.transactions,
          ].slice(0, 50),
        });
        // Persist to Supabase if logged in
        if (s.userId) {
          supabase.from("profiles").update({ coins: newCoins }).eq("user_id", s.userId).then();
          supabase.from("transactions").insert({
            user_id: s.userId,
            type,
            amount,
            description,
          }).then();
        }
      },

      spendCoins: (amount, type, description) => {
        const s = get();
        if (s.coins < amount) return false;
        const newCoins = s.coins - amount;
        set({
          coins: newCoins,
          transactions: [
            { id: crypto.randomUUID(), type, amount: -amount, description, timestamp: Date.now() },
            ...s.transactions,
          ].slice(0, 50),
        });
        if (s.userId) {
          supabase.from("profiles").update({ coins: newCoins }).eq("user_id", s.userId).then();
          supabase.from("transactions").insert({
            user_id: s.userId,
            type,
            amount: -amount,
            description,
          }).then();
        }
        return true;
      },

      recordGame: () => {
        const s = get();
        const n = s.gamesPlayed + 1;
        set({ gamesPlayed: n });
        if (s.userId) {
          supabase.from("profiles").update({ games_played: n }).eq("user_id", s.userId).then();
        }
      },

      deployBot: (phoneNumber, code) => {
        const s = get();
        if (s.coins < 70) return null;
        const ok = get().spendCoins(70, "deploy", `Bot deploy for ${phoneNumber}`);
        if (!ok) return null;
        const bot: Bot = {
          id: crypto.randomUUID(),
          phoneNumber,
          deployedAt: Date.now(),
          code,
          status: "pending",
        };
        const newCount = get().botsDeployed + 1;
        set({ bots: [bot, ...get().bots], botsDeployed: newCount });
        if (s.userId) {
          supabase.from("bots").insert({
            user_id: s.userId,
            phone_number: phoneNumber,
            code,
            status: "pending",
          }).then();
          supabase.from("profiles").update({ bots_deployed: newCount, last_active: new Date().toISOString() }).eq("user_id", s.userId).then();
          supabase.from("activity_logs").insert({
            user_id: s.userId,
            actor_id: s.userId,
            event: "deploy",
            detail: `Bot deployed for ${phoneNumber}`,
          }).then();
        }
        return bot;
      },

      markBotConnected: (botId) => {
        const s = get();
        const bot = s.bots.find((b) => b.id === botId);
        if (!bot) return;
        set({
          bots: s.bots.map((b) => (b.id === botId ? { ...b, status: "connected" } : b)),
        });
        if (s.userId) {
          supabase
            .from("bots")
            .update({ status: "connected", last_active: new Date().toISOString() })
            .eq("id", botId)
            .eq("user_id", s.userId)
            .then();
          supabase.from("activity_logs").insert({
            user_id: s.userId,
            actor_id: s.userId,
            event: "connect",
            detail: `Bot connected for ${bot.phoneNumber}`,
          }).then();
        }
      },

      redeemReferral: (code) => {
        const s = get();
        if (!code || code === s.referralCode) return false;
        const used = s.transactions.some(
          (t) => t.type === "referral" && t.description.includes(code)
        );
        if (used) return false;
        get().addCoins(30, "referral", `Referral bonus from ${code}`);
        return true;
      },

      signOutLocal: () =>
        set({
          userId: null,
          phoneNumber: null,
          email: null,
          isAdmin: false,
          coins: 0,
          gamesPlayed: 0,
          botsDeployed: 0,
          referralCode: "",
          transactions: [],
          bots: [],
          initialized: false,
        }),

      reset: () =>
        set({
          initialized: false,
          userId: null,
          phoneNumber: null,
          email: null,
          coins: 0,
          gamesPlayed: 0,
          botsDeployed: 0,
          referralCode: "",
          agreedToTerms: false,
          transactions: [],
          bots: [],
          isAdmin: false,
        }),
    }),
    { name: "techwizard-hub-user" }
  )
);
