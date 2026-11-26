import { useEffect, useMemo, useState } from "react";
import { Bot, Calculator, Send, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { makeQuestions, quizAnswer, QUIZ_SECONDS, type QuizQuestion } from "@/lib/quiz";

type QuizState = { q?: QuizQuestion[]; start?: number; r?: Record<string, { s: number; ms: number }> };
type MatchLite = { id: string; status: string; state: string | null; creator_id: string; opponent_id: string | null };

const parse = (raw: string | null): QuizState => { try { return JSON.parse(raw || "{}"); } catch { return {}; } };
const fmt = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const useCountdown = (start: number | undefined) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(t); }, []);
  return start ? Math.max(0, Math.ceil(start + QUIZ_SECONDS - now / 1000)) : QUIZ_SECONDS;
};

const QuestionList = ({ questions, answers, setAnswers, disabled }: { questions: QuizQuestion[]; answers: string[]; setAnswers: (a: string[]) => void; disabled: boolean }) => (
  <ol className="quiz-list">
    {questions.map((q, i) => (
      <li key={i}>
        <span className="quiz-num">{i + 1}</span>
        <span className="quiz-sum">{q[0]} {q[1] === "x" ? "×" : q[1] === "-" ? "−" : "+"} {q[2]} =</span>
        <Input inputMode="numeric" aria-label={`Answer ${i + 1}`} value={answers[i] ?? ""} disabled={disabled}
          onChange={(e) => { const next = [...answers]; next[i] = e.target.value.replace(/[^0-9-]/g, "").slice(0, 6); setAnswers(next); }} />
      </li>
    ))}
  </ol>
);

/** Live staked quiz: both players get the same 10 sums; the server marks answers and decides the winner. */
export const QuizBoard = ({ match, me }: { match: MatchLite; me: string | null }) => {
  const st = useMemo(() => parse(match.state), [match.state]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const left = useCountdown(st.start);
  const mine = me ? st.r?.[me] : undefined;
  const oppId = me === match.creator_id ? match.opponent_id : match.creator_id;
  const theirs = oppId ? st.r?.[oppId] : undefined;
  const questions = st.q ?? [];

  const submit = async () => {
    if (busy || mine) return;
    setBusy(true);
    const nums = questions.map((_, i) => { const n = Number.parseInt(answers[i] ?? "", 10); return Number.isFinite(n) ? n : -999999; });
    const { error } = await supabase.rpc("quiz_submit", { _id: match.id, _answers: nums });
    setBusy(false);
    if (error) toast.error(error.message.replace(/^.*?: /, ""));
  };

  // After time is up, either player can ask the server to decide the match.
  useEffect(() => {
    if (match.status !== "active" || left > 0) return;
    const t = window.setInterval(() => { void supabase.rpc("quiz_finalize", { _id: match.id }); }, 5000);
    return () => window.clearInterval(t);
  }, [left === 0, match.status, match.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (match.status === "finished" || match.status === "cancelled") {
    return (
      <div className="quiz-card">
        <h3><Calculator className="h-4 w-4" />Results</h3>
        <div className="quiz-scores">
          <div><small>You</small><strong>{mine ? `${mine.s}/10` : "—"}</strong><span>{mine ? fmt(mine.ms) : "No answers"}</span></div>
          <div><small>Opponent</small><strong>{theirs ? `${theirs.s}/10` : "—"}</strong><span>{theirs ? fmt(theirs.ms) : "No answers"}</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-card">
      <div className="quiz-head">
        <h3><Calculator className="h-4 w-4" />10 sums · same for both players</h3>
        <span className={`quiz-timer ${left <= 15 ? "is-low" : ""}`}><Timer className="h-4 w-4" />{left}s</span>
      </div>
      {mine ? (
        <p className="quiz-wait">You scored <strong>{mine.s}/10</strong> in {fmt(mine.ms)}. {theirs ? "Deciding the winner…" : "Waiting for your opponent to finish…"}</p>
      ) : (
        <>
          <QuestionList questions={questions} answers={answers} setAnswers={setAnswers} disabled={busy || left === 0} />
          <Button className="mt-3 w-full" disabled={busy || left === 0 || questions.length === 0} onClick={() => void submit()}>
            <Send />{busy ? "Submitting…" : "Submit answers"}
          </Button>
          {theirs && <p className="quiz-wait">Your opponent has finished. Submit when you're ready.</p>}
        </>
      )}
    </div>
  );
};

/** Free practice round against an openly named computer opponent. No money involved. */
export const QuizPractice = () => {
  const [round, setRound] = useState<{ q: QuizQuestion[]; start: number; cpu: { s: number; ms: number } } | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<{ s: number; ms: number } | null>(null);
  const left = useCountdown(round ? round.start / 1000 : undefined);

  const begin = () => {
    setAnswers([]); setResult(null);
    setRound({ q: makeQuestions(), start: Date.now(), cpu: { s: 5 + Math.floor(Math.random() * 5), ms: 25000 + Math.floor(Math.random() * 45000) } });
  };
  const finish = () => {
    if (!round) return;
    const ms = Date.now() - round.start;
    const s = ms > QUIZ_SECONDS * 1000 ? 0 : round.q.filter((q, i) => Number.parseInt(answers[i] ?? "", 10) === quizAnswer(q)).length;
    setResult({ s, ms });
  };
  const outcome = result && round && (result.s > round.cpu.s || (result.s === round.cpu.s && result.ms < round.cpu.ms) ? "You beat the Computer" : result.s === round.cpu.s && result.ms === round.cpu.ms ? "Draw" : "The Computer won this round");

  return (
    <section className="quiz-card mt-4">
      <h3><Bot className="h-4 w-4" />Practice against the Computer · free</h3>
      <p className="text-xs text-muted-foreground">Warm up before a staked match. Practice rounds never touch your balance.</p>
      {!round ? (
        <Button className="mt-3" variant="outline" onClick={begin}>Start practice round</Button>
      ) : result ? (
        <>
          <div className="quiz-scores">
            <div><small>You</small><strong>{result.s}/10</strong><span>{fmt(result.ms)}</span></div>
            <div><small>Computer</small><strong>{round.cpu.s}/10</strong><span>{fmt(round.cpu.ms)}</span></div>
          </div>
          <p className="quiz-wait"><strong>{outcome}</strong></p>
          <Button className="mt-2" variant="outline" onClick={begin}>Play again</Button>
        </>
      ) : (
        <>
          <div className="quiz-head"><span /><span className={`quiz-timer ${left <= 15 ? "is-low" : ""}`}><Timer className="h-4 w-4" />{left}s</span></div>
          <QuestionList questions={round.q} answers={answers} setAnswers={setAnswers} disabled={left === 0} />
          <Button className="mt-3 w-full" onClick={finish}><Send />Submit answers</Button>
        </>
      )}
    </section>
  );
};
