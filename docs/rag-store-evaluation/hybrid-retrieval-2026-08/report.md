# Phase 6 — Hybrid Retrieval Quality (mandate §45/46/57) — 2026-08-31

**Base commit:** `49ca5d3` (dirty tree at time of writing — see §5). Scores
the production hybrid fusion path (`fuse_and_score.ts`, driving the real
Convex `hybridRank`/RRF logic via `channel_results.json`'s dense+lexical
channel outputs) against `scripts/eval/golden_set_verified.jsonl`, the
manually-reviewed 50-query label set described in
`scripts/eval/label_review.md`.

This report was written by a separate session picking up work already run.
Its job is to state honestly what the existing run output does and does not
license, not to re-run or extend the evaluation. No cloud calls were made to
produce this document — it is entirely a re-read of local files already on
disk (Gemini/Pinecone/Convex Cloud calls this session: 0).

## Verdict

```text
QUERIES IN GOLDEN SET:            50
QUERIES WITH >=1 LABELED-RELEVANT
  CHUNK (scorable):               19 / 50
QUERIES WITH ZERO LABELED-RELEVANT
  CHUNK (unscorable, excluded
  from the mean):                 31 / 50

meanHitAt5 (over the 19 scorable):  0.9474
meanMrr    (over the 19 scorable):  0.7076

HUMAN_VERIFIED labels:              0 / 50
LLM_JUDGED labels:                  39 / 50 (incl. all 31 unscorable)
AUTHORITATIVE_SOURCE_MATCH labels:  11 / 50 (the 9 fee/charges queries
                                    cross-checked against the Prospectus
                                    PDF page images, per label_review.md's
                                    2026-08-31 addendum)

POOL-BIAS CHECK (measured, see §2): fusedTop5 introduces at least one
  chunk absent from the original denseTop5 label pool in 50 / 50 queries
  (103 such unlabeled slots total). Of the 31 unscorable queries, all 31
  have this property.

MANDATE §63 GATE:  NOT CLEARED — not because retrieval measured poorly,
  but because the label set cannot currently support a production verdict
  (see §1, §3). This is a labeling-methodology gap, not a Pinecone or
  hybrid-fusion performance failure. Neither §64 ("PINECONE BENCHMARK
  PASS") nor §65 ("PINECONE BENCHMARK FAILED") applies yet.
```

## 1. Why 0.9474 / 0.7076 is not a production number

§47 of the mandate is explicit: *"If the labeled set is too small to
support a production verdict: say so."* Two things say so here:

- **Scorable N = 19.** `meanHitAt5` and `meanMrr` are computed only over
  queries that have at least one `relevantChunkKeys` entry — a query with
  none contributes nothing to the mean (`hitAt5`/`mrr` are `null` in
  `hybrid_eval_results.json` for those rows). 19 queries is too small a
  sample to license a production go/no-go on its own, independent of the
  score.
