import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Never issue or reveal legacy reset codes. Only hosted email recovery can replace this flow.
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(JSON.stringify({
    error: "Password recovery is temporarily unavailable while email verification is being configured.",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
});
