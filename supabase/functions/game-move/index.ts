import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Chess } from "npm:chess.js@1.4.0";
import { z } from "npm:zod@3";
import { validateGameMove } from "../_shared/validateGameMove.ts";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {...corsHeaders, "Content-Type":"application/json", "Cache-Control":"no-store"}});
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:corsHeaders});
  if (req.method !== "POST") return json({error:"POST only"},405);
  try {
    const auth=req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({error:"Please sign in"},401);
    const admin=createClient(Deno.env.get("SUPABASE_URL") ?? "",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const {data:{user}}=await admin.auth.getUser(auth.slice(7));
    if (!user) return json({error:"Please sign in"},401);
    const raw=await req.text(); if(raw.length>2048) return json({error:"Invalid move"},400);
    const parsed=z.object({id:z.string().uuid(),state:z.string().min(1).max(256)}).safeParse(JSON.parse(raw));
    if(!parsed.success) return json({error:"Invalid move"},400);
    const {data:m}=await admin.from("game_matches").select("id,state,game_type,status,turn,creator_id,opponent_id").eq("id",parsed.data.id).maybeSingle();
    if(!m || m.status!=="active" || m.turn!==user.id || ![m.creator_id,m.opponent_id].includes(user.id) || !m.state) return json({error:"Not your turn"},403);
    const result=validateGameMove(m.game_type,m.state,parsed.data.state,user.id===m.creator_id?"w":"b",fen=>new Chess(fen));
    const {error}=await admin.rpc("apply_verified_game_move",{_id:m.id,_uid:user.id,_previous:m.state,_next:parsed.data.state,_result:result});
    if(error) return json({error:"The board changed. Refresh and try again."},409);
    return json({success:true});
  } catch { return json({error:"Illegal move"},400); }
});
