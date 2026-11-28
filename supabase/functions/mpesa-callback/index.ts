import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { queryStkResult } from "../_shared/stkConfig.ts";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({error:"POST only"},405);
 try{
  const raw=await req.text();if(raw.length>16384)return json({error:"Invalid callback"},400);
  const callback=JSON.parse(raw)?.Body?.stkCallback;
  if(typeof callback?.CheckoutRequestID!=="string" || callback.CheckoutRequestID.length>200)return json({ResultCode:0,ResultDesc:"Accepted"});
  const admin=createClient(Deno.env.get("SUPABASE_URL") ?? "",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const {data:tx}=await admin.from("mpesa_transactions").select("id,status,phone,amount").eq("checkout_request_id",callback.CheckoutRequestID).maybeSingle();
  if(!tx || tx.status!=="pending")return json({ResultCode:0,ResultDesc:"Accepted"});
  // A callback is untrusted. Verify the checkout directly with Daraja before any wallet movement.
  const result=await queryStkResult(admin,callback.CheckoutRequestID);
  if(result===null)return json({error:"Confirmation pending"},503);
  const receiptItem=Array.isArray(callback.CallbackMetadata?.Item)?callback.CallbackMetadata.Item.find((x:any)=>x.Name==="MpesaReceiptNumber"):null;
  const receipt=typeof receiptItem?.Value==="string"?receiptItem.Value.slice(0,100):null;
  const {error}=await admin.rpc("confirm_stk_deposit",{_checkout:callback.CheckoutRequestID,_success:result===0,_receipt:receipt,_description:result===0?"Payment confirmed by Daraja":"Payment failed"});
  if(error)return json({error:"Confirmation pending"},503);
  return json({ResultCode:0,ResultDesc:"Accepted"});
 }catch{return json({error:"Confirmation pending"},503);}
});
