// TECHWOLF254_API: save-order
// Records a service order/usage event in the central transactions table.
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
    const userJwt = await resolveJwt(req, body);
    if (!userJwt) return json({ error: "Unauthorized" }, 401);
    const { data: ud } = await sb.auth.getUser(userJwt);
    if (!ud?.user) return json({ error: "Invalid token" }, 401);

    const description = String(body.description || "Service order").slice(0, 240);
    const amount = 0;
    const type = "service_order";

    const { data, error } = await sb
      .from("transactions")
      .insert({ user_id: ud.user.id, type, amount: -amount, description })
      .select()
      .single();
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, order_id: data.id });
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
