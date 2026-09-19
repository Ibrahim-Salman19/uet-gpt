import { describe, expect, it, vi } from "vitest";

vi.mock("../../convex/_generated/server", () => ({
  action: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalAction: (opts: { handler: Function }) => ({ handler: opts.handler }),
  query: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalQuery: (opts: { handler: Function }) => ({ handler: opts.handler }),
  mutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalMutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

import { CASCADE_CONFIG, CRAG_CONFIG } from "../../convex/rag/constants";
import { cascadeRerank, computeWordOverlap } from "../../convex/reranking/cascade";

/**
 * Characterization of the score SCALE that every relevance gate is compared against.
 *
 * Production never reaches a cross-encoder (no RERANKER_URL, no COHERE_API_KEY), so
 * cascadeRerank always returns its Tier-1 score:
 *
 *   score = overlapWeight x wordOverlap + positionWeight x (1 - i / poolSize)
 *
 * Five separate absolute cutoffs read that one number - CRAG_CONFIG.skipThreshold, the
 * three determineConfidenceTier bands, and (after the freshness multiplier rescales it)
 * the stale-source demotion. None of them is a calibrated probability, so any change to
 * the formula moves all five at once, silently. These tests exist so that such a change
 * shows up as a failing assertion in the same diff.
 */
async function rerank(query: string, texts: string[], topK = 4) {
  return (await (cascadeRerank as any).handler({} as any, {
    query,
    documents: texts.map((text, i) => ({ id: `d${i}`, text })),
    topK,
  })) as Array<{ text: string; score: number; index: number }>;
}

const QUERY = "What is the fee structure for BS programs?";
// Shares most of the query's content words.
const ON_TOPIC = "The fee structure for BS programs lists first semester dues of Rs. 101,800.";
// Shares none of them; used to push a chunk under CASCADE_CONFIG.minWordOverlap.
const OFF_TOPIC =
  "The cricket team travelled overnight and their coach praised everyone afterwards.";
// Shares exactly one of the query's four content words (overlap 0.25).
const WEAK_MATCH = "The organisational structure of the sports board was announced by the coach.";

describe("cascade Tier-1 score scale", () => {
  it("is exactly overlapWeight x overlap + positionWeight x position", async () => {
    const texts = [ON_TOPIC, ON_TOPIC, ON_TOPIC, ON_TOPIC];
    const out = await rerank(QUERY, texts, 4);

    for (const item of out) {
      const expected =
        CASCADE_CONFIG.overlapWeight * computeWordOverlap(QUERY, texts[item.index] as string) +
        CASCADE_CONFIG.positionWeight * (1 - item.index / texts.length);
      expect(item.score).toBeCloseTo(expected, 10);
    }
  });

  it("gives the first candidate a floor of positionWeight, whatever its overlap", async () => {
    // positionScore is 1.0 at i=0, so the top vector hit cannot score below 0.4 - it
    // carries the retrieval ordering the reranker is meant to be second-guessing.
    const out = await rerank(QUERY, [ON_TOPIC, ON_TOPIC, ON_TOPIC, ON_TOPIC], 4);
    const first = out.find((o) => o.index === 0);

    expect(first!.score).toBeGreaterThanOrEqual(CASCADE_CONFIG.positionWeight);
    // Consequence: skipThreshold does not mean "the top hit is relevant". It means
    // "the top hit's word overlap is at least (skipThreshold - positionWeight) /
    // overlapWeight" - one third, on today's numbers.
    const overlapNeededAtRankOne =
      (CRAG_CONFIG.skipThreshold - CASCADE_CONFIG.positionWeight) / CASCADE_CONFIG.overlapWeight;
    expect(overlapNeededAtRankOne).toBeCloseTo(1 / 3, 10);
  });

  it("scores the same chunk at the same rank differently when the pool shrinks", async () => {
    // positionScore divides by poolSize, so anything that drops candidates BEFORE
    // reranking rescales every surviving score. embeddings/search.ts:dropOlderEditions
    // does exactly that, which is why it cannot be treated as independent of the gates.
    const big = [OFF_TOPIC, ON_TOPIC, OFF_TOPIC, OFF_TOPIC, OFF_TOPIC, OFF_TOPIC];
    const small = [OFF_TOPIC, ON_TOPIC, OFF_TOPIC];

    const fromBig = (await rerank(QUERY, big, 6)).find((o) => o.index === 1)!;
    const fromSmall = (await rerank(QUERY, small, 3)).find((o) => o.index === 1)!;

    // Identical query, identical chunk, identical rank - different score.
    expect(fromSmall.score).not.toBeCloseTo(fromBig.score, 6);
    expect(fromSmall.score).toBeLessThan(fromBig.score);
  });

  it("can only produce a top score below positionWeight when the first candidate is filtered out", async () => {
    // The determineConfidenceTier band at topScore < 0.4 is NOT dead code, but it is far
    // narrower than it looks: it needs the rank-1 chunk to fall under minWordOverlap
    // while some later chunk clears it. Documented because "low score" reads as "weak
    // match" and actually means "the top retrieval was off-topic".
    //
    // The < 0.2 band is not asserted here. It needs 0.6 x o + 0.4 x (1 - i/n) < 0.2 with
    // o >= minWordOverlap, i.e. i/n > 0.65 - at pool 8, ranks 1-6 all failing the overlap
    // filter while rank 7 or 8 clears it. It is also unreachable with a four-content-word
    // query at all, since the smallest overlap above the filter is then 0.25, which floors
    // the last rank at exactly 0.20. Reaching it requires a longer query; not constructed.
    expect(computeWordOverlap(QUERY, OFF_TOPIC)).toBeLessThan(CASCADE_CONFIG.minWordOverlap);
    expect(computeWordOverlap(QUERY, WEAK_MATCH)).toBeGreaterThan(CASCADE_CONFIG.minWordOverlap);

    // Rank-1 is off-topic enough to be filtered; the only survivor sits last.
    const filteredOut = await rerank(QUERY, [OFF_TOPIC, OFF_TOPIC, OFF_TOPIC, WEAK_MATCH], 4);
    expect(filteredOut[0]!.index).toBe(3);
    expect(filteredOut[0]!.score).toBeLessThan(CASCADE_CONFIG.positionWeight);

    // Same four chunks, same weak match, but now it IS rank-1: the floor applies and
    // the low bands become unreachable for this pool.
    const survives = await rerank(QUERY, [WEAK_MATCH, OFF_TOPIC, OFF_TOPIC, OFF_TOPIC], 4);
    expect(survives[0]!.index).toBe(0);
    expect(survives[0]!.score).toBeGreaterThanOrEqual(CASCADE_CONFIG.positionWeight);
  });
});
