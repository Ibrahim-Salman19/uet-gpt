# Phase 6 — Hybrid Retrieval Quality (mandate §45/46/57) — 2026-08-31, updated 2026-09-02

**Base commit:** `49ca5d3` (dirty tree at time of original writing). Scores
the production hybrid fusion path (`fuse_and_score.ts`, driving the real
Convex `hybridRank`/RRF logic via `channel_results.json`'s dense+lexical
channel outputs) against `scripts/eval/golden_set_verified.jsonl`, the
manually-reviewed 50-query label set described in
`scripts/eval/label_review.md`.

**2026-09-02 update:** §2's pool-bias defect (below) has been remediated —
see §6. All numbers in this Verdict block and elsewhere in the document
reflect the post-remediation state; §2's original measurement is kept
verbatim as the record of what was found. No Gemini/Pinecone/Convex Cloud
calls were made to produce either the original report or this update —
the remediation in §6 used already-cached local channel results and a
purely local re-run of the real production fusion code (Gemini/Pinecone/
Convex Cloud calls this session: 0).

## Verdict

```text
QUERIES IN GOLDEN SET:            50
QUERIES WITH >=1 LABELED-RELEVANT
  CHUNK (scorable):               23 / 50   (was 19/50 before §6's fix)
QUERIES WITH ZERO LABELED-RELEVANT
  CHUNK (unscorable, excluded
  from the mean):                 27 / 50   (was 31/50)

meanHitAt5 (over the 23 scorable):  0.9565  (was 0.9474 over 19)
meanMrr    (over the 23 scorable):  0.7295  (was 0.7076 over 19)

HUMAN_VERIFIED labels:              0 / 50  (unchanged - see §1)
Queries with >=1 AUTHORITATIVE_SOURCE_MATCH
  component in their provenance:    12 / 50 (was 9/50)
Queries with only LLM_JUDGED
  provenance:                       38 / 50 (was 41/50)

POOL-BIAS CHECK (originally measured, see §2 - now remediated, see §6):
  fusedTop5 introduced at least one chunk absent from the original
  denseTop5 label pool in 50 / 50 queries (103 such unlabeled slots
  total). All 103 have now been reviewed; 15 were genuinely relevant and
  are folded into the counts above. 88 were reviewed and confirmed not
  relevant (see §6 and delta_label_review.md for the reasoning on each).

MANDATE §63 GATE:  STILL NOT CLEARED — the specific pool-bias defect in
  §2 is fixed, but the underlying reason §63 doesn't clear is unchanged:
  0/50 labels are HUMAN_VERIFIED and N=23/50 is still a modest sample
  (see §1, §3). This remains a labeling-provenance gap, not a Pinecone or
  hybrid-fusion performance failure. Neither §64 ("PINECONE BENCHMARK
  PASS") nor §65 ("PINECONE BENCHMARK FAILED") applies yet.
```

## 1. Why 0.9474 / 0.7076 is not a production number

*(§1–§3 describe the original 2026-08-31 measurement and are kept as
written for the historical record. The current numbers, post-§6's
pool-bias fix, are 0.9565/0.7295 over 23 scorable queries — see the
Verdict block above and §6. §1's core argument — N is small, 0 labels are
HUMAN_VERIFIED — still applies to the current numbers essentially
unchanged, just with N=23 instead of 19.)*

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
those unlabeled `fusedTop5` chunks. **That pass has now been done — see
§6.** (At the time this section was first written, it had not: writing
the original report was a read-only, zero-cloud-call task, and the
labeling pass was separate scoped work completed afterward.)

## 3. What this run does establish

- The real production fusion code path (not a Python approximation) runs
  end-to-end against the frozen, real corpus and produces stable,
  reproducible output — `hybrid_eval_results.json` is deterministic given
  its two inputs (`channel_results.json`, `golden_set_verified.jsonl`).
- Where a scorable ground truth exists, hybrid retrieval finds it in the
  top 5 95.7% of the time with a mean reciprocal rank of 0.73 (post-§6;
  94.7%/0.71 before it) — a reasonable signal, but one drawn from a
  small, partially-LLM-labeled sample, not a certified production
  benchmark.
- The bilingual/short-form/generic queries (41–50, incl. Roman-Urdu
  queries 41/43/44) are part of the 50 and behaved the same as the rest of
  the pipeline — no separate failure mode observed there, though the same
  small-N/label caveats apply. §6's delta review found no relevant chunks
  for any of the three Roman-Urdu queries (41/43/44) even after
  considering the hybrid-only candidates — consistent with §2/§6's
  finding that this is a genuine cross-lingual retrieval gap, not a
  labeling artifact.

## 4. Two gates this leaves open (updated 2026-09-02)

