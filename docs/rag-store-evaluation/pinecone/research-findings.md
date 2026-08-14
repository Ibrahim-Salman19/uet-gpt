# Pinecone Starter — Research Findings

**Authoritative machine-readable source: [`research-findings.json`](./research-findings.json).**
Full unedited raw agent report: [`pinecone-research-raw-report.md`](./pinecone-research-raw-report.md)
(committed alongside this file, so it is available to an independent auditor with no access to this
conversation).

**Status: research complete, hard gate passed, nothing implemented or benchmarked yet.** This is
not an approval. Pinecone still has to earn a verdict through every remaining acceptance gate.

## The hard gate: idle-lifecycle behavior

This was the single most important open question carried over from the Zilliz rejection — does
Pinecone Starter have a Zilliz-style "auto-suspend after inactivity, explicit resume required"
policy? **No.** Across every current official lifecycle-relevant page (cost, data-deletion, index
management, billing, quotas), the only automatic-deletion triggers documented are non-payment and
account closure — not inactivity. Pinecone's own cost documentation states plainly: **"Idle indexes
cost nothing."**

There *is* a relevant history here, and it's worth understanding rather than skating past: the old
pod-based free tier really did archive inactive indexes after 7 days, back in 2023 — and then
Pinecone explicitly removed that policy three months later ("no more auto-archiving," free indexes
kept indefinitely). Today's Starter plan is serverless-only; the old policy doesn't appear to have
carried over, and the research explicitly went and fetched the specific low-quality review sites
that a search engine was citing for a "paused after 3 weeks" claim — neither actually contains that
claim when read directly. That claim is debunked, not confirmed.

"OnDemand" is a billing mode (pay-per-read-unit), not a suspend/resume mechanism — there's no
"index sleeps, resume takes N minutes" pattern documented anywhere. The one real nuance: cold,
infrequently-queried *namespaces* can see higher latency than warm ones (a caching effect, not an
outage), with no published duration. Worth measuring empirically during benchmarking, but nothing
suggests it's remotely Zilliz-shaped.

**Gate result: PASS.**

## Starter plan limits (current, cross-confirmed from official docs)

$0/month, 2GB storage, 1M read units/mo, 2M write units/mo, 1GB egress/mo (429 + upgrade prompt
past that), 5 indexes/project, 100 namespaces/index, us-east-1 only, 768-dim well within the 20,000
dim ceiling. Current stable API is `2026-04`; Node SDK `@pinecone-database/pinecone@8.2.0` maps to
it. Whether a credit card is required to sign up could not be confirmed from an official source
either way — flagged as unverified rather than guessed.

## API maturity — this matters a lot for P1 vs. P2 vs. P3

- **Dense vector API**: stable/GA by strong inference (no preview badge anywhere, sits in the
  standard quarterly-stable channel). This is what any candidate architecture would actually use.
- **Sparse vector API**: genuinely ambiguous. Launched as "public preview" in August 2025; the
  current index-creation guide shows no preview badge on it anymore, but there's no explicit
  GA-graduation announcement either. Reported as ambiguous rather than picking a side.
- **`pinecone-sparse-english-v0`** (the hosted sparse embedding model P1 would need): available on
  Starter, 5M tokens/mo included, no documented per-request batch-size limit — that gap has to be
  closed empirically or via support before running full-corpus sparse ingestion, per the mandate's
  requirement to calculate token cost before executing it.
- **Document-schema / integrated BM25 API**: still `2026-01.alpha`, explicitly "public preview,"
  **no Node/TypeScript SDK at all** (Python-only, `pc.preview.*` namespace). This closes the door on
  P3 as anything but a research note — building production retrieval on an alpha API with no Node
  support isn't something to reach for by default.

## What this means for the candidate architectures

P1 (Pinecone dense + sparse) is viable to *attempt* — both APIs exist and are Starter-available —
but the sparse side carries real ambiguity (preview-vs-GA status, unknown batch limits) that has to
be resolved before committing resources to it. P2 (Pinecone dense only, Convex keeps lexical) rests
entirely on the dense API, which is the most confidently GA piece of this whole picture. P3 is
off the table as a production candidate for now — alpha API, no Node SDK — and stays research-only
unless the user explicitly accepts that risk.

## Next steps, in mandate order

Pinecone credentials are still absent from `.env.local` (`PINECONE_API_KEY` not set) — task #35's
credential preflight is BLOCKED pending the user supplying them. Everything past that (adapter
implementation, lifecycle/concurrency tests, full-corpus benchmark, P2 footprint measurement, P1
sparse feasibility, retrieval baseline) is queued and cannot start until credentials exist.
