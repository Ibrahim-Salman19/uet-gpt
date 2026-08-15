# UETGPT — Market-Wide RAG Storage Architecture Screen (2026-08)

**Authoritative machine-readable sources: [`requirements.json`](./requirements.json),
[`candidates.json`](./candidates.json), [`evidence.json`](./evidence.json),
[`hard-gate-matrix.csv`](./hard-gate-matrix.csv), [`shortlist.json`](./shortlist.json).** This
document narrates them for a human reader; if it ever disagrees with those files, they win.

## Why this exists

UETGPT rejected two vector-store candidates one at a time — Turso, then Zilliz Cloud Free — each
time discovering a disqualifying limitation only *after* building a real adapter and running a full
benchmark. Before writing a third adapter, this screen does the evidence-driven elimination pass
across the realistic market that should have come first: specialist vector databases, general
databases with vector capability, search platforms, and (conceptually) self-hosted options, using
only hard facts from current official sources. The goal was to narrow to at most two finalists
*before* any more adapter code gets written — and, just as importantly, to record every candidate
that didn't make it and why, so no future session rediscovers the same dead end.

## Scope discipline

No adapter code was written. No credentials were used. No accounts were created. No production code
path was touched. `KNOWLEDGE_STORE_BACKEND` still defaults to `convex`. This is a research and
evidence-recording exercise only — see the `next_phase_execution_order` block in
[`shortlist.json`](./shortlist.json) for what happens next, which requires separate authorization.

## Requirements, frozen before research

Every requirement was classified `HARD_GATE` (any single failure eliminates a candidate — no amount
of scoring compensates), `PREFERENCE` (used only after hard-gate survivors are known), `BENCHMARK_GATE`
(applies only to actual finalists, not executed in this phase), or `INFORMATIONAL` (recorded, never
decisive). Full text in [`requirements.json`](./requirements.json). The nine hard gates: permanent
$0 cost, capacity with growth headroom, idle durability, no surprise billing, 768-dimension vector
support, CRUD semantics matching the real `KnowledgeStore` interface, a credible concurrency
invariant (not literally "must expose compare-and-swap" — the actual requirement is that a stale
ingestion generation must never become authoritative after a newer one commits), runtime
compatibility with a Convex action, and credential safety. These were not loosened after seeing
results.

## Market coverage

26 candidates total: 23 researched this session, plus Turso, Zilliz, and Pinecone carried in from
prior sessions and scored in this exact same comparison — Pinecone in particular was initially,
wrongly, left out of this screen merely because it predated this session's research batch; that was
corrected mid-analysis and it is scored on identical terms to everything else here.

Coverage came from two tracks: named-vendor research across five parallel clusters (specialist vector
databases, general databases with vector capability, search platforms), and an open-discovery pass
using ~30+ queries across two independent search backends (Google-backed web search and Exa semantic
search) specifically hunting for new or overlooked 2025–2026 entrants. Every load-bearing claim was
checked against the vendor's own official page, not aggregator sites — which mattered: aggregators
were caught being flatly wrong about Meilisearch's and Vectara's free-tier status, and about
Vectroid's actual inactivity policy (its own marketing blog said "free forever, no catch," while its
own Terms of Service has an explicit 60-day deletion clause). This is not claimed as exhaustive — a
brand-new, unindexed launch could be missed — and ~13 further names surfaced during discovery but
were not individually screened (Neo4j AuraDB, ArangoDB Oasis, YugabyteDB, KDB.AI, Oracle 23ai,
MotherDuck, Firestore, MemoryDB, ParadeDB, Marqo, Deep Lake, and several smaller pgvector-hosting
clouds) — named here for transparency about where the search stopped, not as a claim about their
merit. Full detail in [`candidates.json`](./candidates.json).

## Methodology: a correction happened mid-screen