1. **§45/46/57 hybrid quality — open, narrower than before.** §2's
   pool-bias half of this gap is now fixed (§6): the label pool has been
   widened to include every `fusedTop5` candidate, not just `denseTop5`.
   What remains is the other half — a real HUMAN_VERIFIED pass over the
   39 (now still 39; §6 added judgments, not human review) queries the
   user did not personally review. That is a local, zero-cloud-call task
   (reading golden set files against the already-frozen corpus) but it
   does require the project's user's own time, which §6 could not
   substitute for — see §6's provenance discipline.
2. **§58 lifecycle matrix (7/7 PASS) was run against the older 768-dim
   index, not the currently-populated 1024-dim (`qwen3-embedding-0.6b`)
   Pinecone index** (flagged by the state-reconstruction pass that
   preceded this report). Re-verifying it touches live Pinecone — a
   separate authorization under mandate §51/§59 and `uet-gpt/CLAUDE.md`'s
   resource-safety rule that "continue" does not itself authorize a cloud
   operation. Not attempted here.

Because of (1), **§63's final gate is still not cleared and §64/§65 do
not fire.** This is not a Pinecone failure — ANN Recall@10 (0.98, §56) and
the resource projections (§62) already passed on their own evidence — it
is that the retrieval-quality gate specifically needs real human
provenance on more of the label set before a verdict can be certified
either way.

## 5. Evidence contract (§71) — original 2026-08-31 report

This report was produced by reading existing artifacts, not by executing
a new eval run. Per §71, claims below are classified honestly rather than
presented as a fresh `EXECUTED` run.

**Note (2026-09-02): the hashes below are for the pre-remediation state.**
`golden_set_verified.jsonl`, `channel_results.json`, and
`hybrid_eval_results.json` were all rewritten by §6's remediation and no
longer match these hashes — this block is kept as the historical record
of what was originally measured; §6 has its own evidence contract for the
updated files.

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

## 6. Pool-bias remediation (2026-09-02)

Closes the specific defect measured in §2: 103 chunks across all 50
queries appeared in `fusedTop5` but were never in the original
`denseTop5` label pool, so were scored as misses regardless of actual
relevance.

**Tooling.** `scripts/eval/generate_delta_label_review.py` reads the
already-computed `hybrid_eval_results.json` (no re-fetch, no cloud call —
`denseTop5`/`fusedTop5` were already on disk) and, for each query,
computes `fusedTop5 - denseTop5` — the exact chunks never shown to a
labeler. It looked up full chunk text for each from the local corpus
(`/mnt/d/uetgpt_corpus_v1/embeddings/all_chunks.jsonl`, the same source
`generate_label_review.py` uses) and wrote `scripts/eval/
delta_label_review.md`: 50 queries × 103 candidates, each echoing the
query's existing relevant chunk(s)/note for context. Confirmed the
generated count matched the measured 103 before review began.

**Review.** All 103 candidates were read in full (not just the 400-char
preview shown in the review file — for genuinely ambiguous cases the
complete chunk text was fetched directly from `all_chunks.jsonl` and
checked against the query before judging; see the per-query
`_delta_note:_` entries in `delta_label_review.md` for the reasoning kept
for every candidate, relevant or not). This review was done by an AI
session, not the project's user — provenance is marked accordingly
throughout, never `HUMAN_VERIFIED`: **`LLM_JUDGED`** by default (read
against the query, no independent second source checked), upgraded to
**`AUTHORITATIVE_SOURCE_MATCH`** only on the 4 queries (20, 27, 32, 45)
where a candidate was cross-checked against — and corroborated —
specific content already independently verified elsewhere in this
project's evidence trail (e.g. query 20's Programming Fundamentals
credit-hour figure matching the original review's already-verified
Computer Engineering total; query 27's Registrar Office contact chunk
matching the phone number already established as correct, while also
surfacing and explicitly flagging a genuine discrepancy — a different
named Registrar than the original review's candidate — as a finding, not
something silently resolved).

**Result.** 15 of the 103 candidates were genuinely relevant (not a
rubber-stamp: 88 were read and rejected with a stated reason each). They
were merged additively into `golden_set_verified.jsonl` via
`scripts/eval/parse_delta_label_review.py` — existing relevant chunks and
provenance were kept as-is; new ones were appended, with each query's
`provenance` field extended to record the delta judgment as its own
attributed segment (e.g. `AUTHORITATIVE_SOURCE_MATCH (...) | delta review
(1 chunk(s)): AUTHORITATIVE_SOURCE_MATCH (...)`), never overwriting the
original attribution. Of the 15, 4 landed on queries that previously had
*zero* labeled-relevant chunks at all (queries 1, 8, 11, 47) — meaning 4
of the 50 queries went from "no scorable answer exists in this label set"
to "hybrid retrieval's answer is now credited," which is exactly the
failure mode §2 predicted. The other 11 added corroborating/additional
relevant chunks to queries that already had at least one.

