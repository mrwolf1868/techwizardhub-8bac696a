// TECHWOLF254_API: verify-transfer-token
// Called by child mini-services (with TECHWOLF254_INTERNAL_SECRET) to exchange
// a transfer token for the canonical user identity + balance.
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
    const internal = req.headers.get("x-techwolf254-secret");
    if (!internal || internal !== INTERNAL_SECRET)
      return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const expectedSlug = String(body.child_slug || "").trim();
    if (!token || !expectedSlug) return json({ error: "token + child_slug required" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: t } = await sb
      .from("transfer_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (!t) return json({ error: "Invalid token" }, 401);
    if (t.consumed) return json({ error: "Token already used" }, 401);
    if (new Date(t.expires_at).getTime() < Date.now())
      return json({ error: "Token expired" }, 401);
    if (t.child_slug !== expectedSlug)
      return json({ error: "Token mismatch" }, 401);

    const { data: child } = await sb.from("child_projects").select("id").eq("slug", expectedSlug).eq("enabled", true).maybeSingle();
    if (!child) return json({ error: "Service unavailable" }, 403);

    const { data: consumed, error: consumeError } = await sb.from("transfer_tokens")
      .update({ consumed: true }).eq("id", t.id).eq("consumed", false)
      .gt("expires_at", new Date().toISOString()).select("id").maybeSingle();
    if (consumeError || !consumed) return json({ error: "Token expired or already used" }, 401);

    const { data: p } = await sb
      .from("profiles")
      .select("user_id, phone, email, coins, banned")
      .eq("user_id", t.user_id)
      .maybeSingle();
    if (!p) return json({ error: "Profile not found" }, 404);
    if (p.banned) return json({ error: "Banned" }, 403);

    return json({
      user_id: p.user_id,
      phone: p.phone,
      email: p.email,
      balance: p.coins,
      child_slug: t.child_slug,
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
