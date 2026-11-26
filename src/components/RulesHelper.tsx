import { useState } from "react";
import { BookOpen, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { gameName, type RulesGame } from "@/lib/games";

const SUGGESTIONS: Record<RulesGame, string[]> = {
  chess: ["How does castling work?", "What is en passant?", "What counts as a draw?"],
  draughts: ["Do I have to capture?", "How does a piece become a king?", "Can I jump more than once?"],
  tictactoe: ["Who moves first?", "What happens if the board fills up?"],
  connect4: ["Do diagonal lines count?", "What happens if the board fills up?"],
};

/** Ask an AI-powered helper about a game's rules. Repeated questions are answered from saved explanations. */
export const RulesHelper = ({ game }: { game: RulesGame }) => {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async (q: string) => {
    const text = q.trim();
    if (text.length < 3 || busy) return;
    setBusy(true); setError(null); setAnswer(null); setAsked(text);
    const { data, error: fnError } = await supabase.functions.invoke("rules-helper", { body: { game, question: text.slice(0, 300) } });
    setBusy(false);
    if (!fnError && data?.answer) { setAnswer(data.answer); setQuestion(""); return; }
    let message = data?.error as string | undefined;
    if (!message && fnError && "context" in fnError) {
      try { message = (await (fnError as { context: Response }).context.json()).error; } catch { /* ignore */ }
    }
    setError(message || "The rules helper could not answer right now. Please try again.");
  };

  return (
    <section className="rules-helper" aria-label={`${gameName(game)} rules helper`}>
      <header><BookOpen className="h-4 w-4" /><h3>Ask about {gameName(game)} rules</h3><span>AI-powered</span></header>
      <div className="rules-body">
        {!asked && (
          <div className="rules-suggestions">
            {SUGGESTIONS[game].map((s) => (
              <button key={s} type="button" onClick={() => void ask(s)} disabled={busy}>{s}</button>
            ))}
          </div>
        )}
        {asked && <p className="rules-question">{asked}</p>}
        {busy && <p className="rules-status" role="status">Looking up the rules…</p>}
        {answer && <p className="rules-answer">{answer}</p>}
        {error && <p className="rules-error" role="alert">{error}</p>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void ask(question); }}>
        <Input value={question} maxLength={300} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Can a king move backwards?" aria-label="Rules question" disabled={busy} />
        <Button type="submit" size="icon" disabled={busy || question.trim().length < 3} aria-label="Ask"><Send className="h-4 w-4" /></Button>
      </form>
    </section>
  );
};
