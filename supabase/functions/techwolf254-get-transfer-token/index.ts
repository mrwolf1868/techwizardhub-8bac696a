// TECHWOLF254_API: get-transfer-token
// Issues a short-lived signed token that a child mini-service can exchange
// (via verify-transfer-token) to silently inherit the parent user.
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
    const slug = String(body.child_slug || "").trim();
    if (!slug) return json({ error: "child_slug required" }, 400);

    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userJwt = auth.replace("Bearer ", "");
    const { data: ud } = await sb.auth.getUser(userJwt);
    if (!ud?.user) return json({ error: "Invalid token" }, 401);

    // make sure child exists & enabled
    const { data: child } = await sb
      .from("child_projects")
      .select("slug, enabled, url, name")
      .eq("slug", slug)
      .maybeSingle();
    if (!child || !child.enabled) return json({ error: "Service unavailable" }, 404);

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { error } = await sb.from("transfer_tokens").insert({
      token,
      user_id: ud.user.id,
      child_slug: slug,
      expires_at,
    });
    if (error) return json({ error: error.message }, 500);
    return json({ token, expires_at, child_name: child.name });
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
