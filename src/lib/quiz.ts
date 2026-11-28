export type QuizQuestion = [number, "+" | "-" | "x", number];
/** Seconds players get to answer; the server ignores answers sent after 95s. */
export const QUIZ_SECONDS = 90;

export const shouldAutoSubmitQuiz = (secondsLeft: number, active: boolean, submitted: boolean, busy: boolean) =>
  active && secondsLeft === 0 && !submitted && !busy;

export const quizAnswer = ([a, op, b]: QuizQuestion) => (op === "+" ? a + b : op === "-" ? a - b : a * b);

/** Same shape the server uses: additions, subtractions with non-negative results, and times tables. */
export const makeQuestions = (rand: () => number = Math.random): QuizQuestion[] =>
  Array.from({ length: 10 }, () => {
    const k = Math.floor(rand() * 3);
    const x = 10 + Math.floor(rand() * 90), x2 = 5 + Math.floor(rand() * 60);
    if (k === 0) return [x, "+", x2];
    if (k === 1) return [x + x2, "-", x2];
    return [2 + Math.floor(rand() * 11), "x", 3 + Math.floor(rand() * 10)];
  });
