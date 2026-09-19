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

/**
 * Share of the FAQ question's own content words that the asked question covers.
 *
 * Used only to break ties on faqCoverage. "How to apply for the Degree?" and "How to
 * apply for a particular Bonafied Certificate?" both cover 2 of the 4 content words in
 * "What is the procedure to apply for a degree certificate at UET Taxila?", so coverage
 * alone leaves the order to chance; the first is entirely about what was asked and the
 * second brings a different subject with it.
 */
export function faqSpecificity(question: string, faqQuestion: string): number {
  const inFaqQuestion = contentTokens(faqQuestion);
  if (inFaqQuestion.size === 0) return 0;

  const asked = contentTokens(question);
  let matched = 0;
  for (const token of inFaqQuestion) {
    if (asked.has(token)) matched++;
  }
  return matched / inFaqQuestion.size;
}

/** A FAQ joins the candidate pool only at or above this coverage. */
export const FAQ_MIN_COVERAGE = 0.5;

/**
 * Best coverage/specificity for one FAQ across every phrasing of the user's question.
 *
 * The FAQ gate was matched against the user's own words, which is right for English - the
 * rewrite paraphrases, and the FAQ's wording is what we want to compare against. It breaks
 * completely for Roman Urdu, a first-class supported input: "fees kitni hai BS Software
 * Engineering ki" shares NO content token with "What is the fee structure for the first
 * semester?", so coverage is 0.00 and the FAQ carrying the answer is dropped. Only the
 * rewrite, which rewriteQueryAction translates to English, can match it - measured
 * 2026-09-19 on the golden set's Roman Urdu query, "admission k liye zaruri documents kya
 * hain?": 0.29 (filtered) on the user's words, 1.00 (passes) on the rewrite.
 *
 * Taking the max over both phrasings keeps the English behaviour identical - the raw
 * question already wins there, because a rewrite that expands "UET" to "University of
 * Engineering and Technology" only dilutes coverage - while recovering the translated form.
 */
export function bestFaqMatch(
  questionTexts: readonly string[],
  faqQuestion: string,
): { coverage: number; specificity: number } {
  let coverage = 0;
  let specificity = 0;
  for (const text of questionTexts) {
    const c = faqCoverage(text, faqQuestion);
    if (c > coverage) {
      coverage = c;
      specificity = faqSpecificity(text, faqQuestion);
    } else if (c === coverage) {
      // Same coverage from two phrasings: keep the more specific reading rather than
      // letting argument order decide.
      specificity = Math.max(specificity, faqSpecificity(text, faqQuestion));
    }
  }
  return { coverage, specificity };
}
