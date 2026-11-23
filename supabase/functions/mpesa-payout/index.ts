import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { loadPayoutConfig, sendB2C } from "../_shared/mpesaPayout.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status") }),
  z.object({ action: z.literal("wallet"), amount: z.number().int().min(10).max(150000), phone: z.string().regex(/^254[17]\d{8}$/) }),
  z.object({ action: z.literal("profit"), amount: z.number().int().min(10).max(150000), phone: z.string().regex(/^254[17]\d{8}$/) }),
  z.object({ action: z.literal("send_pending"), withdrawalId: z.string().uuid() }),
]);

const NOT_READY = "Withdrawals are not available right now because M-Pesa payouts are not set up. No money was taken from your balance.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Please sign in" }, 401);
    const { data: { user } } = await admin.auth.getUser(auth.slice(7));
    if (!user) return json({ error: "Please sign in" }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Check the amount (KSh 10 – 150,000) and M-Pesa number" }, 400);
    const body = parsed.data;

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const cfg = await loadPayoutConfig(admin);

    if (body.action === "status") return json({ ready: !!cfg });
    if ((body.action === "profit" || body.action === "send_pending") && !isAdmin) return json({ error: "Admins only" }, 403);
    if (!cfg) return json({ error: NOT_READY, notConfigured: true }, 503);

    let kind: "wallet" | "profit";
    let id: string;
    let phone: string;
    let amount: number;

    if (body.action === "send_pending") {
      const { data: w } = await admin.from("wallet_withdrawals").select("id,phone,amount,status").eq("id", body.withdrawalId).maybeSingle();
      if (!w || w.status !== "pending") return json({ error: "This request is no longer waiting to be sent" }, 409);
      kind = "wallet"; id = w.id; phone = w.phone; amount = w.amount;
    } else {
      kind = body.action;
      phone = body.phone; amount = body.amount;
      const fn = kind === "wallet" ? "payout_reserve_wallet" : "payout_reserve_profit";
      const { data, error } = await admin.rpc(fn, { _uid: user.id, _amount: amount, _phone: phone });
      if (error || !data) return json({ error: error?.message ?? "Could not start the withdrawal" }, 400);
      id = data as string;
    }

    const result = await sendB2C(cfg, phone, amount, kind === "wallet" ? "TECHWOLFpro withdrawal" : "TECHWOLFpro fees");
    if (!result.ok) {
      await admin.rpc("payout_complete", { _kind: kind, _id: id, _conversation_id: null, _originator_id: null, _success: false, _receipt: null, _desc: result.error });
      return json({ error: `M-Pesa did not accept the payout: ${result.error}. Your balance was returned.` }, 502);
    }
    await admin.rpc("payout_mark_processing", { _kind: kind, _id: id, _conversation_id: result.conversationId, _originator_id: result.originatorId });
    return json({ success: true, id, status: "processing" });
  } catch (e) {
    console.error("payout error", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
