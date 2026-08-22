# Phase 5 — Local Convex Minimal Lexical Capacity Proof (2026-08-23)

**Base commit:** `a09451d` (Corpus V1 freeze, Phase 4). Proves the local
self-hosted Convex deployment can hold the full frozen corpus and serve
keyword/full-text search over it via Convex's built-in `searchIndex`, with
zero embedding or cloud calls.

## Verdict

```text
CORPUS LOADED:                1,891 / 1,891 documents (100%, 0 with zero chunks)
CHUNKS WRITTEN:                44,792 (chunked via the same chunkMarkdown/
                                generateChunks pipeline the production
                                ingest path uses)
SEARCH INDEX:                  crawledChunks.search_text (Convex built-in
                                full-text index) - queried successfully at
                                full scale
SEARCH LATENCY:                 ~109-135ms warm, ~562ms cold-start (first
                                query after deployment idle)
LOCAL STORAGE FOOTPRINT:       474MB (self-hosted backend's /convex/data)
WRITE-RATE CEILING FOUND:      4 MiB/s per this deployment - hit once during
                                a large-batch run, self-recovered via backoff
                                once batches were resized
GEMINI / EMBEDDING CALLS:       0 (structural: placeholder API keys, code
                                path audited, verified via a 300-chunk
                                sample - 0 rows with embeddingModel or
                                contextualizedText set)
CONVEX CLOUD CALLS:              0 (entirely against
                                http://127.0.0.1:3210, a loopback-only
                                self-hosted backend)
```

## 0. What this phase proves

The mandate's target architecture is Pinecone (dense/semantic) + a minimal
Convex lexical layer (keyword/full-text). Before any Pinecone evaluation or
real embedding work, this phase proves the Convex side of that pair is
actually viable at real corpus scale: can `documents`/`crawledChunks` hold
the full frozen corpus, does the existing `search_text` index return
sensible results, and what does that cost in storage/write throughput -
independent of whether embeddings ever get generated.

## 1. Why the existing ingest pipeline could not be reused

The production path (`convex/crawl/webhook.ts`'s `ingestWebhook` ->
`processIngestContent` -> `mutations.ts`'s `enqueueDocumentChunks`)
unconditionally calls `embeddingPool.enqueueActionBatch(ctx,
internal.crawl.actions.embedSingleChunk, ...)` for every child chunk - a
real Gemini call site, not an optional step. `processIngestContent` also
calls `generateContextSummary`, which makes its own direct Gemini call for
any document over 500 words if an API key is present. Neither can be
disabled by configuration; both are unconditional parts of that code path.

**New, isolated file:** `convex/crawl/lexicalProof.ts`. Reuses
`upsertDocument` as-is (read verified: no embedding-related side effects)
and the same pure chunking functions (`normalizeContent`,
`buildContextPrefix`, `generateChunks`) the production path uses, but writes
chunks directly into `crawledChunks` via a new `insertChunksNoEmbedding`
mutation instead of `enqueueDocumentChunks` - never calling
`embeddingPool`/`generateContextSummary`. `ragId` is set to a
locally-generated `lexical-proof:<contentHash>` placeholder string (the
field is a plain `v.string()`, not a reference into the external
`@convex-dev/rag` component, so a row with no real vector embedding is a
legitimate value there).

Two entry points (`ingestBatchForLexicalProof`, `searchChunksForProof`) are
plain `action`, not `internalAction` - see §2 for why. Everything else
(`insertChunksNoEmbedding`, `_getDocumentChunkCount`, `_searchChunks`)
stays `internal*`, matching this codebase's established convention
(`knowledgeStore/lifecycleTest.ts`).

## 2. Two real engineering obstacles found and fixed

1. **CLI argument-size limit.** This sandbox's effective single-argument
   ceiling for `npx convex run functionName '<json>'` is ~100-150KB (found
   empirically: 100KB succeeds, 150KB fails with `OSError: [Errno 7]
   Argument list too long`), far below both `getconf ARG_MAX` (2MB) and the
   corpus's own document sizes (up to ~1MB for one large PDF). The `convex`
   CLI has no file/stdin-args option. Fix: made the two entry points plain
   `action` and drove them via a direct HTTP POST to
   `/api/action` (Convex's documented plain HTTP API, no CLI/argv
   involved) - safe specifically because this deployment is loopback-only
   (`http://127.0.0.1:3210`), never reachable outside this machine.

2. **Write-rate limit + a real idempotency gap it exposed.**
   `ingestBatchForLexicalProof` initially hit "Too many writes per second.
   Your deployment is limited to 4 MiB bytes written per 1 second" partway
   through a large batch. Retrying the same batch is the obvious fix, but
   `upsertDocument`'s skip decision is purely content-hash-based, not
   chunk-completion-based - a document whose `upsertDocument` call
   succeeded but whose subsequent `insertChunksNoEmbedding` call didn't
   (because the rate limit hit in between) would report `action: "skipped"`
   on retry (content unchanged) and silently, permanently never get
   chunked. Fixed by checking the existing document's `chunkCount` on a
   skip and still proceeding to chunk it if zero. Driver fix: smaller
   batches (~120KB budget instead of ~400KB) and a 0.5s inter-batch delay
   to stay under the ceiling proactively, plus exponential-backoff retry on
   the rate-limit error specifically, now safe because of the idempotency
   fix above.

## 3. Search proof

5 real queries against the full 44,792-chunk index, each returning 5
relevant results:

```text
"admission fee structure"              562ms (cold-start)
"hostel accommodation"                 121ms
"electrical engineering department"    135ms
"scholarship eligibility criteria"     109ms
"examination date sheet"               115ms
```

Sample result for `"admission"` (from an earlier 2-document smoke test,
verified relevant before scaling to the full corpus): chunks from
`ProspectusAvailability.php` and `Schedule.php`, both genuinely
admission-related, correct heading-path metadata attached.

## 4. Evidence

```text
documents in DB:           1,891 (matches frozen corpus exactly)
documents with 0 chunks:   0
total chunkCount sum:      44,792
local storage (docker):    474MB (/convex/data inside
                            convex-self-hosted-backend-1)
300-chunk embedding scan:  0 / 300 have embeddingModel or
                            contextualizedText set
```

Driver script and full run logs: `docs/rag-store-evaluation/
local-convex-lexical-proof-2026-08/ingest-driver.py` and
`ingest-run.log` (this directory).

## 5. Cloud activity

Convex Cloud: **0** - every call in this phase targeted
`http://127.0.0.1:3210` (this project's self-hosted local backend), never
`rugged-bird-156` or any other cloud deployment. Gemini: **0** - the
`GEMINI_API_KEY`/`GROQ_API_KEY`/`CLERK_WEBHOOK_SECRET` env vars required for
this local deployment's push validation were set to inert placeholder
strings (`"unused-placeholder-phase5-lexical-proof"`), not real credentials,
so even an accidental call into a Gemini-touching code path would fail
authentication rather than succeed - on top of the structural guarantee
that this phase's code never calls one. Pinecone / Neon: **0** (no
integration touched).

## 6. What Phase 5 does not yet claim

No dense/semantic search, no embeddings, no Pinecone integration, no
retrieval-quality (precision/recall) evaluation, no hybrid fusion. This is a
lexical-layer capacity/feasibility proof only. Phase 6 (Gemini embedding
workload/cost report - a report, not real embedding) and any real Pinecone
work remain unstarted and require their own separate authorization.
