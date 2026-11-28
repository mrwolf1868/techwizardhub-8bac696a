// Payment credentials are read exclusively by server functions; never returned to browsers.
export async function loadStkConfig(admin: any) {
    // Load credentials from admin_settings (env as fallback)
    let consumerKey = Deno.env.get("MPESA_CONSUMER_KEY") ?? "";
    let consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET") ?? "";
    let passkey = Deno.env.get("MPESA_PASSKEY") ?? "";
    // BusinessShortCode (Head Office / Store Number) used for Lipa Na M-Pesa Online auth
    let shortcode = Deno.env.get("MPESA_SHORTCODE") ?? "";
    // Till number (PartyB) where money settles. For BuyGoods, this is required.
    let tillNumber = Deno.env.get("MPESA_TILL") ?? "";
    let mpesaEnv: "sandbox" | "production" =
      Deno.env.get("MPESA_ENV") === "production" ? "production" : "sandbox";

    try {
      const { data: rows } = await admin
        .from("admin_settings")
        .select("key, value")
        .in("key", [
          "mpesa_shortcode",
          "mpesa_till",
          "mpesa_consumer_key",
          "mpesa_consumer_secret",
          "mpesa_passkey",
          "mpesa_env",
        ]);
      const map: Record<string, string> = {};
      (rows || []).forEach((r: { key: string; value: unknown }) => {
        map[r.key] = typeof r.value === "string" ? r.value : String(r.value ?? "");
      });
      if (map.mpesa_shortcode && /^\d{4,10}$/.test(map.mpesa_shortcode)) shortcode = map.mpesa_shortcode;
      if (map.mpesa_till && /^\d{4,10}$/.test(map.mpesa_till)) tillNumber = map.mpesa_till;
      if (map.mpesa_consumer_key) consumerKey = map.mpesa_consumer_key;
      if (map.mpesa_consumer_secret) consumerSecret = map.mpesa_consumer_secret;
      if (map.mpesa_passkey) passkey = map.mpesa_passkey;
      if (map.mpesa_env === "production" || map.mpesa_env === "sandbox") mpesaEnv = map.mpesa_env;
    } catch (_) { /* keep env fallback */ }

    return { consumerKey, consumerSecret, passkey, shortcode, tillNumber, mpesaEnv };
}
export async function queryStkResult(admin: any, checkout: string): Promise<number | null> {
  const cfg = await loadStkConfig(admin);
  if (!cfg.consumerKey || !cfg.consumerSecret || !cfg.passkey || !cfg.shortcode) return null;
  const host = cfg.mpesaEnv === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const oauth = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${btoa(`${cfg.consumerKey}:${cfg.consumerSecret}`)}` }, signal: AbortSignal.timeout(10000),
  });
  if (!oauth.ok) return null;
  const auth = await oauth.json();
  if (typeof auth.access_token !== "string") return null;
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const response = await fetch(`${host}/mpesa/stkpushquery/v1/query`, {
    method: "POST", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ BusinessShortCode: cfg.shortcode, Password: btoa(`${cfg.shortcode}${cfg.passkey}${timestamp}`), Timestamp: timestamp, CheckoutRequestID: checkout }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  if (typeof data.ResultCode !== "number" && !(typeof data.ResultCode === "string" && /^\d+$/.test(data.ResultCode))) return null;
  return Number(data.ResultCode);
}
