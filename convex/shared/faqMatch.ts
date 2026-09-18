/**
 * Gate for the FAQ retrieval channel (embeddings/search.ts: fetchActiveFaqs).
 *
 * contentTokens is also used by reranking/cascade.ts to score query/chunk word
 * overlap, so changes to STOP_WORDS or stem() move the final ranking of every
 * answer, not just FAQ admission.
 *
 * Convex's search index matches any shared term, so a question containing only
 * "UET Taxila" would pull an unrelated FAQ into every answer. A FAQ is therefore
 * only allowed into the candidate pool when the asked question's content words
 * are actually covered by that FAQ, and at least one of them appears in the FAQ's
 * own question rather than only somewhere in its answer text.
 */

// Words carried by nearly every question here, so they say nothing about topic.
const STOP_WORDS = new Set([
  "a",
  "about",
  "am",
  "an",
  "and",
  "any",
  "are",
  "at",
  "be",
  "can",
  "do",
  "does",
  "engineering", // 9 of 10 UET programs are engineering; too common to discriminate
  "for",
  "from",
  "get",
  "have",
  "how",
  "i",
  "in",
  "is",
  "it",
  "many",
  "me",
  "much",
  "my",
  "of",
  "on",
  "or",
  "pakistan",
  "please",
  "taxila",
  "tell",
  "the",
  "there",
  "this",
  "to",
  "university",
  "uet",
  "want",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "you",
  "your",
]);

/** Cheap suffix stripping so "freezing"/"freeze" and "programs"/"program" match. */
function stem(word: string): string {
  if (word.length <= 4) return word;
  for (const suffix of ["ing", "ies", "es", "ed", "s", "e"]) {
    if (word.endsWith(suffix)) return word.slice(0, -suffix.length);
  }
  return word;
}

export function contentTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of text
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)) {
    if (!raw || STOP_WORDS.has(raw)) continue;
    tokens.add(stem(raw));
  }
  return tokens;
}

/**
 * Share of the asked question's content words that appear in the FAQ's own question.
 * The FAQ answer is deliberately not counted: answers repeat generic words like "fee",
 * "semester" and "pay", which made unrelated entries (e.g. the grade-sheet FAQ for a
 * fee-payment question) look like perfect matches.
 */
export function faqCoverage(question: string, faqQuestion: string): number {
  const asked = contentTokens(question);
  if (asked.size === 0) return 0;

  const inFaqQuestion = contentTokens(faqQuestion);
  let matched = 0;
  for (const token of asked) {
    if (inFaqQuestion.has(token)) matched++;
  }
  // One shared word is enough only for a question that has just one content word
  // ("how to apply"); anything longer needs at least two, so a lone "available" or
  // "merit" cannot pull in an unrelated FAQ.
  if (matched < Math.min(2, asked.size)) return 0;
  return matched / asked.size;
}

/** A FAQ joins the candidate pool only at or above this coverage. */
export const FAQ_MIN_COVERAGE = 0.5;
