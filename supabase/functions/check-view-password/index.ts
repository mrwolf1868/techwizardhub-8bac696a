import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
const enc=new TextEncoder();
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,"0")).join("");
const equal=(a:string,b:string)=>{let difference=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)difference|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return difference===0;};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({error:"POST only"},405);
 const hash=Deno.env.get("VIEW_PASSWORD_HASH") ?? "";
 const signingKey=Deno.env.get("VIEW_GATE_SIGNING_KEY") ?? "";
 if(!/^[a-fA-F0-9]{64}$/.test(hash)||!signingKey)return json({error:"Access password is not configured",configured:false});
 try{
  const raw=await req.text();if(raw.length>4096)return json({error:"Invalid request"},400);
  const body=z.union([z.object({password:z.string().min(1).max(256)}),z.object({permit:z.string().min(1).max(1024)})]).safeParse(JSON.parse(raw));
  if(!body.success)return json({error:"Wrong password"});
  const key=await crypto.subtle.importKey("raw",enc.encode(signingKey),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sign=async (value:string)=>hex(await crypto.subtle.sign("HMAC",key,enc.encode(value)));
  if("permit" in body.data){
   const [payload,signature]=body.data.permit.split(".");
   if(!payload||!signature||!equal(await sign(payload),signature))return json({granted:false});
   const claims=JSON.parse(atob(payload));
   return json({granted:typeof claims.exp==="number"&&claims.exp>Date.now()&&claims.origin===(req.headers.get("Origin") ?? ""),expiresAt:claims.exp});
  }
  const supplied=hex(await crypto.subtle.digest("SHA-256",enc.encode(body.data.password)));
  if(!equal(supplied,hash.toLowerCase()))return json({error:"Wrong password"});
  const expiresAt=Date.now()+4*60*60*1000;
  const payload=btoa(JSON.stringify({exp:expiresAt,origin:req.headers.get("Origin") ?? "",nonce:crypto.randomUUID()}));
  return json({granted:true,permit:payload+"."+await sign(payload),expiresAt});
 }catch{return json({error:"Wrong password"});}
});
