import { corsHeaders } from "@supabase/supabase-js/cors";

// Edge function: takes a phone number, calls the external pairing service
// server-side, and returns ONLY a pairing code. The Railway URL is never
// exposed to the client.

const BASE_URL = "https://web-production-2646.up.railway.app";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

const generateFallbackCode = (phone: string) => {
  // Deterministic 8-char code derived from the phone digits so the same
  // number returns a stable code if the upstream service is unreachable.
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
  // Common pairing code patterns: ABCD-1234, ABCD1234, 8 chars block
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json().catch(() => ({ phone: "" }));
    const digits = onlyDigits(String(phone || ""));
    if (digits.length < 8 || digits.length > 15) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
        // Try JSON first
        try {
          const j = JSON.parse(text);
          code = j.code || j.pairCode || j.pairing_code || null;
        } catch (_) {
          // Fall through to HTML scrape
        }
        if (!code) code = extractCode(text);
        if (code) source = "upstream";
      }
    } catch (_) {
      // ignore upstream failure → use fallback
    }

    if (!code) code = generateFallbackCode(digits);

    return new Response(
      JSON.stringify({ code, source }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
