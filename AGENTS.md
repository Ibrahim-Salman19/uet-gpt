# AGENTS.md — UET Taxila RAG Pipeline
# ─────────────────────────────────────────────────────────────────────────────
# Version: 15.1 (2026-06-06) — All §21 architectural caveats resolved.
# Platform: Google Antigravity 2.0 (agy CLI)
# This file is prepended to EVERY prompt the agent processes in this project.
# Keep it under 200 lines — every byte here costs tokens on every run.
# Companion file: CRONJOB.md (the full hourly operational protocol)
# ─────────────────────────────────────────────────────────────────────────────

## Project Identity
UET Taxila GPT — autonomous RAG pipeline maintenance agent.
Stack: Python crawler (curl_cffi, trafilatura) → Convex webhooks →
TypeScript chunker (chunkMarkdown) → vector embeddings → @convex-dev/agent.

## Directory Map
```
scripts/
  crawler.py            ← async BFS crawler
  ingest_pdf.py         ← pymupdf4llm primary, Gemini VLM fallback
  crawl_config.json     ← single source of truth for seed URLs
src/lib/
  prompt.ts             ← shared buildSystemPrompt/extractText (used by route.ts + tests)
  rate-limit.ts         ← tiered rate limiter (10/50/200 req/hr for anon/user/admin)
  llm-models.ts         ← LLM_FALLBACK_CHAIN (single source of truth for model IDs)
convex/
  clerk/
    webhook.ts          ← Clerk user webhook HTTP action (header-based auth)
  crawl/
    webhook.ts          ← ingest endpoint + chunkMarkdown()
    actions.ts          ← embedSingleChunk + query handler
    queries.ts          ← full-text search
    jobs.ts             ← scheduled freshness nightly job
  rag/
    retrieval.ts        ← RRF + reranking + anti-hallucination
  schema.ts             ← DATABASE SCHEMA
scripts/eval/
  golden_set.jsonl      ← 50-pair evaluation dataset (verified by wc -l)
  run_eval.py           ← evaluation harness
.agent/
  state.md              ← hot state (<4KB), read and written every run
  progress_log.md       ← append-only run history
  incident_log.md       ← regressions and crashes only
```

## Architecture Source of Truth
`architecture.md` is the single source of truth for this system.
Read it fully before implementing any task. Update it before every run ends.
A change not documented in architecture.md did not happen.

## Skill Files
Before writing code for any task, scan `.agents/skills/` and
`~/.gemini/antigravity-cli/skills/` and read every relevant SKILL.md.
Skills encode environment constraints not available in training data.
Never skip this step even for simple tasks.

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

## Coding Standards
- Python: type hints on all signatures, docstrings on public functions
- TypeScript: strict mode, no `any`, explicit return types on exports
- Conventional commit format: `type(scope): description`
- Tests: run `python scripts/eval/run_eval.py` after every pipeline change
- No print debugging in commits — use logger, not stdout

## Build Commands
```bash
# Python dependency install
pip install -r scripts/requirements.txt --break-system-packages

# Run crawler
python scripts/crawler.py --seed https://www.uettaxila.edu.pk

# Ingest a PDF
python scripts/ingest_pdf.py path/to/file.pdf

# Run full eval harness
python scripts/eval/run_eval.py --golden scripts/eval/golden_set.jsonl

# Run all tests
npx vitest run

# Run specific test file
npx vitest run tests/integration/chat-api.test.ts

# Convex dev + deploy
npx convex dev
npx convex deploy
```

## Quality Gate (must pass before any commit)
1. `npx convex dev --dry-run` → zero TypeScript errors
2. `python -m py_compile scripts/*.py` → zero syntax errors
3. `python scripts/eval/run_eval.py` → recall_at_5 not regressed vs last run
4. `npx vitest run` → all tests pass
5. `architecture.md §21` — verify no new open bugs introduced
