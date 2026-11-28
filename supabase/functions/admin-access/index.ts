import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({error:"POST only"},405);
 try{
  const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return json({error:"Please sign in"},401);
  const url=Deno.env.get("SUPABASE_URL") ?? "";
  const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",{auth:{persistSession:false}});
  const token=auth.slice(7);const {data:{user}}=await admin.auth.getUser(token);
  if(!user?.email)return json({error:"Please sign in"},401);
  const {data:role}=await admin.from("user_roles").select("id").eq("user_id",user.id).eq("role","admin").maybeSingle();
  if(!role)return json({error:"Admins only"},403);
  // The Auth server verified this JWT before its session identifier is read.
  const sessionId=JSON.parse(atob(token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).session_id;
  if(typeof sessionId!=="string")return json({error:"Please sign in again"},401);
  const raw=await req.text();if(raw.length>4096)return json({error:"Invalid request"},400);
  const parsed=z.discriminatedUnion("action",[z.object({action:z.literal("open"),password:z.string().min(1).max(256)}),z.object({action:z.literal("close")}),z.object({action:z.literal("status")})]).safeParse(JSON.parse(raw));
  if(!parsed.success)return json({error:"Invalid request"},400);
  if(parsed.data.action==="close"){
   await admin.from("admin_access_sessions").delete().eq("session_id",sessionId).eq("user_id",user.id);return json({success:true});
  }
  if(parsed.data.action==="status"){
   const {data:s}=await admin.from("admin_access_sessions").select("session_id").eq("session_id",sessionId).eq("user_id",user.id).gt("expires_at",new Date().toISOString()).maybeSingle();
   return json({verified:!!s});
  }
  const verifier=createClient(url,Deno.env.get("SUPABASE_ANON_KEY") ?? "",{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:login,error}=await verifier.auth.signInWithPassword({email:user.email,password:parsed.data.password});
  if(error || login.user?.id!==user.id)return json({error:"Wrong password"});
  await verifier.auth.signOut({scope:"local"});
  const {error:writeError}=await admin.from("admin_access_sessions").upsert({session_id:sessionId,user_id:user.id,expires_at:new Date(Date.now()+30*60*1000).toISOString()});
  if(writeError)return json({error:"Could not verify access"},500);
  return json({success:true});
 }catch{return json({error:"Could not verify access"},400);}
});
