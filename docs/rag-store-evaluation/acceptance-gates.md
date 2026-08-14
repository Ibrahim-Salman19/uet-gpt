# UETGPT KnowledgeStore Acceptance Gates

**Authoritative machine-readable source: [`acceptance-gates.json`](./acceptance-gates.json).** This
document narrates it; if the two ever disagree, the JSON wins.

## Where these gates came from

These are the *original* acceptance gates, established before the Turso and Zilliz benchmark
results were known — not gates invented after the fact to justify a result. The original mandate
document that defined them was never saved to a durable location in this repository; it existed
only in conversation history. It was recovered on 2026-08-15 by grepping this session's own JSONL
transcript for its numbered sections (31-36), verbatim, not reconstructed from memory or paraphrase.
Recovery was partial: sections 32-35 (the gates themselves, the Zilliz fallback trigger, the
Pinecone/Upstash guidance, and the self-hosted fallback) came back in full. Section 31's authority
statement came back only as a tail fragment, and section 36 (test architecture) cuts off mid-list.
None of the ten gate criteria are missing or ambiguous — only surrounding narrative text is
incomplete, and a newer, more detailed mandate (2026-08-15) independently re-specifies an
equivalent-or-stricter version of what's missing from section 36.

## The gates

A candidate backend must clear all of the following. None were loosened for Turso, Zilliz, or
Pinecone.

| Gate | Requirement |
|---|---|
| Integrity | 0 duplicate logical chunk IDs, 0 cross-document collisions, 0 unexplained orphans, 0 stale deleted-document chunks, 0 stale FTS entries, ledger matches |
| Idempotency | Identical replay ingestion → 0 logical row growth (bounded physical overhead only) |
| Dense ANN recall | Recall@10 ≥ 0.98 vs. exact cosine ground truth, declared *before* results are seen |
| Lexical retrieval | No unexplained regressions on authoritative exact-term cases |
| End-to-end retrieval | No material regression vs. baseline; tolerance fixed in advance |
| Storage | Fits free tier with *meaningful* headroom (not a bare fit) |
| Usage | Projected read/write traffic has substantial headroom |
| Reliability | Lifecycle torture tests pass in full |
| Operational | Viable for an occasionally-idle production service; synthetic keep-warm traffic is not an allowed workaround for a vendor's inactivity policy |
| Types | `npx tsc --noEmit` (repo script: `npm run typecheck`) exits 0, run to completion, never wrapped in a timeout that could produce a false pass |
| Tests | Relevant scoped tests pass; unrelated failures are documented, not hidden |
| Evidence | Every conclusion must be independently auditable by someone with no access to this conversation |

## Fallback sequence (verbatim, section 33-35)

> If Turso fails a HARD acceptance gate, do not manipulate the benchmark until Turso "wins." Mark
> TURSO REJECTED for that configuration. Then implement the same `KnowledgeStore` contract against
> Zilliz Cloud... Account explicitly for Free-cluster inactivity suspension. Do not create
> artificial periodic traffic merely to evade a provider's inactivity policy unless: (1) provider
> policy clearly permits it; and (2) the user explicitly approves it.
>
> Do not expand scope to every database unless Turso and Zilliz both fail. Pinecone may become more
> attractive if its current full-text API has reached GA... If investigated, verify their current
> live product capability rather than relying on marketing copy or stale documentation.
>
> If managed $0 services cannot satisfy the required lifecycle and capacity: evaluate Convex →
> app/realtime state, self-hosted Qdrant → knowledge corpus, only if a reliable, already-available
> $0 hosting machine exists. Do not assume a VPS is free.

This is exactly the sequence that has since played out: Turso rejected (see
[`turso/verdict.json`](./turso/verdict.json)), Zilliz rejected (see
[`zilliz/verdict.json`](./zilliz/verdict.json)), Pinecone now under evaluation (see
[`pinecone/`](./pinecone/)).

## Non-negotiable authority statement (verbatim tail, section 31)

> ...5. verify ingestion correctness, lifecycle safety, retrieval quality, latency and storage;
> 6. reject Turso if it does not meet the predetermined acceptance gates; 7. use Zilliz Cloud as the
> next benchmark candidate if Turso fails; 8. leave an extremely simple rollback path; 9. produce
> reproducible evidence for an independent Agent B audit.
>
> **You are an implementer, not the final release authority.** Even if every test passes, you MUST
> NOT self-certify the system as "production ready." Agent B will independently audit the exact
> commit SHA and evidence [...].
>
> Long-term target: Convex → application state, Turso → canonical rebuildable knowledge state, not
> two permanent authoritative corpus stores.

The long-term target names Turso specifically because it was the candidate under evaluation when
this text was written. Turso has since been rejected on its own merits. The underlying,
vendor-neutral principle survives unchanged: Convex owns application/realtime state; a separate,
rebuildable store owns the bulk knowledge corpus. That principle is what every subsequent
candidate — Zilliz, then Pinecone — is measured against.
