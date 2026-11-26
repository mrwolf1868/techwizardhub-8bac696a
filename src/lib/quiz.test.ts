import { describe, expect, it } from "vitest";
import { makeQuestions, quizAnswer } from "./quiz";

describe("math quiz", () => {
  it("always has 10 questions", () => expect(makeQuestions()).toHaveLength(10));
  it("never asks a subtraction with a negative answer", () => {
    for (let i = 0; i < 50; i++) makeQuestions().forEach((q) => expect(quizAnswer(q)).toBeGreaterThanOrEqual(0));
  });
  it("marks 12 x 7 as 84", () => expect(quizAnswer([12, "x", 7])).toBe(84));
});
