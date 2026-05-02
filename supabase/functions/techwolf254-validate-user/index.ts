// TECHWOLF254_API: validate-user
// Verifies a user's auth token and returns their canonical identity + balance.
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
    const internal = req.headers.get("x-techwolf254-secret");
    const isInternal = internal && internal === INTERNAL_SECRET;

    let userJwt: string | null = null;
    if (!isInternal) {
      const auth = req.headers.get("authorization") || "";
      if (!auth.startsWith("Bearer ")) {
        return json({ error: "Unauthorized" }, 401);
      }
      userJwt = auth.replace("Bearer ", "");
    } else {
      const body = await req.clone().json().catch(() => ({}));
      userJwt = body.user_token || null;
      if (!userJwt) return json({ error: "user_token required for internal calls" }, 400);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: userData, error } = await sb.auth.getUser(userJwt);
    if (error || !userData?.user) return json({ error: "Invalid token" }, 401);

    const u = userData.user;
    const { data: profile } = await sb
      .from("profiles")
      .select("user_id, phone, email, coins, banned, referral_code")
      .eq("user_id", u.id)
      .maybeSingle();
    if (!profile) return json({ error: "Profile not found" }, 404);
    if (profile.banned) return json({ error: "Account banned" }, 403);

    return json({
      user_id: profile.user_id,
      phone: profile.phone,
      email: profile.email,
      balance: profile.coins,
      referral_code: profile.referral_code,
      auth_token: userJwt,
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
