import { describe, expect, it } from "vitest";
import { MAX_TOTAL_CHARS, trimHistoryToBudget } from "../../src/lib/chat/validate";

type Msg = { role: "user" | "assistant"; content: string };
const msg = (role: Msg["role"], chars: number, tag: string): Msg => ({
  role,
  content: tag.repeat(Math.max(1, Math.ceil(chars / tag.length))).slice(0, chars),
});

/**
 * Audit §21: this used to be a hard 413 on the whole conversation. Assistant replies are
 * capped at 2000 output tokens (~8,000 chars) and are stored and resent as history, so a
 * thread of substantive answers crosses MAX_TOTAL_CHARS after roughly four exchanges - and
 * from then on EVERY further message in that thread fails, permanently, with no indication
 * that starting a new thread would fix it.
 */
describe("trimHistoryToBudget", () => {
  it("leaves a normal conversation untouched", () => {
    const history = [msg("user", 40, "q"), msg("assistant", 400, "a"), msg("user", 30, "q2")];
    expect(trimHistoryToBudget(history, MAX_TOTAL_CHARS)).toEqual(history);
  });

  it("recovers the thread that used to 413 after a few long answers", () => {
    // Four ~8,000-char answers plus their questions is already over budget.
    const history: Msg[] = [];
    for (let i = 0; i < 5; i++) {
      history.push(msg("user", 60, `q${i}`));
      history.push(msg("assistant", 8_000, `a${i}`));
    }
    history.push(msg("user", 50, "latest"));
    expect(history.reduce((n, m) => n + m.content.length, 0)).toBeGreaterThan(MAX_TOTAL_CHARS);

    const kept = trimHistoryToBudget(history, MAX_TOTAL_CHARS);
    expect(kept).not.toBeNull();
    expect(kept!.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(MAX_TOTAL_CHARS);
    // The question being asked must survive - it is the whole request.
    expect(kept![kept!.length - 1]).toEqual(history[history.length - 1]);
    // ...and it must be a real trim, not the whole thing.
    expect(kept!.length).toBeLessThan(history.length);
  });

  it("drops the OLDEST turns, keeping the ones nearest the question", () => {
    // 30,000 + 8,000 + 50 = 38,050, genuinely over MAX_TOTAL_CHARS (32,000), so the
    // oldest turn has to go. An earlier version of this test used 20,000 and summed to
    // 28,050 - under budget - so keeping all three was correct and the test was wrong.
    const history = [
      msg("user", 30_000, "old"),
      msg("assistant", 8_000, "mid"),
      msg("user", 50, "new"),
    ];
    const kept = trimHistoryToBudget(history, MAX_TOTAL_CHARS)!;
    expect(kept.map((m) => m.content[0])).toEqual(["m", "n"]);
  });

  it("still 413s when the newest message alone busts the budget", () => {
    expect(
      trimHistoryToBudget([msg("user", MAX_TOTAL_CHARS + 1, "x")], MAX_TOTAL_CHARS),
    ).toBeNull();
  });

  it("returns null for an empty conversation rather than throwing", () => {
    expect(trimHistoryToBudget([], MAX_TOTAL_CHARS)).toBeNull();
  });

  it("keeps the prompt-cost bound the 413 was protecting", () => {
    const history = Array.from({ length: 40 }, (_, i) =>
      msg(i % 2 ? "assistant" : "user", 4_000, `m${i}`),
    );
    const kept = trimHistoryToBudget(history, MAX_TOTAL_CHARS)!;
    expect(kept.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(MAX_TOTAL_CHARS);
  });
});