**Disclosure: queries 17 and 47 now share their entire ground truth.**
Query 47's one new relevant chunk (`b5bb836b20b6...`, "Admission Schedule
Entry Fall 2026 — Important Dates & Deadlines") is the *same* chunk that
was already query 17's sole relevant chunk in the original review — both
are generic "important dates" queries and the same content genuinely
answers both, so the mark is correct, but it means 2 of the 23 scorable
queries are not independent: if the fused ranking retrieves that one
chunk, both score a hit off the same evidence; if it doesn't, both miss
together. A reader weighting `scoredQueryCount=23` as 23 independent data
points should discount this pair to effectively ~22.

`channel_results.json`'s per-query `relevantChunkKeys` field was then
patched to match the updated golden set (a local JSON edit — the cached
`dense`/`lexical` raw ranked lists themselves were untouched, so this
required no new Pinecone/Convex fetch), and `fuse_and_score.ts` was
re-run locally (`npx tsx docs/rag-store-evaluation/hybrid-retrieval-2026-08/fuse_and_score.ts`)
to regenerate `hybrid_eval_results.json` against the same real,
unmodified `hybridRank.ts` fusion logic — no re-fetch of dense/lexical
results, no cloud call of any kind. Result: `scoredQueryCount` 19→23,
`meanHitAt5` 0.9474→0.9565, `meanMrr` 0.7076→0.7295 (all reported in the
updated Verdict block above).

**What this does and does not resolve.** The pool-bias-driven undercount
is fixed. What is unchanged: 0/50 labels are `HUMAN_VERIFIED`, and the
scorable sample (23/50) is still modest. §63 does not clear on this
alone — see §4(1). This section's own labeling work is itself
`LLM_JUDGED`/`AUTHORITATIVE_SOURCE_MATCH`, not a substitute for §47's
human-review requirement; it is a legitimate, honestly-provenanced
improvement to the *existing* AI-reviewed portion of the label set, not a
claim that the set is now human-verified.

**Evidence contract (§71):**

```text
Claim class:             EXECUTED (this session ran the generation
                         script, performed the review, ran the merge
                         parser, patched channel_results.json, and
                         re-ran fuse_and_score.ts directly)
Git HEAD (uet-gpt) at
  start of this work:     6321b2b4ea7478d103bace6159b9f855981ad714
Branch:                   agent/2026-08-12-turso-knowledge-store
Commands run (in order, all local, cwd uet-gpt/):
  python3 scripts/eval/generate_delta_label_review.py
  [103 candidates reviewed in full, edits applied to delta_label_review.md]
  python3 scripts/eval/parse_delta_label_review.py
  [Python one-off: patched channel_results.json's relevantChunkKeys from
   the updated golden_set_verified.jsonl]
  npx tsx docs/rag-store-evaluation/hybrid-retrieval-2026-08/fuse_and_score.ts
Exit codes:               0 for all of the above
API mode:                 N/A (no API calls; all inputs already local)

Output artifact hashes (SHA-256, MEASURED, post-remediation):
  scripts/eval/generate_delta_label_review.py
    9bc037fd2d07f67ed32e8e60a085e540e52623584a36eb7b005290f031240b07
  scripts/eval/parse_delta_label_review.py
    b2ad3db4034cfef91c30dceae2d4a2770894a8b859b27822e39dc3d078ed139c
  scripts/eval/delta_label_review.md
    d2661708f19f038b9895b5555b5d4d7480ad4382449f1fa2b026b0032c293c41
  scripts/eval/golden_set_verified.jsonl (post-merge)
    3258d7f7cabbd144b7b205c25d9e44828008362a4034d8a379d4e0d8ec99131c
  docs/rag-store-evaluation/hybrid-retrieval-2026-08/channel_results.json
    (post-patch)
    013e7cfd8d414e516c373a42ab685394ad2402e3c44c60f3519511ab353b755b
  docs/rag-store-evaluation/hybrid-retrieval-2026-08/hybrid_eval_results.json
    (post-rerun)
    c2c98f0a3834f88f15e73f3c44458fc1659c550477f0531f4e88031282186636

Claims classified MEASURED: the 15/103 relevant count, the
  scoredQueryCount/meanHitAt5/meanMrr deltas, all hashes above. Classified
  INFERENCE: the relevance judgments themselves on each of the 103
  candidates (an LLM_JUDGED/AUTHORITATIVE_SOURCE_MATCH review, not a
  ground truth) — see delta_label_review.md's per-query notes for the
  reasoning behind each, which is the actual auditable evidence, not
  this summary.

Cloud activity this section: Convex Cloud 0, Gemini 0, Pinecone 0, Neon 0
  (channel_results.json's dense/lexical raw results were reused verbatim
  from the 2026-08-31 fetch, not re-fetched).
```
