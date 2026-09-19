/**
 * The canonical refusal string, and a detector for answers that are refusals in
 * substance whatever their wording.
 *
 * Why a detector and not just a string comparison: only the "refuse" confidence tier
 * orders a verbatim reply. The hedge tier and src/lib/prompt.ts GROUNDING_RULES tell
 * the model to *say* it couldn't find verified information, in its own words, so a
 * refusal reaches the user paraphrased. Observed in production on 2026-09-18 for
 * "What is the fee structure for BS programs?":
 *
 *   "I'm sorry, but I couldn't find verified information about the overall fee
 *    structure for BS programs in the available data. Please check the UET Taxila
 *    website (uettaxila.edu.pk) or contact the admissions office..."
 *
 * That answer cited two sources, so both existing cache guards - which key on
 * sources.length - admitted it. A cached refusal is the worst possible entry to hold:
 * assignFreshnessTier gives it the LONGEST ttl bucket, and it survives the very
 * re-crawl that would add the missing content.
 *
 * The detector is deliberately narrow, because a false positive silently disables
 * caching for a good answer. It requires an explicit negation within one clause of
 * "verified information" (or "specific information about this"), which is the phrasing
 * the prompts actually train, and only looks at the head of the answer - a real refusal
 * front-loads it, while a correct answer that happens to mention verifying details
 * later does not.
 */

export const REFUSAL_TEXT =
  "I don't have verified information about this - please check uettaxila.edu.pk directly.";

/**
 * A genuine refusal states itself immediately - in both answers recovered from
 * production the phrase begins around character 17 ("I'm sorry, but I couldn't
 * find verified information..."). The window has to stay tight enough that a
 * partial answer which LEADS with the facts and only then names the gap is not
 * mistaken for a refusal, because src/lib/prompt.ts now instructs the model to
 * write exactly that. A short partial answer can still trip this; the cost is a
 * cache miss on an answer that only partly covers the question, which is a
 * reasonable thing not to store for five days.
 */
const REFUSAL_HEAD_CHARS = 80;

/**
 * Model output uses typographic punctuation ("I'm", "couldn't"), so the literal
 * ASCII forms in the prompts never match it as written.
 */
function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const NEGATION =
  "(?:do not|don't|does not|doesn't|did not|didn't|could not|couldn't|cannot|can't|was unable to|were unable to|am unable to|have no|has no|found no|there is no|i have no)";

const REFUSAL_PATTERNS: readonly RegExp[] = [
  // "don't have verified information", "couldn't find verified information about ..."
  new RegExp(`\\b${NEGATION}\\b[^.]{0,60}\\bverified information\\b`),
  // convex/rag/prompts.ts phrasing, kept because it is still reachable prompt text.
  new RegExp(`\\b${NEGATION}\\b[^.]{0,60}\\bspecific information about this\\b`),
];

/**
 * True when an answer should never be cached or served from cache.
 *
 * Empty/blank text counts: there is nothing to serve, and an empty entry has the same
 * unevictable-long-ttl problem as a refusal.
 */
export function isRefusalAnswer(text: string | null | undefined): boolean {
  const head = normalizeAnswer(text ?? "").slice(0, REFUSAL_HEAD_CHARS);
  if (head.length === 0) return true;
  return REFUSAL_PATTERNS.some((pattern) => pattern.test(head));
}
