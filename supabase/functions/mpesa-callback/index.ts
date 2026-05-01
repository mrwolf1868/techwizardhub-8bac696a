import { corsHeaders } from "npm:@supabase/supabase-js/cors";
import { createClient } from "npm:@supabase/supabase-js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("M-Pesa callback received:", JSON.stringify(body));

    const stk = body?.Body?.stkCallback;
    if (!stk) {
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checkoutRequestId = stk.CheckoutRequestID as string;
    const resultCode = stk.ResultCode as number;
    const resultDesc = stk.ResultDesc as string;

    let receipt: string | null = null;
    if (resultCode === 0 && Array.isArray(stk.CallbackMetadata?.Item)) {
      const item = stk.CallbackMetadata.Item.find((i: { Name?: string }) => i.Name === "MpesaReceiptNumber");
      receipt = item?.Value ? String(item.Value) : null;
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const newStatus = resultCode === 0 ? "success" : "failed";

    // Load the transaction first so we can credit the user atomically
    const { data: tx } = await supabase
      .from("mpesa_transactions")
      .select("id, user_id, amount, status, coins_credited")
      .eq("checkout_request_id", checkoutRequestId)
      .maybeSingle();

    const { error: updErr } = await supabase
      .from("mpesa_transactions")
      .update({
        status: newStatus,
        mpesa_receipt: receipt,
        result_desc: resultDesc,
      })
      .eq("checkout_request_id", checkoutRequestId);

    if (updErr) console.error("Update error:", updErr);

    // Only grant coins if payment is confirmed successful AND not already credited
    if (newStatus === "success" && tx && tx.user_id && !tx.coins_credited) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("coins")
        .eq("user_id", tx.user_id)
        .maybeSingle();

      const currentCoins = profile?.coins ?? 0;
      const newCoins = currentCoins + tx.amount;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ coins: newCoins })
        .eq("user_id", tx.user_id);

      if (!profErr) {
        await supabase.from("transactions").insert({
          user_id: tx.user_id,
          type: "purchase",
          amount: tx.amount,
          description: `M-Pesa ${tx.amount} KES${receipt ? ` · ${receipt}` : ""}`,
        });
        await supabase
          .from("mpesa_transactions")
          .update({ coins_credited: true })
          .eq("id", tx.id);
        await supabase.from("activity_logs").insert({
          user_id: tx.user_id,
          event: "purchase",
          detail: `Credited ${tx.amount} coins (M-Pesa ${receipt ?? "—"})`,
        });
      } else {
        console.error("Profile credit error:", profErr);
      }
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Callback error:", e);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
