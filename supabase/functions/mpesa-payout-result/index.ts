import { createClient } from "npm:@supabase/supabase-js@2";

const ack = () => new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const expected = Deno.env.get("MPESA_PAYOUT_CALLBACK_TOKEN") ?? "";
  if (!expected || url.searchParams.get("t") !== expected) return new Response("Forbidden", { status: 403 });
  if (req.method !== "POST") return ack();
  try {
    const payload = await req.json().catch(() => ({}));
    const r = payload?.Result;
    if (url.searchParams.get("type") === "timeout" || !r) {
      console.warn("B2C timeout/empty callback", JSON.stringify(payload).slice(0, 500));
      return ack(); // stays processing; final result arrives separately
    }
    const success = Number(r.ResultCode) === 0;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin.rpc("payout_complete", {
      _kind: null, _id: null,
      _conversation_id: r.ConversationID ? String(r.ConversationID) : null,
      _originator_id: r.OriginatorConversationID ? String(r.OriginatorConversationID) : null,
      _success: success,
      _receipt: r.TransactionID ? String(r.TransactionID) : null,
      _desc: String(r.ResultDesc ?? "").slice(0, 300),
    });
    console.log("B2C result", r.ConversationID, success, data, error?.message);
  } catch (e) {
    console.error("B2C callback error", e);
  }
  return ack();
});
