# Turso Cloud / libSQL — Verdict

**Authoritative machine-readable source: [`verdict.json`](./verdict.json).** This document narrates
it for a human reader; if the two disagree, the JSON wins.

## Verdict

> **TURSO REJECTED FOR UETGPT'S PRIMARY VECTOR STORE**
> Reason: tested DiskANN configurations failed the required combination of retrieval quality,
> build behavior, and operational recoverability.

This is deliberately narrow. It does **not** claim Turso/libSQL cannot store 20,652 vectors as a
general proposition — that was never tested, and raw storage capacity was not the failure mode
observed. It is a statement about the specific DiskANN configurations actually benchmarked.

## What was tested

Two DiskANN compression modes (`diskann_f8`, `diskann_f16`) at four corpus scales (1,000 / 5,000 /
10,000 / 20,652 — the last being UETGPT's real chunk count), on a synthetic 768-dimensional
clustered-random corpus, against a real Turso Cloud database in `aws-ap-south-1`. Ground truth was
exact brute-force cosine search over the full 20,652-row table: deterministic, duplicate-free,
row-count-matched, p50=228ms / p95=259ms / p99=284ms (n=30).

| Config | Scale | Result | Recall@10 | Build time |
|---|---|---|---|---|
| diskann_f8 | 1,000 | PASS | 1.000 | 134s |
| diskann_f8 | 5,000 | PASS | 1.000 | 579s (~9.7 min) |
| diskann_f8 | 10,000 | **FAIL** (below 0.98 gate) | 0.963 | 1,413s (~23.5 min) |
| diskann_f8 | 20,652 (production scale) | **FAIL** (build never completed) | n/a — CLIENT_TIMEOUT after ~30 min | — |
| diskann_f16 | 1,000 | PASS | 1.000 | 191s |
| diskann_f16 | 5,000 | PASS | 0.987 | 1,446s (~24 min) |
| diskann_f16 | 10,000 | **FAIL** (build never completed) | n/a — CLIENT_TIMEOUT after ~30 min | — |
| diskann_f16 | 20,652 | not attempted (already failed at 10,000) | — | — |

Two independent failure modes, both real and both against the pre-declared gates in
[`../acceptance-gates.json`](../acceptance-gates.json):

1. **Retrieval quality**: `diskann_f8` at 10,000 rows measured Recall@10 = 0.963, below the
   pre-declared 0.98 gate.
2. **Build behavior / reliability**: at UETGPT's actual production scale (20,652 rows), the index
   build did not complete in either compression mode within a 30-minute client timeout. `diskann_f16`
   did not even complete at 10,000 rows.

## The DiskANN incident

Before the clean scaling-ladder run above, an earlier attempt to build an *uncompressed* DiskANN
index at full scale failed with `unable to update global metadata table`. Root-cause analysis
(recorded in full in [`incident-diskann-001.json`](./incident-diskann-001.json)) assessed this as
**likely self-inflicted**: the original benchmark script wrapped every client call — including the
`CREATE INDEX` DDL itself — in a uniform network-error retry. The first attempt returned an
ambiguous client-side "fetch failed" (which does not prove the server never received or started the
request); the wrapper retried 550ms later, and the second attempt collided with the still-in-flight
or partially-committed first one. This left orphaned shadow-table structures that resisted two
cleanup attempts (~5 minutes each) and had to be preserved as forensic evidence rather than cleanly
rolled back — the table was never touched again.

The code fix (route `CREATE INDEX` through a no-retry `executeOnce()`) is real and is reflected in
the clean ladder run above. **This incident is explicitly not the sole basis for rejection** — it
explains one specific bad build, but the clean, bug-fixed re-run *still* failed to complete a build
at production scale in either compression mode, which is the primary and code-fix-independent
reason Turso is rejected here.

A related, independently-useful finding survives the fix: even after removing the retry bug, a
5,000-row build required client fetch timeouts extended to 20–30 minutes (via
`undici.setGlobalDispatcher`) to complete, against a default client timeout of roughly 5 minutes.
Any production architecture that needed to build or rebuild this index synchronously would have to
account for that.

## What this does not prove

- Not that Turso physically cannot hold 20,652 vectors — storage capacity was modeled separately
  (see the `storageModel` block in `incident-diskann-001.json`) and was never the observed failure.
- Not that every possible DiskANN parameterization, or a non-DiskANN approach, would fail the same
  way — only `diskann_f8`, `diskann_f16`, and the uncompressed default were tested.
- Not that the `CLIENT_TIMEOUT` failures prove a hard server-side ceiling rather than a
  client-configuration limit — the post-fix 5,000-row retest shows the same class of build *does*
  complete given enough client-side patience at smaller scale. Whether comparable patience would
  eventually succeed at the full 20,652 scale was not tested to completion, and no claim is made
  either way.

## Next step per the pre-existing fallback sequence

Section 33 of the original acceptance-gate mandate specifies: on a Turso hard-gate failure, mark it
rejected and evaluate Zilliz Cloud next, preserving the same embeddings, chunker, IDs, metadata,
RRF, reranker, and citation semantics. See [`../zilliz/verdict.json`](../zilliz/verdict.json).
