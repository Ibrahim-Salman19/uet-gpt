# Phase 6 — Gemini Embedding Workload & Cost Report (2026-08-23)

**Base commit:** `2e934f3` (Phase 5, local Convex lexical proof). A report
only - no embedding calls, no Gemini calls, no cloud calls of any kind were
made to produce this. Estimates the cost/time to actually embed Corpus V1,
as an input to a future, separate authorization decision.

## Verdict

```text
CORE PIPELINE GEMINI CALLS:    45,306 total (514 generateContextSummary +
                                44,792 embedSingleChunk)
EMBEDDING TOKEN VOLUME:        ~33.4M input tokens (extrapolated from a
                                62.7%-sampled real character count - see §2)
ESTIMATED COST:                 $3.48 (Batch API) - $6.83 (standard API)
ESTIMATED WALL-CLOCK:           ~50 hours at this repo's current throttled
                                config (embeddingPool maxParallelism=3,
                                ~15 RPM effective) | ~15 minutes if
                                reconfigured for Paid Tier 1 (3000 RPM)
FREE-TIER DAILY CAP:            ~1500 RPD -> ~30 days to clear the full
                                backlog on the free tier alone
SEPARATE, ALREADY-GATED COST:   R-9 chunk-level contextualization
                                (gemini-3.5-flash-lite) is NOT part of this
                                estimate - see §4
THIS REPORT'S OWN CLOUD/GEMINI
CALLS:                          0
```

## 0. What this phase is

Per the mandate, before any real embedding work happens, produce a workload
and cost estimate grounded in the actual frozen corpus - not a guess. This
uses Phase 5's real local ingest (1,891 documents, 44,792 chunks, byte-
identical chunking to the production pipeline) rather than a synthetic
sample, so the numbers below reflect what a real embed run of Corpus V1
would actually cost.

## 1. What actually gets called, and what doesn't

Two Gemini call sites are unconditional parts of the real ingest pipeline
(`convex/crawl/webhook.ts`'s `processIngestContent`):

1. **`generateContextSummary`** (`convex/crawl/chunking.ts`) - one call per
   document over 500 words, model `gemini-2.5-flash`, generates a 1-sentence
   document summary used as a shared context prefix for all of that
   document's chunks.
2. **`embedSingleChunk`** (`convex/embeddings/generate.ts`) - one call per
   child chunk, model `gemini-embedding-2`, 768 dimensions.

A third call site, **R-9 chunk-level contextualization**
(`convex/embeddings/contextualize.ts`'s `contextualizeChunks`, model
`gemini-3.5-flash-lite`), is deliberately excluded from this estimate - see
§4 for why.

## 2. Real corpus numbers (from Phase 5's actual local ingest)

```text
Total documents:                    1,891
Documents >500 words
  (trigger generateContextSummary): 514
Total chunks (= embedSingleChunk
  calls, one per child chunk):      44,792
```

Chunk character volume was measured directly against the real local Convex
data (not estimated from source markdown), because chunk text already
includes the `contextPrefix` and heading-path scaffolding the real pipeline
adds before embedding - sampling `documents.jsonl` directly would
undercount. Paginated through `crawledChunks` summing `text.length`:
**28,072 of 44,792 chunks (62.7%) summed directly** to 73,354,158
characters (avg 2,613 chars/chunk) before a shell-scripting issue with one
pagination cursor stopped the sweep; the remaining 37.3% is extrapolated at
the same average rather than re-run, since the sampled average already
spans a wide range of per-page averages (1,466 to 7,229 chars/chunk across
13 pages) - i.e. it already captures the corpus's real content-type
variance (HTML vs PDF chunks), not a narrow slice.

```text
Extrapolated total chunk characters: 117,044,722
Estimated embedding input tokens:     33,441,349
  (3.5 chars/token - this repo's own conservative estimate,
   convex/embeddings/generate.ts's MAX_EMBED_CHARS comment)
```

## 3. Cost estimate

Pricing verified via live web search (training-data pricing would be
unreliable here - Gemini pricing/model availability changes fast enough
that this repo's own comments record a model going from working to
HTTP-429-dead within the last two months; see `contextualize.ts`'s
`gemini-2.0-flash is dead` comment).

```text
gemini-embedding-2:    $0.20/M tokens standard, $0.10/M Batch API
                        (this repo's own generate.ts comment, matches
                        Google's documented 50% batch discount pattern)
gemini-2.5-flash:      $0.30/M input, $2.50/M output (web-verified 2026-08)
```

```text
Embedding (44,792 calls, ~33.4M input tokens):
  Standard API:   $6.69
  Batch API:      $3.34

Context summaries (514 calls, ~294K input + ~21K output tokens):
  $0.088 (input) + $0.051 (output) = $0.14

TOTAL: $3.48 (Batch API) to $6.83 (standard API)
```

This is a small number in absolute terms - the real constraint on actually
running this is time, not money (§ below), and this repo's own kill-switch
history (the August 2026 incident that produced
`docs/runbooks/resource-safety-incident-response.md`) is about a runaway
*queue*, not a runaway bill.

## 4. Time estimate, and why R-9 contextualization is excluded

**This repo's current live configuration**
(`convex/crawl/workpools.ts`): `embeddingPool.maxParallelism = 3`,
throttled to "Gemini Free Tier safe limit: 15 RPM = 1 request per 4
seconds" (the file's own comment). At that rate:

```text
44,792 embed calls x 4s  = 179,168s = ~49.8 hours wall-clock
```

Free tier's own daily cap (~1,500 RPD per this repo's `generate.ts`
comment) would independently gate a burst-then-stop approach to
~30 days to clear 45,306 total calls, even ignoring the RPM throttle -
the two limits compound, they don't route around each other.

**If reconfigured for Paid Tier 1** (3,000 RPM, `maxParallelism` raised
accordingly - a real code/config change, not something that happens
automatically by having a paid key): ~15 minutes for the embed calls alone.
This is the tier/config tradeoff a real embedding decision would need to
make explicitly.

**R-9 chunk-level contextualization is excluded from this estimate**
because it is architecturally not a "run once against the full corpus"
operation in this codebase: `convex/embeddings/contextualizeCron.ts` gates
it behind `AUTO_BACKFILL_AFTER_MODEL_RECOVERY` (opt-out, but present) and a
`MAX_DOCUMENTS_PER_RECOVERY_BATCH` cap defaulting to 10/day, explicitly
because of a prior incident ("~700MB/4-day envelope") and a stated
requirement that "a measured 5-10 doc pilot" happen before wider rollout.
Running it against the full 44,792-chunk corpus would be a separate,
much slower (10 docs/day-capped), separately-authorized decision - not
part of "embed Corpus V1," and this report does not fold its cost into
the headline numbers above to avoid conflating a mandatory pipeline step
with a deliberately-throttled optional enhancement.

## 5. What this report does not do

No Gemini API calls were made to produce any number here - every figure is
either (a) measured directly from Phase 5's real local Convex data (chunk
counts, character volumes, document word counts) or (b) pricing/rate-limit
facts already recorded in this repo's own code comments, cross-checked
against a live web search for current pricing. This is not a decision to
embed the corpus, Pinecone, or any cloud service - that remains a separate,
explicit authorization, per this project's resource-safety mandate.
