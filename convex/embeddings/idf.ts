const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "need",
  "dare",
  "ought",
  "used",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "out",
  "off",
  "over",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "because",
  "but",
  "and",
  "or",
  "if",
  "while",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "what",
  "which",
  "who",
  "whom",
]);

export type AdaptiveWeights = { vector: number; text: number };

export type IdfEstimate = {
  rareTermRatio: number;
  weights: AdaptiveWeights;
};

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

export function estimateIdf(query: string): IdfEstimate {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return { rareTermRatio: 0, weights: { vector: 1.5, text: 0.5 } };
  }

  const contentWords = tokens.filter((w) => !STOPWORDS.has(w));
  const uniqueWords = new Set(contentWords);
  const uniqueRatio = contentWords.length > 0 ? uniqueWords.size / contentWords.length : 0;
  const avgWordLength =
    contentWords.length > 0
      ? contentWords.reduce((sum, w) => sum + w.length, 0) / contentWords.length
      : 0;
  const lengthSpecificity = Math.min(1, avgWordLength / 8);
  const rareTermRatio = Math.min(1, uniqueRatio * 0.6 + lengthSpecificity * 0.4);

  const wordCount = tokens.length;
  let weights: AdaptiveWeights;

  if (wordCount < 5) {
    weights = { vector: 1.5, text: 0.5 };
    if (rareTermRatio > 0.7) {
      weights = { vector: 1.2, text: 0.8 };
    }
  } else if (wordCount <= 15) {
    const textBoost = 0.5 + rareTermRatio * 0.5;
    const vectorWeight = 1.5 - rareTermRatio * 0.5;
    weights = { vector: vectorWeight, text: textBoost };
  } else {
    weights = { vector: 0.5, text: 1.5 };
    if (rareTermRatio < 0.3) {
      weights = { vector: 1.0, text: 1.0 };
    }
  }

  return { rareTermRatio, weights };
}
