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

## 7. Follow-up (2026-08-29): §31/§32 gaps closed

The original proof above measured storage and ran 5 natural-language
queries, but never computed the mandate's required 2x/3x projection (§31)
or tested exact-term categories specifically (§32: course codes, acronyms,
department names) rather than natural-language phrases. Both closed here,
against the same restarted local deployment (`http://127.0.0.1:3210`,
containers were stopped between sessions - `docker start
convex-self-hosted-backend-1 convex-self-hosted-dashboard-1`, zero cloud
calls either way).

### 7.1 Storage projection - corrected methodology

**First attempt was wrong and has been replaced, not just caveated.** The
first pass measured 474MB via `du` on the Docker volume
(`/convex/data`) and compared it directly to the 276MB Convex-Cloud-billed
figure that caused the prior `adamant-stork-623` outage. Both problems were
real: (1) 474MB is a *filesystem* measurement - it includes WAL, uncompacted
SQLite pages, and search-index build scratch specific to this self-hosted
Docker/SQLite backend, not comparable in kind to any cloud billing metric;
(2) 276MB was Convex Cloud's own billed-storage number for a *differently
composed* corpus (one that included dense vectors and `@convex-dev/rag`
component state, not just lexical text) - comparing the two treated
unrelated metrics as if they measured the same thing. That comparison has
been removed, not kept as a footnote.

**Corrected measurement: real logical content bytes**, summed directly from
the source artifacts for exactly the fields the lexical schema stores
(`crawledChunks.text/headingPath/contentHash/chunkKey/documentId/ragId` and
`documents.url/title/status/contentType`), UTF-8 byte length, no filesystem
or index overhead included:

```text
crawledChunks content (44,792 rows): 259,002,008 bytes (247.0 MB)
documents content (1,891 rows):          328,004 bytes (0.3 MB)
TOTAL content bytes (1x, MEASURED_LOCAL):            247.3 MB

2x DERIVED linear projection:  494.6 MB (0.48 GB)
3x DERIVED linear projection:  741.9 MB (0.72 GB)
```

This is a **lower bound**, not a prediction of actual Convex storage (local
or cloud): it excludes the search index itself (a separate tokenized
structure over `text`), document versioning, and Convex's internal system
fields/storage format, all of which add unknown but nonzero overhead. The
474MB `du` figure is kept here only as a data point - roughly 1.9x this
content-bytes total - but that ratio reflects self-hosted Docker/SQLite
storage mechanics specifically (WAL, page fragmentation) and must not be
used as a stand-in for Convex Cloud's own overhead ratio, which is
unmeasured.

**No valid number-to-number comparison to the prior 276MB outage figure
exists** - that would repeat the same category error from the other
direction. The honest, self-contained read instead: 247.3MB of content
*alone*, with zero index overhead added, is already roughly half of the
~0.5GB free-tier ceiling the prior outage was measured against, at 1x
scale, today. The 2x projection (494.6MB of content alone, before any index
overhead) would already reach that ceiling. This does not require the old
outage's number to be a valid comparison point - it holds on the corrected
figure by itself. Per mandate §31:

```text
CONVEX_LEXICAL_CAPACITY_RISK: RECORDED (on the corrected content-bytes
basis, not the original flawed du-vs-cloud-billing comparison)
```

Not re-attempting a cloud deployment to get a real cloud-storage number -
that would itself be exactly the kind of cloud probing this phase exists to
avoid. This risk carries forward as an open input to the architecture
decision rather than a blocking failure of Phase 5 itself (Phase 5's own
scope was feasibility/search-correctness, which still holds - see §7.2).

### 7.2 Exact-term query results

8 queries, terms pulled from the real corpus (`all_chunks.jsonl` scan for
course-code and acronym patterns), not invented. Script:
`exact_term_queries.py` in this directory; raw output: `exact_term_run.log`.

Hit counts (of 3) are EXECUTED/MEASURED - the index either returned rows or
it didn't. The relevance column below is HEURISTIC per mandate §47: my own
read of a 70-char text preview per query, not a verified or labeled
judgment. Treat it as a directional signal, not evidence of the same grade
as the hit counts.

```text
category      query                    hits(of 3)  top-hit relevance (HEURISTIC)
course code   CS-09                    3           WEAK - top hit is a
                                                    budget PDF, not a course
                                                    listing; token match,
                                                    not semantic
course code   ECAT-2026                3           STRONG - top hit is the
                                                    actual admissions/ECAT
                                                    page
course code   ME-106                   3           WEAK - top hit is a
                                                    conference-proceedings
                                                    PDF, coincidental match
acronym       HEC                      3           PLAUSIBLE - Research &
                                                    Publications page
acronym       CGPA                     3           PLAUSIBLE - a
                                                    registration/education-
                                                    details form
acronym       NUST                     3           PLAUSIBLE - prospectus
                                                    page (cross-reference)
department    "Electrical Engineering" 3           WEAK - top hit is a
                                                    Telecommunication dept
                                                    postgraduate page
program code  "BS Software Engineering" 3          WEAK - IDENTICAL top hit
                                                    to the query above
```

**Real finding, not a test artifact.** The two multi-word phrase queries
return the exact same top result, which is relevant to neither query as
phrased. This is confirmed-expected behavior for Convex's search index, not
a bug in this test: the project's own `convex/_generated/ai/guidelines.md`
(§"Full text search guidelines") describes `withSearchIndex` as finding
results that "best match" the query terms - a relevance-ranked bag-of-words
search, not phrase-exact matching. In a corpus this size, "Engineering" is
common enough (an engineering university's site) that it dominates ranking
for any query containing it, regardless of the other terms present.

**Consequence for §32 ("do not substitute Python BM25 for production Convex
behavior")**: this result *is* real production Convex behavior, measured
directly - and it shows single rare tokens (a specific admissions code,
specific acronyms) are what this index is actually good at; multi-word
department/program-name phrases need either a narrower query construction
(e.g. an `.eq()` filter alongside the search term, per the guidelines
example) or should not be assumed to return phrase-precise results from
lexical search alone. This is exactly the kind of gap the composite
dense+lexical architecture (`compositeStore.ts`) exists to cover with the
dense side - it should not be treated as a lexical-layer defect to fix in
isolation.

### 7.3 Updated Phase 5 verdict

```text
SEARCH CORRECTNESS:     single-token exact identifiers - mostly good
                        (4/6 strong-to-plausible, 2/6 coincidental token
                        matches); multi-word phrases - NOT phrase-precise,
                        confirmed as expected Convex search-index behavior,
                        not a bug
STORAGE PROJECTION:     1x/2x/3x computed on corrected content-bytes basis
                        (§7.1, 247.3/494.6/741.9 MB - not the original
                        flawed du-vs-cloud-billing comparison); CONVEX_
                        LEXICAL_CAPACITY_RISK recorded per §31 - content
                        bytes alone, before any index overhead, already use
                        roughly half a typical ~0.5GB free tier at 1x and
                        would reach it at 2x
OVERALL:                Phase 5's original scope (can Convex hold and
                        search the full corpus locally) still holds. The
                        capacity risk and the phrase-query limitation are
                        both now explicit, documented inputs to the
                        Pinecone-dense-first architecture decision, not
                        silently discovered later.
```
