import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Legacy reset codes were exposed to callers. Never accept them or mint replacements.
// Hosted Auth recovery replaces this flow after real email sign-in is enabled.
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(JSON.stringify({
    error: "Password recovery is temporarily unavailable while email verification is being configured.",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
});
