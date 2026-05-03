import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://web-production-2646.up.railway.app";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

const generateFallbackCode = (phone: string) => {
  const digits = onlyDigits(phone);
  let hash = 0;
  for (let i = 0; i < digits.length; i++) {
    hash = (hash * 31 + digits.charCodeAt(i)) >>> 0;
  }
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  let n = hash;
  for (let i = 0; i < 8; i++) {
    out += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length) + 7 + i;
  }
  return out.slice(0, 4) + "-" + out.slice(4);
};

const extractCode = (html: string): string | null => {
  if (!html) return null;
  const patterns = [
    /\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/,
    /pair(?:ing)?[^A-Z0-9]{0,20}([A-Z0-9]{4,8}-?[A-Z0-9]{0,4})/i,
    /code[^A-Z0-9]{0,20}([A-Z0-9]{4,8}-?[A-Z0-9]{0,4})/i,
    /\b([A-Z0-9]{8})\b/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) return m[1].toUpperCase();
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Resolve user_id from JWT if present (non-fatal)
  let userId: string | null = null;
  try {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const anon = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data } = await anon.auth.getUser(token);
      userId = data.user?.id ?? null;
    }
  } catch (_) { /* ignore */ }

  try {
    const { phone } = await req.json().catch(() => ({ phone: "" }));
    const digits = onlyDigits(String(phone || ""));
    if (digits.length < 8 || digits.length > 15) {
      await admin.from("pairing_logs").insert({
        user_id: userId, phone_number: digits || "(invalid)",
        status: "failed", detail: "Invalid phone number",
      });
      return new Response(JSON.stringify({ error: "Invalid phone number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anti-spam: read max attempts setting
    const { data: setting } = await admin
      .from("admin_settings")
      .select("value")
      .eq("key", "max_pairing_attempts_per_hour")
      .maybeSingle();
    const maxAttempts = Number(setting?.value ?? 10);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("pairing_logs")
      .select("*", { count: "exact", head: true })
      .eq("phone_number", digits)
      .gte("created_at", since);
    if ((count ?? 0) >= maxAttempts) {
      await admin.from("pairing_logs").insert({
        user_id: userId, phone_number: digits,
        status: "failed", detail: "Rate limit exceeded",
      });
      return new Response(JSON.stringify({ error: "Too many pairing attempts. Try again later." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let code: string | null = null;
    let source: "upstream" | "fallback" = "fallback";

    try {
      const upstream = await fetch(
        `${BASE_URL}/?number=${encodeURIComponent(digits)}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
            Accept: "text/html,application/json,*/*",
          },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (upstream.ok) {
        const text = await upstream.text();
        try {
          const j = JSON.parse(text);
          code = j.code || j.pairCode || j.pairing_code || null;
        } catch (_) { /* scrape */ }
        if (!code) code = extractCode(text);
        if (code) source = "upstream";
      }
    } catch (_) { /* fallback */ }

    if (!code) {
      await admin.from("pairing_logs").insert({
        user_id: userId, phone_number: digits,
        status: "failed", detail: "Upstream did not return a pairing code",
      });
      return new Response(
        JSON.stringify({ error: "Pairing service is busy. Please try again in a moment." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await admin.from("pairing_logs").insert({
      user_id: userId, phone_number: digits,
      status: "success", detail: `source=${source}`,
    });

    return new Response(JSON.stringify({ code, source }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
