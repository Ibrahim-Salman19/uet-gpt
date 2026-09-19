import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createInactivityDeadline } from "../../src/lib/inactivity-deadline";

/**
 * The regression this guards: src/hooks/use-chat.ts armed a single wall-clock timer for
 * the whole turn - history fetch, user insert, LLM request and the entire stream read -
 * so an answer that took longer than CHAT_TIMEOUT_MS end to end was aborted mid-stream
 * and discarded even while it was still producing tokens. Retrieval alone measured 8.2s
 * in production on 2026-09-19, and high-impact queries now force an extra CRAG LLM call
 * before generation starts.
 */
describe("createInactivityDeadline", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("fires when nothing makes progress for the whole window", () => {
    const onIdle = vi.fn();
    createInactivityDeadline(onIdle, 45_000);

    vi.advanceTimersByTime(44_999);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  test("a long answer that keeps streaming is never cut off", () => {
    const onIdle = vi.fn();
    const deadline = createInactivityDeadline(onIdle, 45_000);

    // Five minutes of steady streaming, a chunk every 10s - far beyond the old
    // whole-turn deadline, which is exactly the case that used to be truncated.
    for (let elapsed = 0; elapsed < 300_000; elapsed += 10_000) {
      vi.advanceTimersByTime(10_000);
      deadline.reset();
    }
    expect(onIdle).not.toHaveBeenCalled();

    // ...but a stall after the last chunk still aborts.
    vi.advanceTimersByTime(45_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  test("still bounds time-to-first-byte, because the first chunk is the first reset", () => {
    const onIdle = vi.fn();
    createInactivityDeadline(onIdle, 45_000);
    vi.advanceTimersByTime(45_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  test("clear() disarms it, so a completed turn cannot abort afterwards", () => {
    const onIdle = vi.fn();
    const deadline = createInactivityDeadline(onIdle, 45_000);
    deadline.clear();
    vi.advanceTimersByTime(10 * 45_000);
    expect(onIdle).not.toHaveBeenCalled();
    expect(deadline.armed()).toBe(false);
  });

  test("fires at most once per deadline", () => {
    const onIdle = vi.fn();
    const deadline = createInactivityDeadline(onIdle, 1_000);
    vi.advanceTimersByTime(5_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(deadline.armed()).toBe(false);
  });
});
