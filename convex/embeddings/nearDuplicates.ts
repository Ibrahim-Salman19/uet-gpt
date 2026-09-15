// Pure module (no Convex runtime imports) so the retrieval eval harness can run the
// same code as search.ts - see hybridRank.ts for why that matters.
//
// Overlapping chunk windows of one page, and sibling chunks that resolve to the same
// parentText, reach the fused candidate list as near-identical content (observed: the
// same admissions nav/link block three times in the top 4, differing only in
// "uettaxila.edu.pk" vs "uettaxila. edu. pk"). Each copy takes a slot the answer model
// could have used for different evidence. Golden-set eval (23 queries, 4 samples):
// ~25% of top-8 slots were such duplicates; skipping them raised recall@4 by 2-4
// queries per sample with no query lost.
const NEAR_DUPLICATE_JACCARD = 0.9;

function wordSet(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z0-9@]+/).filter((w) => w.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * Walks score-ordered results and keeps up to `limit` of them, skipping any whose word
 * set is a near-duplicate of an already-kept result's.
 */
export function dropNearDuplicates<T extends { content: string }>(results: T[], limit: number): T[] {
  const kept: T[] = [];
  const keptWords: Set<string>[] = [];
  for (const r of results) {
    if (kept.length >= limit) break;
    const words = wordSet(r.content);
    if (keptWords.some((k) => jaccard(k, words) >= NEAR_DUPLICATE_JACCARD)) continue;
    kept.push(r);
    keptWords.push(words);
  }
  return kept;
}
