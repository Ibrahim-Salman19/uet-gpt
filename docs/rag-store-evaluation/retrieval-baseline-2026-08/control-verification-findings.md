# Convex Retrieval Baseline — Control Verification (2026-08)

**Authoritative machine-readable source: [`control-verification-findings.json`](./control-verification-findings.json).**
This document narrates it for a human reader; if it ever disagrees with the JSON, the JSON wins.

## Verdict

> **BASELINE TOOLING DEFECT FOUND — BENCHMARK NOT AUTHORIZED**

No baseline was executed. No embeddings were generated, no Gemini API calls were made, the corpus
export endpoint was never called, and nothing in the repository was modified other than this evidence
record. Per the explicit instruction governing this phase — inspect the evaluator and prove it matches
production semantics *before* running it, and stop before changing anything if it doesn't — that is
exactly what happened here.

## What this covered

`scripts/stage_e_retrieval_eval.py` was read in full (2,844 lines) and cross-referenced line-by-line
against the real production retrieval pipeline: `convex/embeddings/generate.ts`, `convex/rag/instance.ts`,
`convex/embeddings/dimension.ts`, `convex/embeddings/search.ts`, `convex/embeddings/idf.ts`,
`convex/crawl/queries.ts`, `convex/shared/freshnessPolicy.ts`, `convex/crawl/exportCorpus.ts`,
`convex/rag/retrieval.ts`, and `scripts/uet_crawler/url_policy.py`.

## What matches

- **Embedding model**: both sides use the literal string `"gemini-embedding-2"`.
- **Dimensions**: both sides use 768.
- **RRF-k constant**: both default to 60 — though, as below, sharing this one constant does not mean
  the fusion *algorithms* match.

## Three confirmed defects (HIGH severity — the reason this stops here)

### 1. Query/document embedding inputs are formatted differently

The evaluator prepends Google's recommended retrieval-task prefixes to every embedding call — queries
become `"task: question answering | query: <text>"`, documents become `"title: <title> | text: <text>"`
(`prepare_embedding_input`, lines 552–567). Production sends the **raw, unprefixed text** with nothing
wrapped around it at all (`embedNativeGemini`, `convex/embeddings/generate.ts:100-167`) — and this isn't
an oversight. The code carries its own comment: *"Note: taskType parameter has no effect on
gemini-embedding-2 (confirmed bug)"* (`generate.ts:15`). Someone already investigated this and
deliberately chose not to prefix. The evaluator is computing embeddings in a different region of the
model's latent space than production does for identical text — every dense and hybrid metric downstream
of this is measuring something other than production's real similarity scores.

### 2. The "hybrid" strategy is a different fusion algorithm, not an approximation of the real one

The evaluator's hybrid strategy is a 2-channel, fixed-weight (implicitly 1.0/1.0) RRF over dense
similarity and a custom Python BM25 index, fused at the document level (`reciprocal_rank_fusion`,
lines 1907–1925). Production's real `hybridRank()` (`convex/embeddings/search.ts:61-99`) is a
**3-channel** fusion — vector results, a document-level full-text channel, and a *separate* chunk-level
channel weighted at `adaptiveWeights.text * 0.5` — using **query-dependent adaptive weights** from
`estimateIdf()` (`convex/embeddings/idf.ts:116-152`) that range from `{vector:1.5, text:0.5}` for short
queries to `{vector:0.5, text:1.5}` for long ones, never a fixed split. Production also injects up to 2
FAQ results through an entirely separate scoring path merged by a plain sort afterward
(`search.ts:166-198,369-372`), which the evaluator has no equivalent of. The evaluator's "hybrid" number
answers "what would a naive fixed-weight 2-channel RRF produce," not "what does production's adaptive
3-channel, FAQ-aware fusion produce."

### 3. Freshness/eligibility filtering doesn't exist in the evaluator, and the corpus export can't support it

Production hard-excludes documents with certain statuses (stale/failed/pending/processing/pending_embed)
from retrieval entirely and applies a 0.3× penalty to eligible-but-aged documents
(`convex/shared/freshnessPolicy.ts:107-256`, applied in `search.ts:301-325`). The corpus export
(`convex/crawl/exportCorpus.ts:29-39`) doesn't include `status`, `isStale`, `freshnessTier`, or
`crawledAt` on documents or chunks at all — the evaluator has no data to reproduce this filtering even
if it tried to. It can surface a document production would exclude or heavily penalize, in either
direction, with no way to know it's doing so.

## Lower-confidence, unresolved — not blocking on their own, but real

- **BM25 algorithm fidelity**: the evaluator implements textbook Okapi BM25 (k1=1.5, b=0.75) over its
  own tokenizer; production's lexical channel is Convex's proprietary `.withSearchIndex()` search, an
  opaque algorithm with no published parameters to check against. Since RRF fusion is rank-only (raw
  scores from this channel aren't used numerically), the real question is whether the two algorithms'
  *orderings* diverge — unverified either way.
- **Candidate overfetch cap**: production bounds each channel to `candidateLimit(k)` = 30 candidates
  for a typical `limit=8` search (`freshnessPolicy.ts:84-101`); the evaluator scores the entire corpus
  exhaustively with no bound at all. Lower risk today given likely relevant-document density, but a real
  structural difference worth documenting explicitly (it's the same "exact ground truth" pattern already
  used for the Turso benchmark, which is a legitimate design choice — just not the same thing as "what
  production actually returns").
- **Canonical URL query-string handling**: the evaluator passes query strings through unmodified;
  production's crawler applies additional query-parameter stripping/sorting the evaluator doesn't
  replicate. Not observed to cause an actual mismatch with the current 6-query set (all use simple,
  unambiguous parameters), but unverified for anything more complex.

## One boundary that's probably *correct*, but needs to be said out loud

The evaluator stops at the raw RRF-fused ranking. Production's real pipeline doesn't: after
`searchDocumentsAction` (limit 8) comes `cascadeRerank` narrowing to a top 4
(`convex/rag/retrieval.ts:185-241`), then a further CRAG LLM-judge pass. This is plausibly the *right*
scope for a backend-comparison baseline specifically — the reranker is meant to be a constant, unchanged
downstream stage applied equally regardless of which vector backend supplies the candidates. But it
means every metric this tool produces describes **pre-reranking candidate-pool quality**, not what a
real user actually sees. That needs to be stated prominently in every report this tool produces, which
it currently is not.

## Relevance-label provenance

The built-in 6-query default set (`DEFAULT_QUERY_ROWS`, lines 147–198) carries its own caution: *"These
preserve the original manual judgments, but use exact URLs rather than unsafe substring fragments.
Review these labels with a domain expert before treating the scores as an acceptance benchmark."*
Classified here as `EXISTING_TEST`, not `HUMAN_VERIFIED` — no record was found confirming that expert
review has happened since this comment was written. Six queries is also a small set for a project-wide
baseline; the script's bootstrap confidence-interval machinery is good practice for quantifying that
uncertainty, but doesn't substitute for a larger set if one turns out to be needed.

## What happens next

Not decided here. Each of the three confirmed defects needs either a fix to the evaluator — with its
own justification and a red→green verification pass, not a silent methodology change — or an explicit,
informed decision to accept a specific divergence as intentional and document it clearly everywhere
this tool's output is used. Until one of those happens, this evaluator's numbers cannot be trusted as
a production-equivalent Convex retrieval baseline.