A first synthesis pass was too generous — several candidates were marked an unqualified "PASS" when
the underlying evidence really only supported "suggestive, not confirmed." A stricter standard was
then applied throughout: **a candidate is only PASS when every required hard-gate fact actually has
adequate evidence.** A single unresolved fact keeps a candidate at `UNKNOWN`/`CONDITIONAL`, no matter
how favorable everything else looks. Three narrow, targeted follow-up research passes were dispatched
to close the remaining specific gaps (not a return to broad discovery). All three failed partway
through on a session usage limit. Direct fetches were tried in their place afterward: one question
(Pinecone's distance-metric support) resolved cleanly this way; a second (LambdaDB being in public
preview) survived as a partial finding from the failed agent before it was cut off; the rest —
Weaviate's usage-based-suspension policy and Lantern's storage cap — remain genuinely `UNKNOWN`,
blocked on an exhausted session web-search budget rather than on the vendors' own documentation
being conclusively silent. That is reported here as the honest, final state, not smoothed over.

## The dominant failure mode

Of 19 clean fails this session (21 including Turso and Zilliz from prior sessions), **11 failed
specifically because of an idle/inactivity policy** — auto-suspend, auto-pause, or outright deletion
after a period of no traffic, ranging from Astra DB's severe 48-hour hibernation trigger to Qdrant's
1-week-suspend/4-week-delete pattern to Redis Cloud Free's unrecoverable 14-day deletion (worse than
Zilliz — no backup, no resume, gone). This single failure mode is the clearest justification for
having done this market screen before writing another adapter: it would very plausibly have struck
again with a fourth candidate picked ad hoc.

## Hard-gate matrix (condensed — full detail in [`hard-gate-matrix.csv`](./hard-gate-matrix.csv))

| Provider | Overall result |
|---|---|
| Pinecone Starter | **SCREENING_PASS / BENCHMARK_PENDING / PRODUCTION_NOT_APPROVED** |
| Neon (Postgres+pgvector) | **SCREENING_PASS_WITH_CAPACITY_RISK / BENCHMARK_PENDING** |
| Weaviate Cloud | UNKNOWN/CONDITIONAL — idle-suspension evidence genuinely unresolved |
| LambdaDB | UNKNOWN/CONDITIONAL — whole product in public preview; gates 5-10 unresearched |
| Lantern Cloud | UNKNOWN/CONDITIONAL — storage cap genuinely unpublished |
| TiDB Cloud (Starter) | CONDITIONAL — vendor's own docs call vector search "experimental...not recommended for production" |
| Cloudflare Vectorize | Soft-fail at strict $0 — 317% of free quota, resolves at ~$5/mo flat |
| LanceDB Cloud | FAIL — no post-GA free-tier commitment |
| Vectroid | FAIL — ToS has a 60-day deletion clause contradicting its own marketing |
| Upstash Vector | FAIL — ToS mandates deletion after 1 week idle |
| Qdrant Cloud | FAIL — suspend at 1 week, delete at 4 weeks |
| Chroma Cloud | FAIL — one-time $5 credit, not a standing tier |
| Redis Cloud Free | FAIL — 30MB cap, plus 14-day unrecoverable deletion |
| Typesense Cloud | FAIL — one-time non-replenishing trial |
| Supabase | FAIL — 7-day auto-pause, manual resume |
| MongoDB Atlas M0 | FAIL — 30-day auto-pause; vendor says M0 is testing-only |
| DataStax Astra DB | FAIL — worst idle policy of the study (48hr hibernate, 30-day delete) |
| Couchbase Capella | FAIL — deleted after 30 days |
| Algolia | FAIL — vector search is enterprise-only |
| Elastic Cloud (managed) | FAIL — 14-day trial, card required |
| AWS OpenSearch Service | FAIL — 12-months-only, not permanent |
| AWS OpenSearch Serverless | FAIL — no free tier at all |
| Aiven OpenSearch | FAIL — manual resume, minutes-to-hours |
| Bonsai | FAIL — no current permanent free plan |
| Turso Cloud / libSQL *(prior session)* | FAIL — DiskANN recall + build-reliability at full scale |
| Zilliz Cloud Free *(prior session)* | FAIL — operational availability under realistic inactivity |

