// TECHWOLF254_API: deduct-wallet
// Atomically deducts coins from a user's balance and writes a transaction.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-techwolf254-secret",
};
const INTERNAL_SECRET = Deno.env.get("TECHWOLF254_INTERNAL_SECRET")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const description = String(body.description || "Service deduction");
    const type = String(body.type || "deploy");
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000)
      return json({ error: "Invalid amount" }, 400);

    const userJwt = await resolveJwt(req, body);
    if (!userJwt) return json({ error: "Unauthorized" }, 401);
    const { data: ud } = await sb.auth.getUser(userJwt);
    if (!ud?.user) return json({ error: "Invalid token" }, 401);
    const uid = ud.user.id;

    const { data: p } = await sb
      .from("profiles")
      .select("coins, banned")
      .eq("user_id", uid)
      .maybeSingle();
    if (!p) return json({ error: "Profile not found" }, 404);
    if (p.banned) return json({ error: "Account banned" }, 403);
    if (p.coins < amount) return json({ error: "Insufficient balance", balance: p.coins }, 402);

    const newBalance = p.coins - amount;
    const { error: uErr } = await sb
      .from("profiles")
      .update({ coins: newBalance })
      .eq("user_id", uid)
      .eq("coins", p.coins); // optimistic lock
    if (uErr) return json({ error: "Update failed", detail: uErr.message }, 500);

    await sb.from("transactions").insert({
      user_id: uid,
      type,
      amount: -amount,
      description,
    });

    return json({ user_id: uid, balance: newBalance, deducted: amount });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

async function resolveJwt(req: Request, body: any): Promise<string | null> {
  const internal = req.headers.get("x-techwolf254-secret");
  if (internal && internal === INTERNAL_SECRET) return body.user_token || null;
  const a = req.headers.get("authorization") || "";
  return a.startsWith("Bearer ") ? a.replace("Bearer ", "") : null;
}
function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
