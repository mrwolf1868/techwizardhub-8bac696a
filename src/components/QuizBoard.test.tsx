import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuizBoard } from "./QuizBoard";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn(async (..._args: unknown[]) => ({ error: null })) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

describe("quiz timeout", () => {
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
  it("submits the player's current answers automatically at 90 seconds, only once", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(100000));
    render(<QuizBoard me="creator" match={{ id: "quiz-match", creator_id: "creator", opponent_id: "opponent", status: "active", state: JSON.stringify({ start: 100, q: Array.from({ length: 10 }, () => [12, "+", 7]), r: {} }) }} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Answer 1" }), { target: { value: "19" } });
    expect(rpc).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(90000); });
    expect(rpc).toHaveBeenCalledWith("quiz_submit", { _id: "quiz-match", _answers: [19, ...Array(9).fill(-999999)] });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(rpc.mock.calls.filter(call => call[0] === "quiz_submit")).toHaveLength(1);
  });
});