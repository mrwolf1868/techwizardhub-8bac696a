import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText } from "npm:ai";
import { z } from "npm:zod@3";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "../_shared/run-id.ts";

const GAMES = { chess: "Chess", draughts: "Draughts (checkers)", tictactoe: "Tic-Tac-Toe", connect4: "Connect Four" } as const;
const HOUSE_RULES: Record<keyof typeof GAMES, string> = {
  chess: "Standard FIDE chess rules: castling, en passant, promotion, check, checkmate, stalemate and draws apply.",
  draughts: "8x8 board. Men move diagonally forward one square. Captures are mandatory and multi-jumps continue in the same turn. A man reaching the far row becomes a king that moves diagonally in any direction.",
  tictactoe: "3x3 grid, cream moves first; three in a row horizontally, vertically or diagonally wins; a full board with no line is a draw.",
  connect4: "7 columns by 6 rows; pieces drop to the lowest empty spot; four in a row horizontally, vertically or diagonally wins; a full board is a draw.",
};
const SITE_RULES = "On this site players stake money. When an opponent joins, each player pays the stake plus a 5% entry fee. The winner receives both stakes. A draw refunds both stakes (entry fees are kept). Quitting an active match gives both stakes to the opponent. Searching for a match is free until someone joins.";

const Body = z.object({
  game: z.enum(["chess", "draughts", "tictactoe", "connect4"]),
  question: z.string().trim().min(3).max(300),
});

/** Same wording (ignoring case, punctuation, spacing and filler words) maps to one saved answer. */
export const questionKey = (q: string) =>
  q.toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !["please", "pls", "plz", "hi", "hello", "hey", "the", "a", "an", "can", "you", "tell", "me", "explain"].includes(w))
    .join(" ")
    .slice(0, 300);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Please sign in to ask about the rules" }, 401);
  const { data: { user } } = await admin.auth.getUser(auth.slice(7));
  if (!user) return json({ error: "Please sign in to ask about the rules" }, 401);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "Ask a question between 3 and 300 characters" }, 400);
  const { game, question } = parsed.data;
  const key = questionKey(question);
  if (key.length < 3) return json({ error: "Please ask a clearer question" }, 400);

  const { data: cached } = await admin.from("rules_answers").select("id,answer,hits").eq("game", game).eq("question_key", key).maybeSingle();
  if (cached) {
    await admin.from("rules_answers").update({ hits: cached.hits + 1, last_asked_at: new Date().toISOString() }).eq("id", cached.id);
    return json({ answer: cached.answer, cached: true });
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "The rules helper is not set up yet" }, 500);

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(req));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  let failure: { status: number; message: string } | null = null;
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system: `You explain the rules of ${GAMES[game]} to players of the TECHWOLFpro games site. ${HOUSE_RULES[game]} ${SITE_RULES}
Answer only questions about the rules, moves, scoring, winning, draws, or how matches and stakes work for ${GAMES[game]} on this site. If the question is about something else, say briefly that you can only help with ${GAMES[game]} rules.
Be clear and friendly. Use short paragraphs or a few bullet points, under 180 words. Plain text, no markdown headings.`,
    messages: [{ role: "user", content: question }],
    abortSignal: req.signal,
    providerOptions: {
      openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] },
    },
    onError: ({ error }) => {
      const e = error as { statusCode?: number; responseBody?: string; message?: string };
      let message = e.message ?? "The rules helper could not answer";
      try { message = JSON.parse(e.responseBody ?? "").error?.message ?? JSON.parse(e.responseBody ?? "").message ?? message; } catch { /* keep */ }
      failure = { status: e.statusCode ?? 500, message };
    },
  });

  let answer = "";
  try {
    answer = (await result.text).trim();
  } catch (e) {
    if (req.signal.aborted) return json({ error: "Cancelled" }, 499);
    console.error("rules-helper AI error", failure ?? e);
  }
  const f = failure as { status: number; message: string } | null;
  if (!answer) {
    if (f?.status === 429) return json({ error: "The rules helper is busy. Please try again in a minute." }, 429);
    if (f?.status === 402) return json({ error: "The rules helper is out of AI credits right now." }, 402);
    if (f?.status === 403) return json({ error: f.message }, 403);
    return json({ error: "The rules helper could not answer right now. Please try again." }, f?.status && f.status >= 400 ? f.status : 502);
  }

  await admin.from("rules_answers").upsert({ game, question_key: key, question, answer }, { onConflict: "game,question_key", ignoreDuplicates: true });
  return json({ answer, cached: false });
});