- **Zero HUMAN_VERIFIED labels.** `label_review.md`'s own instructions
  (lines 1–12) describe a process where the project's user marks each
  candidate by hand, defaulting to `HUMAN_VERIFIED` provenance. The
  2026-08-31 addendum records that the user found most of the fee/charges
  queries "very difficult" personally and handed 11 of the 50 to the AI
  instead (`AUTHORITATIVE_SOURCE_MATCH` where cross-checked against the
  Prospectus PDF, `LLM_JUDGED` otherwise), explicitly excluding those 11
  from the `HUMAN_VERIFIED` category. The addendum states the remaining 39
  queries were "still open for the user's own review." The emitted
  `golden_set_verified.jsonl` shows all 39 came out with provenance
  `LLM_JUDGED (read against the query directly; no independent second
  source checked)` — i.e. **the intended human review pass over those 39
  did not happen**; an LLM (this project's own agent) labeled them
  instead, using the same reading-comprehension process a `HUMAN_VERIFIED`
  reviewer would have, but without a second reviewer. This is stated
  plainly here rather than left as an inherited default, per §47's
  provenance-honesty requirement.

Neither point means the run is worthless — see §2 for what it does
establish — but the mean scores above must not be quoted without these two
qualifiers attached.

## 2. Pool-bias finding (MEASURED)

The 50 labeled candidates per query in `label_review.md` are, by that
file's own description (line 3), "nearest-neighbor matches from **exact
cosine search**" — i.e. the label pool is dense-only. `fuse_and_score.ts`
scores a *hybrid* (dense + lexical, RRF-fused) system against that
dense-only pool.

Checked directly against `hybrid_eval_results.json`: for every one of the
50 queries, `fusedTop5` contains at least one chunk key absent from that
query's `denseTop5` (103 such never-labeled slots across the 50 queries).
Concretely, for query 6f79337e4985ea52 ("How can I pay my semester fee at
UET Taxila?"), `fusedTop5[0]` is `549036e9...` — a chunk that came from
`lexicalTop5`, was never in `denseTop5`, and was therefore never shown to
a labeler.

Consequence: any lexical-channel chunk the hybrid system surfaces that
dense cosine search never ranked in its own top 5 is scored as a miss **by
construction**, regardless of whether it is actually the correct answer,
because it was never eligible to be marked relevant. This is the specific
failure mode hybrid retrieval exists to fix (surfacing exact-term/table
content dense embeddings rank low), so the current metric is structurally
biased against crediting hybrid's main advantage.

This is sharpest on the 31 unscorable queries: **all 31** have a
never-labeled chunk in their `fusedTop5`. `label_review.md`'s own notes on
several of these (queries 1, 2, 4, 5 — the fee/tuition-figure queries) say
the true answer "exists in the corpus but was not retrieved" among the
dense top 5 shown for labeling. Whether the hybrid system's unlabeled
`fusedTop5` picks now include that true answer is unknown — it was never
checked, because the label set was frozen before the hybrid run existed.
Determining that would require a second, small labeling pass over just
those unlabeled `fusedTop5` chunks; that pass has not been done and is not
done as part of this report (writing this report is a read-only,
zero-cloud-call task; running a further labeling pass is separate scoped
work).

## 3. What this run does establish

- The real production fusion code path (not a Python approximation) runs
  end-to-end against the frozen, real corpus and produces stable,
  reproducible output — `hybrid_eval_results.json` is deterministic given
  its two inputs (`channel_results.json`, `golden_set_verified.jsonl`).
- Where a scorable ground truth exists, hybrid retrieval finds it in the
  top 5 94.7% of the time with a mean reciprocal rank of 0.71 — a
  reasonable signal, but one drawn from a small, partially-LLM-labeled,
  dense-pool-biased sample, not a certified production benchmark.
- The bilingual/short-form/generic queries (41–50, incl. Roman-Urdu
  queries 41/43/44) are part of the 50 and behaved the same as the rest of
  the pipeline — no separate failure mode observed there, though the same
  N=19/label caveats apply.

## 4. Two gates this leaves open (not resolved here)

1. **§45/46/57 hybrid quality — open.** Needs either (a) a real
   HUMAN_VERIFIED pass over the 39 queries the user did not personally
   review, and/or (b) a widened label pool that includes `fusedTop5`
   candidates (not just `denseTop5`) so the pool-bias in §2 stops
   silently undercounting hybrid's hits. Both are local, zero-cloud-call
   tasks (reading golden set files against the already-frozen corpus) and
   do not require new Pinecone/Gemini/Convex Cloud activity.
2. **§58 lifecycle matrix (7/7 PASS) was run against the older 768-dim
   index, not the currently-populated 1024-dim (`qwen3-embedding-0.6b`)
   Pinecone index** (flagged by the state-reconstruction pass that
   preceded this report). Re-verifying it touches live Pinecone — a
   separate authorization under mandate §51/§59 and `uet-gpt/CLAUDE.md`'s
   resource-safety rule that "continue" does not itself authorize a cloud
   operation. Not attempted here.

Because of (1), **§63's final gate is not cleared and §64/§65 do not
fire.** This is not a Pinecone failure — ANN Recall@10 (0.98, §56) and the
resource projections (§62) already passed on their own evidence — it is
that the retrieval-quality gate specifically needs a better label set
before a verdict can be certified either way.

## 5. Evidence contract (§71)

This report was produced by reading existing artifacts, not by executing
a new eval run. Per §71, claims below are classified honestly rather than
presented as a fresh `EXECUTED` run:

```text
Claim class:            NOT_EXECUTED_BY_THIS_SESSION (the hybrid eval run
                         itself — files below were already present on disk
                         when this report-writing session started)
Git HEAD (uet-gpt):      49ca5d3a9ca6293bf24f0aebc4d4286ab1027c4a
Branch:                  agent/2026-08-12-turso-knowledge-store
Working tree:            DIRTY at report time (unrelated in-flight changes
                         present — see repo `git status`; none of them
                         touch this evidence directory)
Corpus base:             local-corpus-v1-freeze-2026-08/manifest.json,
                         gitCommit e48421d, documents.jsonl sha256
                         97b9b2b9c87178267fc70031e2a1f49cc8aaf08702d70a647
                         bc9ab8f4f3177ad (1,891 lines / 1,890 unique
                         document IDs — 1 duplicate document ID is a known,
                         separately-tracked gap; see
                         docs/audit/CORPUS_INTEGRITY_REMEDIATION_20260819.md)

Input artifact hashes (SHA-256, this session, MEASURED):
  scripts/eval/golden_set_verified.jsonl
    c73dd42680e12f1fa4599d4cd42b4f8bd16af46844507326fab202ce17ef6999
  scripts/eval/label_review.md
    b9a2c030eb276a1444b0bc211423b653f4103610093adc37a5427f0ae778785b
  scripts/eval/parse_label_review.py
    c26aaf0cfe200340a6c7be00b9483b2d9bc7399fedee8403dd8b6f63761a2da9
  docs/rag-store-evaluation/hybrid-retrieval-2026-08/hybrid_eval_results.json
    18ed70e315540b4a66490e53ac7df2e89f7554edbcaa0df9cb3cee8585bf89ea
  docs/rag-store-evaluation/hybrid-retrieval-2026-08/channel_results.json
    6e2054642c27e0448f9e1db89916ac5a17428fdd8e5d25b4d40428c339d3ce3c
  docs/rag-store-evaluation/hybrid-retrieval-2026-08/fuse_and_score.ts
    8bd58e81d9af529be023db93206657fa5f604378baba2bd2ae355ee502d37467
  docs/rag-store-evaluation/hybrid-retrieval-2026-08/hybrid_eval.ts
    4a8f85236f6ea940abf4f5cdc260ad17a5d63c8f97206875dcd1876bc7247f10
  docs/rag-store-evaluation/hybrid-retrieval-2026-08/fetch_channel_results.py
    578566ebcdcf06ae06f8d9cd159eba9d6622240ba1278dc002a37ff91494a608

File mtimes (local filesystem, not authoritative but consistent with a
single continuous run):
  channel_results.json     2026-08-31 23:45:11 PKT
  hybrid_eval_results.json 2026-08-31 23:45:23 PKT
  fuse_and_score.ts        2026-08-31 23:45:33 PKT
  hybrid_eval.ts           2026-08-31 23:21:58 PKT
  fetch_channel_results.py 2026-08-31 23:24:33 PKT
  golden_set_verified.jsonl 2026-08-31 23:44:19 PKT
  label_review.md           2026-08-31 23:44:07 PKT

Exact command / cwd / start-end / exit code / API mode for the original
  hybrid_eval_results.json generation run:  NOT_EXECUTED_BY_THIS_SESSION —
  not recorded by the prior session that ran it and not reconstructed
  here rather than guessed.

Claims in this report classified MEASURED: the verdict block's counts,
  §2's pool-bias figures, §5's hashes. Classified INFERENCE: §1 and §3's
  interpretation of what the scores do/don't license. Classified
  NOT_EXECUTED_BY_THIS_SESSION: the original eval run itself and its
  exact invocation.

Cloud activity this session (report-writing only): Convex Cloud 0,
  Gemini 0, Pinecone 0, Neon 0.
```
