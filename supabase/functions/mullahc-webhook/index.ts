import { createClient } from "npm:@supabase/supabase-js@2";
import { checkPayout, loadMullahcConfig, parsePayoutTransactionId, verifySignature } from "../_shared/mullahcPayout.ts";

const ok = () => new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok();
  const raw = await req.text();
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const cfg = await loadMullahcConfig(admin);
  if (!cfg) return new Response("Not configured", { status: 503 });
  const valid = await verifySignature(cfg.secretKey, req.headers.get("X-Mullahc-Timestamp") ?? "", raw, req.headers.get("X-Mullahc-Signature") ?? "");
  if (!valid) return new Response("Invalid signature", { status: 401 });
  try {
    const body = JSON.parse(raw);
    const event = String(body?.event ?? "");
    if (!event.startsWith("payout.")) return ok();
    const reference = String(body?.data?.reference ?? "");
    if (!reference) return ok();
    // Confirm with the status endpoint before changing anything.
    const confirmed = await checkPayout(cfg, reference);
    if (!confirmed || confirmed.state === "pending") return ok();
    const target = parsePayoutTransactionId(confirmed.transactionId || String(body?.data?.transaction_id ?? ""));
    const { data, error } = await admin.rpc("payout_complete", {
      _kind: target?.kind ?? null, _id: target?.id ?? null,
      _conversation_id: reference, _originator_id: null,
      _success: confirmed.state === "success",
      _receipt: reference,
      _desc: confirmed.failure ?? (confirmed.state === "success" ? "Paid" : "Payout failed"),
    });
    console.log("Mullahc webhook", event, reference, confirmed.state, data, error?.message);
  } catch (e) {
    console.error("Mullahc webhook error", e);
  }
  return ok();
});
