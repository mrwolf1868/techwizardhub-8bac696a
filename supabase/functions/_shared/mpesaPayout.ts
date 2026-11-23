// deno-lint-ignore-file no-explicit-any
export type PayoutConfig = {
  env: "sandbox" | "production";
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  initiatorName: string;
  securityCredential: string;
  callbackToken: string;
};

const HOSTS = { sandbox: "https://sandbox.safaricom.co.ke", production: "https://api.safaricom.co.ke" };

/** Reads payout credentials from secure runtime secrets only. Returns null when anything is missing. */
export async function loadPayoutConfig(admin: any): Promise<PayoutConfig | null> {
  let env: "sandbox" | "production" = Deno.env.get("MPESA_ENV") === "production" ? "production" : "sandbox";
  let fallbackKey = Deno.env.get("MPESA_CONSUMER_KEY") ?? "";
  let fallbackSecret = Deno.env.get("MPESA_CONSUMER_SECRET") ?? "";
  try {
    const { data } = await admin.from("admin_settings").select("key,value").in("key", ["mpesa_env", "mpesa_consumer_key", "mpesa_consumer_secret"]);
    for (const row of data ?? []) {
      const v = typeof row.value === "string" ? row.value : String(row.value ?? "");
      if (row.key === "mpesa_env" && (v === "production" || v === "sandbox")) env = v;
      if (row.key === "mpesa_consumer_key" && v) fallbackKey = v;
      if (row.key === "mpesa_consumer_secret" && v) fallbackSecret = v;
    }
  } catch (_) { /* use runtime secrets */ }
  const cfg: PayoutConfig = {
    env: (Deno.env.get("MPESA_B2C_ENV") === "production" ? "production" : Deno.env.get("MPESA_B2C_ENV") === "sandbox" ? "sandbox" : env),
    consumerKey: Deno.env.get("MPESA_B2C_CONSUMER_KEY") || fallbackKey,
    consumerSecret: Deno.env.get("MPESA_B2C_CONSUMER_SECRET") || fallbackSecret,
    shortcode: Deno.env.get("MPESA_B2C_SHORTCODE") ?? "",
    initiatorName: Deno.env.get("MPESA_B2C_INITIATOR_NAME") ?? "",
    securityCredential: Deno.env.get("MPESA_B2C_SECURITY_CREDENTIAL") ?? "",
    callbackToken: Deno.env.get("MPESA_PAYOUT_CALLBACK_TOKEN") ?? "",
  };
  return Object.values(cfg).every((v) => typeof v === "string" && v.length > 0) ? cfg : null;
}

export async function sendB2C(cfg: PayoutConfig, phone: string, amount: number, remarks: string) {
  const host = HOSTS[cfg.env];
  const tokenResp = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${btoa(`${cfg.consumerKey}:${cfg.consumerSecret}`)}` },
  });
  if (!tokenResp.ok) {
    console.error("B2C OAuth failed", tokenResp.status, await tokenResp.text());
    return { ok: false as const, error: "M-Pesa could not be reached" };
  }
  const { access_token } = await tokenResp.json();
  const base = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-payout-result?t=${encodeURIComponent(cfg.callbackToken)}`;
  const resp = await fetch(`${host}/mpesa/b2c/v1/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      InitiatorName: cfg.initiatorName,
      SecurityCredential: cfg.securityCredential,
      CommandID: "BusinessPayment",
      Amount: amount,
      PartyA: cfg.shortcode,
      PartyB: phone,
      Remarks: remarks.slice(0, 100),
      QueueTimeOutURL: `${base}&type=timeout`,
      ResultURL: `${base}&type=result`,
      Occasion: "Withdrawal",
    }),
  });
  const data = await resp.json().catch(() => ({}));
  console.log("B2C response", resp.status, JSON.stringify(data));
  if (!resp.ok || String(data.ResponseCode ?? "") !== "0") {
    return { ok: false as const, error: data.errorMessage || data.ResponseDescription || "M-Pesa rejected the payout" };
  }
  return { ok: true as const, conversationId: String(data.ConversationID ?? ""), originatorId: String(data.OriginatorConversationID ?? "") };
}
