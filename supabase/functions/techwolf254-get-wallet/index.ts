// TECHWOLF254_API: get-wallet
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-techwolf254-secret",
};
const INTERNAL_SECRET = Deno.env.get("TECHWOLF254_INTERNAL_SECRET")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const userJwt = await resolveJwt(req);
    if (!userJwt) return json({ error: "Unauthorized" }, 401);
    const { data: ud } = await sb.auth.getUser(userJwt);
    if (!ud?.user) return json({ error: "Invalid token" }, 401);
    const { data: p } = await sb
      .from("profiles")
      .select("coins")
      .eq("user_id", ud.user.id)
      .maybeSingle();
    if (!p) return json({ error: "Profile not found" }, 404);
    return json({ user_id: ud.user.id, balance: p.coins });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

async function resolveJwt(req: Request): Promise<string | null> {
  const internal = req.headers.get("x-techwolf254-secret");
  if (internal && internal === INTERNAL_SECRET) {
    const b = await req.clone().json().catch(() => ({}));
    return b.user_token || null;
  }
  const a = req.headers.get("authorization") || "";
  return a.startsWith("Bearer ") ? a.replace("Bearer ", "") : null;
}
function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
