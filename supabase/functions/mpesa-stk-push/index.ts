import { loadStkConfig } from "../_shared/stkConfig.ts";
import { corsHeaders } from "npm:@supabase/supabase-js/cors";
import { createClient } from "npm:@supabase/supabase-js";

const ENDPOINTS = {
  sandbox: {
    oauth: "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    stk: "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
  },
  production: {
    oauth: "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    stk: "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
  },
};

const normalizePhone = (raw: string): string | null => {
  if (!raw) return null;
  let s = raw.replace(/[\s\-()+]/g, "").trim();
  if (s.startsWith("00")) s = s.slice(2);
  if (/^0[17]\d{8}$/.test(s)) s = "254" + s.slice(1);
  if (!/^254[17]\d{8}$/.test(s)) return null;
  return s;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    const raw = await req.text();
    if (raw.length > 4096) return new Response("Invalid request", { status: 400, headers: corsHeaders });
    const { phone, amount } = JSON.parse(raw);
    const clientId = crypto.randomUUID();

    const normalized = normalizePhone(String(phone || ""));
    const amt = typeof amount === "number" && Number.isInteger(amount) ? amount : NaN;

    if (!normalized) {
      return new Response(JSON.stringify({ error: "Invalid phone. Use a valid Safaricom number (2547XXXXXXXX)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Number.isFinite(amt) || amt < 1 || amt > 70000) {
      return new Response(JSON.stringify({ error: "Amount must be between 1 and 70,000 KES." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!clientId || typeof clientId !== "string") {
      return new Response(JSON.stringify({ error: "Missing clientId." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve user from JWT (so coins are credited to the right account on callback)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id ?? null;
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "You must be signed in to buy coins." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin-set deposit limits
    {
      const { data: lim } = await supabase.from("admin_settings").select("value").eq("key", "wallet_limits").maybeSingle();
      const v = (lim?.value ?? {}) as Record<string, unknown>;
      const minDep = typeof v.min_deposit === "number" ? Math.max(1, Math.floor(v.min_deposit)) : 1;
      const maxDep = typeof v.max_deposit === "number" ? Math.min(70000, Math.floor(v.max_deposit)) : 70000;
      if (amt < minDep || amt > maxDep) {
        return new Response(JSON.stringify({ error: `Deposits must be from KSh ${minDep} to KSh ${maxDep.toLocaleString()}.` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { consumerKey, consumerSecret, passkey, shortcode, tillNumber, mpesaEnv } = await loadStkConfig(supabase);

    if (!consumerKey || !consumerSecret || !passkey || !shortcode || !tillNumber) {
      return new Response(JSON.stringify({
        error: "Payments are not yet available. Please try again shortly.",
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { oauth: OAUTH_URL, stk: STK_URL } = ENDPOINTS[mpesaEnv];

    // 1) OAuth
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenResp = await fetch(OAUTH_URL, { headers: { Authorization: `Basic ${auth}` } });
    if (!tokenResp.ok) {
      console.error("Payment authentication failed", tokenResp.status);
      return new Response(JSON.stringify({ error: "Payment service unavailable" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { access_token } = await tokenResp.json();

    // 2) Build BuyGoodsOnline STK push payload
    const ts = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${ts}`);

    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${projectUrl}/functions/v1/mpesa-callback`;

    const stkPayload = {
      BusinessShortCode: shortcode,           // Head Office / Store number for auth
      Password: password,
      Timestamp: ts,
      TransactionType: "CustomerBuyGoodsOnline",
      Amount: amt,
      PartyA: normalized,
      PartyB: tillNumber,                     // Till number where money lands
      PhoneNumber: normalized,
      CallBackURL: callbackUrl,
      AccountReference: "TechwizardHub",
      TransactionDesc: `Coins ${amt}`,
    };

    const stkResp = await fetch(STK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkPayload),
    });

    const stkData = await stkResp.json();


    if (!stkResp.ok || stkData.errorCode) {
      return new Response(
        JSON.stringify({
          error: "We couldn't start the payment. Please try again.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Persist pending transaction (linked to user)
    const { error: insErr } = await supabase.from("mpesa_transactions").insert({
      phone: normalized,
      amount: amt,
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      status: "pending",
      client_id: clientId,
      user_id: userId,
    });

    if (insErr) throw new Error("Could not record pending payment");

    return new Response(
      JSON.stringify({
        success: true,
        checkoutRequestId: stkData.CheckoutRequestID,
        customerMessage: stkData.CustomerMessage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("STK push request failed");
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
