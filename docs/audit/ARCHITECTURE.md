# UET Taxila Chatbot — Architecture (Actual Flow, Snapshot 2026-07-26)

Reference: `docs/audit/SNAPSHOT_20260726T094113Z.json`. This documents what the code actually does, not aspirations.

> **Note (2026-09-10):** this is a point-in-time snapshot, kept as-is for historical accuracy —
> not re-diagrammed here. Some of the "DEAD"/"DYING" model callouts below are now stale: as of
> September 2026 the contextualizer runs `gemini-3.5-flash-lite` (not the dead `gemini-2.0-flash`
> shown below) and the dying Groq Llama models have been replaced by `openai/gpt-oss-20b` /
> `openai/gpt-oss-120b`. A follow-up snapshot audit would be needed to re-verify the rest of this
> diagram against current code; a September 2026 retrieval-pipeline audit found other drift
> between docs and code — see `docs/rag-verification/final-production-verdict.md`'s correction
> section.

## Discovery → Answer pipeline

```
                           ┌─────────────────────────────────────────────┐
                           │  PATH A (LIVE): Python crawler               │
  seeds in crawl_config    │  scripts/crawler.py                          │
  .json (3 UET subdomains  │  curl_cffi (chrome impersonation)            │
  + 23 sections +          │  → robots.txt respected (rp.can_fetch)       │
  deptfaculty 1-25)        │  → SSRF hardening (is_safe_host, safe_get    │
         │                 │     walks redirects, public-IP check)        │
         ▼                 │  → AIMD rate limiter + token bucket           │
  BFS link extraction      │  → SimHash near-dup dedup (Hamming ≤8)       │
  (BeautifulSoup/lxml) +   │  → trafilatura HTML→markdown (favor_recall)  │
  sitemap.xml discovery    │  → pymupdf4llm PDF→markdown (table_strategy) │
  (no sitemap exists;      │  → minWordCount=80 filter                    │
  BFS only)                │  POST /ingest  (Bearer CONVEX_AUTH_TOKEN)    │
                           └──────────────────────┬──────────────────────┘
                                                  │
                           ┌──────────────────────▼──────────────────────┐
                           │  PATH B (DISABLED): Crawl4AI                 │
                           │  convex/crawl/actions.ts executeCrawlJob     │
                           │  → HMAC-signed → external Crawl4AI container │
                           │  → webhook back to /api/webhook/crawl        │
                           │  CRON COMMENTED OUT (crons.ts:6-12)          │
                           │  Container not deployed                      │
                           └──────────────────────┬──────────────────────┘
                                                  │ (both paths funnel here)
                  ┌───────────────────────────────▼──────────────────────────────┐
                  │  convex/crawl/webhook.ts                                     │
                  │  ingestWebhook (Path A) / crawlWebhook (Path B, HMAC)        │
                  │  → domain allowlist + payload cap (4 MiB / 10 MiB)           │
                  │  → normalizeContent, generateContextSummary (gemini-2.5-fla) │
                  │  → generateChunks: parent 3000/300, child 800/100            │
                  │     (chunking.ts — header/sentence/table-aware)              │
                  │  → assignFreshnessTier (HIGH/MEDIUM/LOW by URL keyword)      │
                  │  → queueChunksForEmbedding (ASYNC — AGENTS.md compliant)     │
                  └───────────────────────────────┬──────────────────────────────┘
                                                  │
                  ┌───────────────────────────────▼──────────────────────────────┐
                  │  convex/crawl/actions.ts embedSingleChunk                     │
                  │  → embeds "Section: <headingPath>\n\n<chunkText>"             │
                  │    (NOTE: contextualizedText NOT in embed string)             │
                  │  → rag.add(filterValues: category=crawled, source=<host>)     │
                  │  → saveEmbedding (crawledChunks.embeddingModel=gemini-emb-2) │
                  │  → scheduler.runAfter(0, contextualizeNewChunk)              │
                  └────────────────┬──────────────────────────────┬──────────────┘
                                   │                              │
              ┌────────────────────▼──────┐    ┌───────────────────▼────────────────┐
              │ @convex-dev/rag component │    │ convex/embeddings/contextualize.ts │
              │ vector store (opaque)     │    │ gemini-2.0-flash (DEAD 2026-06-01) │
              │ namespace "uet-global"    │    │ → crawledChunks.contextualizedText │
              │ dim 768, filters          │    │   (used at gen time via            │
              │   [category, source]      │    │    pickBestContent, NOT re-embedded)│
              └───────────────────────────┘    └────────────────────────────────────┘
                                   │
                  ╔════════════════▼═══════════════════════════════════════╗
                  ║  QUERY PATH (src/app/api/chat/route.ts)                ║
                  ║  pipeline.ts buildStreamResponse                       ║
                  ╠═════════════════════════════════════════════════════════╣
                  ║ 1. retrieveContext (convex/rag/retrieval.ts:424)       ║
                  ║    a. scanForInjection (regex blocklist, 2000 char cap)║
                  ║    b. classifyUserIntent (Groq llama-3.1-8b, DYING)    ║
                  ║       off_topic → canned redirect, skip search         ║
                  ║    c. enrichQuery: rewriteQuery + hydeQuery (parallel) ║
                  ║       HyDE pref gemini-2.5-flash, fallback Groq        ║
                  ║    d. semantic cache check                             ║
                  ║    e. searchAndRerank → searchDocumentsAction:         ║
                  ║       - vector (rag.search, limit 20)                  ║
                  ║       - BM25 #1 (crawledChunks.text, limit 20)         ║
                  ║       - BM25 #2 (chunk text, limit 10)                 ║
                  ║       - FAQ (faqs.question, top 2)                     ║
                  ║       - RRF fusion k=60, IDF-adaptive weights          ║
                  ║       - computeDecayedScore (freshness)                ║
                  ║    f. cascadeRerank topK=4:                            ║
                  ║       - Tier1 word-overlap (always)                    ║
                  ║       - Tier2 external RERANKER_URL (if set)           ║
                  ║       - Tier2b Groq llama-3.1-8b LLM rerank (DYING)    ║
                  ║       - Tier3 Cohere rerank-english-v3.0 (Eng-only)    ║
                  ║    g. CRAG if topScore<0.6 (Groq llama-3.1-8b judge)   ║
                  ║    h. buildResponseContext (Sandwich Strategy,        ║
                  ║       maxTokens 3000, top→idx0 reorder)                ║
                  ║ 2. buildSystemPrompt (src/lib/prompt.ts)               ║
                  ║    - UET Taxila identity                              ║
                  ║    - <<<UET_CONTEXT>>> injection fence                 ║
                  ║    - "answer from general knowledge" if thin (PERMISSIVE)║
                  ║    - NO current date/year injected                     ║
                  ║    (NOTE: convex/rag/prompts.ts has stricter rules but ║
                  ║     ZERO importers — dead code)                        ║
                  ║ 3. streamText (src/lib/chat/stream.ts)                 ║
                  ║    tryStreamWithFallback over 6-model chain:           ║
                  ║    1. llama-3.3-70b-versatile (Groq, DYING Aug16)      ║
                  ║    2. llama-3.1-8b-instant (Groq, DYING Aug16)         ║
                  ║    3. gemma-4-31b (Cerebras)                           ║
                  ║    4. gpt-oss-120b (Cerebras)                          ║
                  ║    5. gemini-3.5-flash-lite (Google)                   ║
                  ║    6. gemini-2.0-flash (Google, DEAD — in chain!)      ║
                  ║    temperature 0.3, maxOutputTokens 2000               ║
                  ║ 4. onFinish → cache write callback                     ║
                  ╚═════════════════════════════════════════════════════════╝
                                   │
                                   ▼
                         Text stream → user
```

