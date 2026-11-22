import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "./use-mobile";

describe("useIsMobile", () => {
  afterEach(() => vi.restoreAllMocks());

  it("detects mobile widths and updates and cleans up its resize listener", () => {
    let onChange: (() => void) | undefined;
    const removeEventListener = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      addEventListener: vi.fn((_event: string, listener: () => void) => {
        onChange = listener;
      }),
      removeEventListener,
    })));
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(767);
    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    vi.spyOn(window, "innerWidth", "get").mockReturnValue(768);
    act(() => onChange?.());
    expect(result.current).toBe(false);
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", onChange);
    vi.unstubAllGlobals();
  });
});