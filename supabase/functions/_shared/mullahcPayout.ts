// deno-lint-ignore-file no-explicit-any
export type MullahcConfig = { env: "sandbox" | "live"; publicKey: string; secretKey: string };

const BASES = { live: "https://mullahc.com/api/merchant", sandbox: "https://mullahc.com/api/merchant/sandbox" };

/** Reads Mullahc payout keys from admin-only settings, falling back to secure secrets. Null when any key is missing. */
export async function loadMullahcConfig(admin: any): Promise<MullahcConfig | null> {
  const s: Record<string, string> = {};
  try {
    const { data } = await admin.from("admin_settings").select("key,value").like("key", "mullahc_%");
    for (const row of data ?? []) {
      const v = typeof row.value === "string" ? row.value : String(row.value ?? "");
      if (v) s[row.key] = v.trim();
    }
  } catch (_) { /* fall back to secrets */ }
  const publicKey = s.mullahc_public_key || Deno.env.get("MULLAHC_PUBLIC_KEY") || "";
  const secretKey = s.mullahc_secret_key || Deno.env.get("MULLAHC_SECRET_KEY") || "";
  const envRaw = s.mullahc_env || Deno.env.get("MULLAHC_ENV") || (secretKey.startsWith("sbx_") || publicKey.startsWith("sbx_") ? "sandbox" : "live");
  if (!publicKey || !secretKey) return null;
  return { env: envRaw === "sandbox" ? "sandbox" : "live", publicKey, secretKey };
}

export const payoutTransactionId = (kind: "wallet" | "profit", id: string) =>
  (kind === "wallet" ? "W" : "P") + id.replace(/-/g, "").toUpperCase();

export function parsePayoutTransactionId(txId: string): { kind: "wallet" | "profit"; id: string } | null {
  const m = /^([WP])([0-9A-F]{32})$/i.exec(txId ?? "");
  if (!m) return null;
  const h = m[2].toLowerCase();
  return { kind: m[1].toUpperCase() === "W" ? "wallet" : "profit", id: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` };
}

const errMsg = (data: any, fallback: string) =>
  Array.isArray(data?.message) ? data.message.join(", ") : (typeof data?.message === "string" && data.message) || fallback;

async function getToken(cfg: MullahcConfig) {
  const resp = await fetch(`${BASES[cfg.env]}/access-token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ public_key: cfg.publicKey, secret_key: cfg.secretKey }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.status !== "success" || !data.token) {
    console.error("Mullahc token failed", resp.status, JSON.stringify(data).slice(0, 300));
    return { ok: false as const, error: resp.status === 401 ? "The payout keys were not accepted" : errMsg(data, "The payout service could not be reached") };
  }
  return { ok: true as const, token: String(data.token) };
}

/** Checks whether Mullahc accepts the keys, and whether they belong to the other environment instead. */
export async function testMullahcKeys(cfg: MullahcConfig) {
  const here = await getToken(cfg);
  if (here.ok) return { keysValid: true, otherEnvValid: false };
  const other = await getToken({ ...cfg, env: cfg.env === "live" ? "sandbox" : "live" });
  return { keysValid: false, otherEnvValid: other.ok };
}

export type PayoutState = "pending" | "success" | "failed";
const normState = (s: unknown): PayoutState => {
  const v = String(s ?? "").toLowerCase();
  return v === "success" || v === "succeeded" || v === "paid" ? "success" : v === "failed" || v === "cancelled" || v === "reversed" ? "failed" : "pending";
};

export async function sendPayout(cfg: MullahcConfig, p: { transactionId: string; phone: string; amount: number; recipientName: string; description: string }) {
  const t = await getToken(cfg);
  if (!t.ok) return { ok: false as const, error: t.error };
  const resp = await fetch(`${BASES[cfg.env]}/payout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t.token}`, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      amount: String(p.amount),
      currency: "KES",
      transaction_id: p.transactionId,
      phone: p.phone.startsWith("+") ? p.phone : `+${p.phone}`,
      recipient_name: p.recipientName.slice(0, 80),
      description: p.description.slice(0, 100),
      ipn_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mullahc-webhook`,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  console.log("Mullahc payout", resp.status, JSON.stringify(data).slice(0, 500));
  if (!resp.ok || data.status !== "success") {
    const reason = resp.status === 402 ? "the payout account balance is too low"
      : resp.status === 403 ? "payouts are not enabled on the payout account"
      : errMsg(data, "the payout was declined");
    return { ok: false as const, error: reason };
  }
  const d = data.data ?? data;
  return { ok: true as const, reference: String(d.reference ?? data.reference ?? ""), state: normState(d.status ?? data.payout_status) };
}

export async function checkPayout(cfg: MullahcConfig, reference: string) {
  const t = await getToken(cfg);
  if (!t.ok) return null;
  const resp = await fetch(`${BASES[cfg.env]}/payout/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${t.token}`, Accept: "application/json" },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.status !== "success") return null;
  const d = data.data ?? data;
  return { state: normState(d.status), transactionId: String(d.transaction_id ?? ""), reference: String(d.reference ?? reference), failure: d.failure_reason ? String(d.failure_reason) : null };
}

export async function verifySignature(secret: string, timestamp: string, raw: string, signature: string) {
  if (!timestamp || !signature || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${raw}`)));
  const expected = "sha256=" + Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
