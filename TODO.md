# TODO.md — UET Taxila RAG Pipeline
# Format: - [STATUS] TASK-NNN: Name | P0-P3 | Depends: NNN
# STATUS: [ ] pending | [WIP] in progress | [DONE: date] | [BLOCKED: reason]

## P0 — Prerequisites
- [DONE: 2026-05-30] TASK-000: Build eval harness (golden_set.jsonl 50 pairs + run_eval.py) | P0

## P1 — Security (before any feature work) — ALL COMPLETE ✅
- [DONE: 2026-05-30] TASK-S01: PDF metadata sanitization + injection pattern blocklist | P1
- [DONE: 2026-05-30] TASK-S02: Convex rate-limiter (10msg/min/user, 100k tokens/min global) | P1
- [DONE: 2026-05-30] TASK-S03: Pre-retrieval query injection scanner in retrieval.ts | P1
- [DONE: 2026-05-30] TASK-S04: Source domain allowlist in webhook.ts (*.uettaxila.edu.pk only) | P1

## P2 — Critical bug fixes — ALL COMPLETE ✅
- [DONE: 2026-05-30] TASK-B01: RRF k already 60 in search.ts — confirmed correct | P2
- [DONE: 2026-05-30] TASK-B02: Semantic cache threshold already 0.92 in constants.ts — confirmed | P2
- [DONE: 2026-05-30] TASK-B03: Cache TTL matching freshnessTier (high=7d, medium=2d, low=1d) | P2
- [DONE: 2026-05-30] TASK-B04: Add decay floor Math.max(0.20, ...) to exponential decay | P2

## P3 — Pipeline enhancements (ordered by impact/effort)
- [DONE: 2026-05-30] TASK-E01: maxChunkSize confirmed 3000 + raised prose overlap 200→300 chars | P3
- [DONE: 2026-05-30] TASK-E02: Hybrid search via hybridRank (vector + BM25, k=20 fused → 8) | P3 | Depends: E01
- [DONE: 2026-05-30] TASK-E03: FlashRank reranker k=8→4 via cross-encoder/ms-marco-MiniLM-L-6-v2 | P3 | Depends: E02
- [DONE: 2026-05-30] TASK-E04: flagExpiredDocuments already implemented (high=30d, medium=90d, low=180d) — confirmed | P3
- [DONE: 2026-05-30] TASK-E05: Anti-hallucination 3-tier confidence system (<0.2 refuse, 0.2-0.4 hedge, 0.4-0.6 cite) | P3
- [ ] TASK-E06: Parent-child chunking (child 200tok embed, parent 1500tok return) | P3 | Depends: E01
- [ ] TASK-E07: Gemini VLM verification pass + retry on table structure failure | P3 | Depends: 000
- [ ] TASK-E08: Roman Urdu pre-query translation via Gemini 3.5 Flash | P3 | Depends: E02
- [ ] TASK-E09: Contextual embeddings at ingestion time (Gemini context sentence) | P3 | Depends: E06
- [ ] TASK-E10: HyDE query enhancement for queries < 15 words | P3 | Depends: E02

## Next Run Priority
- TASK-E06: Parent-child chunking (unlocks E09)
- TASK-E07: Gemini VLM verification pass
- TASK-E08: Roman Urdu pre-query translation via Gemini 3.5 Flash
