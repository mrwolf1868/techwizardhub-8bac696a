import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({error:"POST only"},405);
 try{
  const raw=await req.text();if(raw.length>4096)return json({error:"Invalid request"},400);
  const body=JSON.parse(raw);
  if(typeof body.child_slug!=="string" || !/^[a-z0-9_-]{1,80}$/.test(body.child_slug))return json({error:"Choose a valid service"},400);
  const admin=createClient(Deno.env.get("SUPABASE_URL") ?? "",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const internal=Deno.env.get("TECHWOLF254_INTERNAL_SECRET");
  const auth=req.headers.get("Authorization");
  const jwt=internal && req.headers.get("x-techwolf254-secret")===internal?body.user_token:auth?.startsWith("Bearer ")?auth.slice(7):null;
  if(typeof jwt!=="string")return json({error:"Please sign in"},401);
  const {data:{user}}=await admin.auth.getUser(jwt);
  if(!user)return json({error:"Please sign in"},401);
  const {data:balance,error}=await admin.rpc("charge_service_continuation",{_uid:user.id,_slug:body.child_slug});
  if(error)return json({error:error.message.includes("Insufficient")?"Insufficient balance":"Service payment unavailable"});
  return json({success:true,user_id:user.id,balance});
 }catch{return json({error:"Service payment unavailable"},400);}
});