## Component roles (verified)

| Component | Role | Status |
|---|---|---|
| `scripts/crawler.py` | Live crawl (Path A) | Working but last run 2026-07-14 |
| `convex/crawl/webhook.ts` `ingestWebhook` | Path A ingest, Bearer auth | Working |
| `convex/crawl/webhook.ts` `crawlWebhook` | Path B ingest, HMAC auth | Code present, path disabled |
| `convex/crawl/chunking.ts` | Hierarchical chunking + freshness tier | Working |
| `convex/crawl/actions.ts` `embedSingleChunk` | Embed + schedule contextualize | Working (embeds w/o context) |
| `convex/embeddings/contextualize.ts` | LLM context generation | **BROKEN** (gemini-2.0-flash dead) |
| `convex/embeddings/generate.ts` | gemini-embedding-2, 768-dim, key rotation | Working |
| `convex/embeddings/search.ts` | Hybrid vector+BM25+FAQ, RRF, decayed score | Working |
| `convex/rag/retrieval.ts` | Full query orchestration | Working |
| `convex/reranking/cascade.ts` | Multi-tier rerank | Working (Groq tier dying) |
| `convex/rag/crag.ts` | Corrective RAG judge | Working (Groq dying) |
| `convex/rag/faithfulness.ts` | Faithfulness judge | **UNWIRED** (documented) |
| `convex/rag/prompts.ts` | Strict system prompt + few-shot | **DEAD CODE** (zero importers) |
| `src/lib/prompt.ts` | ACTUAL live system prompt | Permissive (general-knowledge fallback) |
| `src/lib/chat/pipeline.ts` | Answer-gen orchestration | Working |
| `@convex-dev/agent` | Thread/message storage only | No `createAgent`; not used for generation |
| `convex/eval.ts` `evaluateSearch` | Eval entrypoint | **Admin-gated; harness can't auth** |

## Dead/dying dependencies (Track B/C targets)

- `gemini-2.0-flash` — DEAD 2026-06-01 — 5 sites (contextualize, ingest_pdf ×2, answer-gen fallback ×2)
- `llama-3.3-70b-versatile` — dying 2026-08-16 — 10 sites (answer-gen primary + admin UI + tests)
- `llama-3.1-8b-instant` — dying 2026-08-16 — 13 sites (intent, rewrite, HyDE-fallback, CRAG, faithfulness, groqRerank, eval-judge, multiVector)
- 6 duplicate `getGroq()` factories (consolidation target for Phase 0B-G)