**Recomputed counts, verified against the matrix row count directly**: 1 clean `SCREENING_PASS`
(Pinecone), 4 `UNKNOWN`/`CONDITIONAL` pending resolution (Neon's growth headroom only; Weaviate;
LambdaDB; Lantern), 1 vendor-flagged `CONDITIONAL` (TiDB), 1 soft-fail (Cloudflare Vectorize), 19
clean `FAIL`. 26 total.

## Architectures compared, not just vendor names

The screen deliberately compared designs, not brand names — the same vendor can produce more than one
viable architecture with materially different tradeoffs:

1. **Neon PostgreSQL + pgvector + PostgreSQL FTS** (all dense+lexical inside Neon) — weaker than
   variant 2 on the same 500MB cap, since it also carries a full lexical index.
2. **Neon pgvector dense + Convex lexical** (split) — the shortlisted Neon variant.
3. **Pinecone OnDemand dense + Convex lexical** — the shortlisted Pinecone variant, and the specific
   architecture flagged for re-inclusion in this screen: Pinecone's immature full-text/BM25 API is
   irrelevant to it, since this design only ever calls the GA dense vector API.
4. **Weaviate dense + BM25** (all-in-one, native hybrid) — provisional only, pending its unresolved
   idle-gate evidence.

## Shortlist

Full reasoning in [`shortlist.json`](./shortlist.json). In brief:

**#1 — Pinecone OnDemand dense + Convex lexical — `SCREENING_PASS / BENCHMARK_PENDING /
PRODUCTION_NOT_APPROVED`.** Every named hard gate resolves with strong, current, official, multi-
source evidence: the most rigorously evidenced idle-durability result of the whole study (positive
vendor citations, not silence), the largest capacity margin of any candidate (2GB free vs ~63MB raw
payload), fails-closed billing, and a confirmed cosine-compatible dense API available on Starter with
no tier restriction. The remaining open items — a generation-scoped-ID concurrency protocol and a
write-visibility/consistency mechanism — were already designed in detail in a prior session's mandate
but never built or tested; that is scoped implementation work, not an open research question.

**#2 — Neon pgvector dense + Convex lexical — `SCREENING_PASS_WITH_CAPACITY_RISK /
BENCHMARK_PENDING`.** Built on the most battle-tested technology studied (pgvector, production use
since 2021), with a genuinely automatic, sub-second, years-proven scale-to-zero and real ACID
transactions — the strongest native answer to the concurrency invariant of anything researched. Its
one real gap: growth headroom past 1× corpus scale rests on a community heuristic, not a confirmed
number, and stays honestly `UNKNOWN` rather than forced to a false-precision answer. The gap is
narrow and likely resolvable by direct measurement early in implementation, which is why it's ranked
#2 rather than excluded.

**Both finalists converge on the same shape** — an external store holding dense vectors only, Convex
keeping the existing lexical/canonical layer — rather than an all-in-one vendor. Every all-in-one
candidate studied (Weaviate, TiDB, the Neon-with-FTS variant) carries either an unresolved hard gate
or a vendor-flagged maturity concern that this split shape avoids.

**Not promoted, with reasons preserved rather than dropped**: Weaviate (idle-gate genuinely unknown,
blocked on exhausted search budget, not vendor silence), LambdaDB (confirmed public-preview product),
Lantern (capacity gate unresolved), TiDB (vendor-flagged experimental feature), Cloudflare Vectorize
(soft-fails strict $0), LanceDB Cloud (no committed post-beta pricing).

## What's next

Not started — requires separate authorization. When it begins: freeze the real Convex baseline first
by running `scripts/stage_e_retrieval_eval.py` to completion (it already exists and has never been
run to a completed baseline); then implement and benchmark Pinecone dense + Convex lexical; only if
Pinecone fails an established gate, proceed to Neon; never both at once; never a third provider
without a fresh, explicit decision.
