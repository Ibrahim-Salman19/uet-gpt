# Zilliz Cloud Free — Verdict

**Authoritative machine-readable source: [`verdict.json`](./verdict.json).** This document narrates
it for a human reader; if the two disagree, the JSON wins.

## Verdict

> **ZILLIZ FREE REJECTED FOR UETGPT PRODUCTION**
> Hard gate: operational availability under realistic inactivity.

This is a different *kind* of rejection than Turso's. Zilliz's retrieval technology is not the
problem — it's the Free tier's operational shape.

## The functional side: 9 of 10, and the 1 failure is well understood

The shared `KnowledgeStore` contract suite (the same 10 tests every backend runs — see
[`../../../tests/integration/knowledgeStoreContract.ts`](../../../tests/integration/knowledgeStoreContract.ts))
passed 9/10 against a real Zilliz Cloud Free cluster. Core CRUD, dense search, lexical (FTS) search,
category filtering, cross-document chunk-key collision safety, interrupted-ingest recovery, and
health checks all work. Full detail: [`contract-results.json`](./contract-results.json), raw log
[`contract-suite-run.log`](./contract-suite-run.log).

The one failure — *"concurrent re-ingestion of the same changed document never regresses the
generation and never leaves a stale-tagged chunk behind"* — races two concurrent `upsertDocument`
calls for the same document via `Promise.all` and asserts the two resulting generation numbers must
differ. On Zilliz, both landed on `generation=2`
(`AssertionError: expected 2 not to be 2`). This is not an implementation bug in the Zilliz adapter;
it's a structural property of Milvus. Convex and Turso are relational/transactional stores that can
fence this race with a native atomic compare-and-swap or conditional increment. Milvus, via the SDK
this project uses, exposes no such primitive — a plain upsert is last-write-wins, so two concurrent
readers of "the current generation" can both compute and write the same "next generation" with
nothing at the datastore level to detect or reject the loser. This is exactly the kind of gap the
2026-08-15 mandate anticipated when it distinguished a vendor's *mechanism* (native CAS) from the
*semantic invariant* UETGPT actually needs (stale generations must never become authoritative) —
Zilliz lacks the former, and this one test shows the latter isn't free without extra
application-level work.

## The operational side: this is what actually rejects it

Zilliz Cloud's own documentation (`docs.zilliz.com/docs/manage-cluster`) states plainly that
**Free-tier clusters auto-suspend after a period of inactivity**, and resuming one is an explicit
action, not something that happens transparently:

> "Free clusters are automatically suspended with notice after 7 days of inactivity... You can
> always resume the clusters when necessary... When your cluster is suspended, you will only be
> charged for storage, not computing."

A second fetch of the same documentation area states a different number in a more general sentence
("Zilliz Cloud automatically suspends databases that have been inactive for 14 consecutive days") —
that discrepancy is recorded as-is in `verdict.json` rather than quietly resolved, since both figures
point to the same conclusion.

**What isn't independently confirmed**: exactly how long a resume takes. The original research
explicitly asked Zilliz's docs "is there a delay/latency before the cluster is usable again?" and no
recovered artifact answers that with a number — only that resuming is possible. A "several minutes"
characterization exists in this evaluation's own mandate text, but that should be read as the
mandate's framing, not as an independently vendor-confirmed figure, and this verdict does not assert
it as fact.

That gap doesn't change the outcome. UETGPT is a low-traffic, unattended production chat service —
there's no operator watching for a "cluster suspended" banner. A 7-to-14-day inactivity window is
realistic for its actual traffic. Whatever the exact resume time turns out to be, the failure mode is
the same in kind: a real user's chat query is what would first discover the cluster isn't serving,
with no automated recovery in between. That is a hard operational-availability gate failure on its
own terms, independent of the precise duration.

The one documented workaround — synthetic keep-warm traffic to prevent the cluster from ever going
idle — is explicitly disallowed by this project's own rules unless the vendor's policy clearly
permits it *and* the user explicitly approves it. Neither condition was established, so no keep-warm
traffic was implemented or proposed.

## What this does not claim

- Not that Zilliz's search quality is deficient — every retrieval-related test passed.
- Not that the concurrency failure is a defect to be fixed — it's attributed to a structural absence
  of native CAS, not a bug.
- Not a specific resume-duration figure as vendor fact.
- Not that Zilliz Free is fundamentally impossible to use with enough extra engineering (an external
  fencing protocol, a permitted keep-warm strategy) — only that, under this project's actual
  constraints ($0 budget, no keep-warm traffic, low/unattended traffic), the auto-suspend behavior
  alone fails the operational gate as things stand.

## Next step per the pre-existing fallback sequence

Section 34 of the original mandate: Pinecone becomes the next candidate only because both Turso and
Zilliz failed hard gates on their own merits — and even then it is explicitly not pre-approved; see
[`../pinecone/`](../pinecone/).
