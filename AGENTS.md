# AGENTS.md - UET Taxila RAG Pipeline
Companion file: CRONJOB.md (full hourly operational protocol)

## Table of Contents
1. Project Identity (line 12)
2. Absolute Forbidden Operations (line 16)
3. Quality Gate (line 32)
4. Key Build Commands (line 39)
5. Critical Files (line 56)
6. Coding Standards (line 84)

## Project Identity
UET Taxila GPT - autonomous RAG pipeline maintenance agent.
Stack: Python crawler (curl_cffi, trafilatura) → Convex webhooks →
TypeScript chunker (chunkMarkdown) → vector embeddings → @convex-dev/agent.

## Absolute Forbidden Operations (never violate, ever)
- `convex/schema.ts` filter field names on vector indexes → changing them
  corrupts the live vector index and requires a full ($$$) re-embed
- HMAC auth guard in `webhook.ts` → the timestamp + signature check block
- `embeddingDimension` in any RAG config → dimension mismatch silently
  breaks all similarity scores pipeline-wide
- Synchronous embedding inside the HTTP webhook handler → hits Convex 1MB limit
- `git push --force` → never
- `git add -A` → never (use explicit file paths or `git add -p`)
- Commits directly to `main` or `master` → always use `agent/YYYY-MM-DD`

## Quality Gate (must pass before any commit)
1. `pnpm typecheck` → zero TypeScript errors
2. `python -m py_compile scripts/*.py` → zero syntax errors
3. `python scripts/eval/run_eval.py` → recall_at_5 not regressed vs last run
4. `pnpm vitest run` → all tests pass

## Key Build Commands
```
pnpm typecheck                              # TypeScript check
pnpm vitest run                             # All tests
pnpm convex dev                             # Local Convex devserver
python scripts/eval/run_eval.py             # Eval harness (recall_at_5)
```
> pnpm is the ONLY supported package manager. Never use npm/yarn/bun -
> see architecture.md §17 for breakage details. Enable with `corepack enable`.

## Critical Files
High-frequency edit targets. Full directory map: architecture.md §3.

```
convex/
  schema.ts             ← DATABASE SCHEMA (all tables + indexes)
  crons.ts              ← cron definitions (cleanup, DLQ retry)
  auth.ts               ← permission matrix + requireAuth/requireAdmin
  http.ts               ← HTTP router + CORS config
  clerk/webhook.ts      ← Clerk user webhook HTTP action
  crawl/
    webhook.ts          ← ingest endpoint + HMAC auth + chunkMarkdown()
    chunking.ts         ← markdown chunking + freshness tier assignment
    mutations.ts        ← document/chunk lifecycle mutations + DLQ retry
    actions.ts          ← Crawl4AI fetch + sitemap parsing + RAG upsert
  rag/
    retrieval.ts        ← RRF + reranking + CRAG + anti-hallucination pipeline
    prompts.ts          ← SYSTEM_PROMPT + FEW_SHOT_EXAMPLES
    context.ts          ← Sandwich Strategy context builder
    routing.ts          ← intent classification + query routing
    crag.ts             ← CRAG LLM judge (Groq) for low-confidence results
  embeddings/
    generate.ts         ← Gemini embedding-2 with multi-key rotation
    search.ts           ← hybrid vector + BM25 + FAQ search with RRF fusion
    contextualize.ts    ← chunk context enrichment via LLM
  reranking/
    rerank.ts           ← multi-tier reranker (external → Groq → word overlap)
src/lib/
  prompt.ts             ← shared buildSystemPrompt/extractText + injection fence
  chat/pipeline.ts      ← Next.js chat API route orchestration
scripts/
  crawler.py            ← async BFS crawler with SSRF hardening
  eval/run_eval.py      ← evaluation harness
  crawl_config.json     ← single source of truth for seed URLs
```

## Coding Standards
- Python: type hints on all signatures, docstrings on public functions.
  TypeScript: strict mode, no `any`, explicit return types on exports.
- Run `python scripts/eval/run_eval.py` after every pipeline change.
- Conventional commit format: `type(scope): description`.
- No print debugging - use logger, not stdout.
