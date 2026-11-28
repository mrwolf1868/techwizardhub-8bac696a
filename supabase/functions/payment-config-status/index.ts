import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { loadStkConfig } from "../_shared/stkConfig.ts";
import { loadMullahcConfig } from "../_shared/mullahcPayout.ts";
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"}});
 try{
  const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return json({error:"Please sign in"},401);
  const url=Deno.env.get("SUPABASE_URL") ?? "";
  const caller=createClient(url,Deno.env.get("SUPABASE_ANON_KEY") ?? "",{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await caller.auth.getUser();if(!user)return json({error:"Please sign in"},401);
  const {data:verified}=await caller.rpc("admin_access_verified");if(!verified)return json({error:"Verify admin access first"},403);
  const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const stk=await loadStkConfig(admin);const payout=await loadMullahcConfig(admin);
  return json({configured:{deposit:!!(stk.consumerKey&&stk.consumerSecret&&stk.passkey&&stk.shortcode&&stk.tillNumber),payout:!!payout}});
 }catch{return json({error:"Configuration unavailable"},500);}
});
