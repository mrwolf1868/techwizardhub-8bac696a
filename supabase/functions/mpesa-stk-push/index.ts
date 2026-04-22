import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "@supabase/supabase-js";

// Daraja sandbox endpoints
const OAUTH_URL = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
const STK_URL = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

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
    const { phone, amount, clientId } = await req.json();

    const normalized = normalizePhone(String(phone || ""));
    const amt = parseInt(String(amount), 10);

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

    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
    const passkey = Deno.env.get("MPESA_PASSKEY")!;
    const shortcode = Deno.env.get("MPESA_SHORTCODE")!;

    // 1) Get OAuth token
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenResp = await fetch(OAUTH_URL, { headers: { Authorization: `Basic ${auth}` } });
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      console.error("OAuth failed:", t);
      return new Response(JSON.stringify({ error: "M-Pesa auth failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { access_token } = await tokenResp.json();

    // 2) Build STK push payload
    const ts = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14); // YYYYMMDDHHMMSS
    const password = btoa(`${shortcode}${passkey}${ts}`);

    const projectId = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${projectId}/functions/v1/mpesa-callback`;

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: amt,
      PartyA: normalized,
      PartyB: shortcode,
      PhoneNumber: normalized,
      CallBackURL: callbackUrl,
      AccountReference: "TechwizardHub",
      TransactionDesc: `Coins top-up ${amt}`,
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
    console.log("STK response:", stkData);

    if (!stkResp.ok || stkData.errorCode) {
      return new Response(
        JSON.stringify({
          error: stkData.errorMessage || "STK push failed",
          details: stkData,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Persist pending transaction
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: insErr } = await supabase.from("mpesa_transactions").insert({
      phone: normalized,
      amount: amt,
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      status: "pending",
      client_id: clientId,
    });

    if (insErr) {
      console.error("Insert error:", insErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkoutRequestId: stkData.CheckoutRequestID,
        customerMessage: stkData.CustomerMessage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("STK push error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
