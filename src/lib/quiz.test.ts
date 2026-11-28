import { describe, expect, it } from "vitest";
import { makeQuestions, quizAnswer, shouldAutoSubmitQuiz } from "./quiz";

describe("math quiz", () => {
  it("automatically submits unsubmitted answers when time ends", () => {
    expect(shouldAutoSubmitQuiz(0, true, false, false)).toBe(true);
    expect(shouldAutoSubmitQuiz(1, true, false, false)).toBe(false);
    expect(shouldAutoSubmitQuiz(0, true, true, false)).toBe(false);
    expect(shouldAutoSubmitQuiz(0, true, false, true)).toBe(false);
    expect(shouldAutoSubmitQuiz(0, false, false, false)).toBe(false);
  });
  it("always has 10 questions", () => expect(makeQuestions()).toHaveLength(10));
  it("never asks a subtraction with a negative answer", () => {
    for (let i = 0; i < 50; i++) makeQuestions().forEach((q) => expect(quizAnswer(q)).toBeGreaterThanOrEqual(0));
  });
  it("marks 12 x 7 as 84", () => expect(quizAnswer([12, "x", 7])).toBe(84));
});
