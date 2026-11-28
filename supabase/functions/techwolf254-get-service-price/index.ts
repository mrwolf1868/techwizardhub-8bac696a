// TECHWOLF254_API: get-service-price
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-techwolf254-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Please sign in" }, 401);
    const { data: { user } } = await sb.auth.getUser(auth.slice(7));
    if (!user) return json({ error: "Please sign in" }, 401);
    let key = "";
    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      key = String(b.service_key || "").trim();
    } else {
      key = new URL(req.url).searchParams.get("service_key") || "";
    }
    if (!key) {
      const { data } = await sb
        .from("service_pricing")
        .select("service_key, name, price_coins, continuation_price_coins, enabled")
        .eq("enabled", true);
      return json({ services: data || [] });
    }
    const { data } = await sb
      .from("service_pricing")
      .select("service_key, name, price_coins, continuation_price_coins, enabled")
      .eq("service_key", key)
      .maybeSingle();
    if (!data) return json({ error: "Not found" }, 404);
    return json(data);
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
