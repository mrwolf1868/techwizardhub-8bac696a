import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "@supabase/supabase-js";

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
      const item = stk.CallbackMetadata.Item.find((i: any) => i.Name === "MpesaReceiptNumber");
      receipt = item?.Value ? String(item.Value) : null;
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase
      .from("mpesa_transactions")
      .update({
        status: resultCode === 0 ? "success" : "failed",
        mpesa_receipt: receipt,
        result_desc: resultDesc,
      })
      .eq("checkout_request_id", checkoutRequestId);

    if (error) console.error("Update error:", error);

    // Always 200 to Daraja
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
