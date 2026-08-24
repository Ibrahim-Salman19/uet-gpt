# Cloudflare Workers AI as embedding backend - verification (2026-08-24)

Motivation: the Gemini free tier caps `gemini-embedding-2` at **1,000 embedded
chunks/day/key** (the quota counts *content items*, not HTTP requests -
confirmed because the run already batches 100/call via `batchEmbedContents` yet
still died at exactly 1,000/key). With 3 keys that is ~3,000/day, i.e. **~14
days** for the remaining 41,792 chunks. Paid tier is out: the user cannot spend
money. Local execution is out: the dev machine is an i5-10210U / 7GB RAM / no
GPU.

This evaluates Cloudflare Workers AI's free tier (10,000 neurons/day). Every
number below is **measured against the live endpoint with real corpus chunks**.

## Verdict

```text
RECOMMENDED:  @cf/qwen/qwen3-embedding-0.6b
  dimensions:      1024 (L2-normalized)
  truncation:      NONE on our corpus (verified, §3)
  quality:         statistically tied with bge-m3 on our own corpus (§4)
  full corpus:     ~34,426 neurons  =>  3.44 days at 10,000/day free
  money cost:      $0

REJECTED:  @cf/baai/bge-m3
  equal quality and equally truncation-free, but ~3.2x more expensive in
  neurons for identical work => 10.9 days instead of 3.44. On a fixed free
  daily allocation, neurons convert directly into DAYS, so this is a
  throughput difference, not a money one.

REJECTED:  @cf/google/embeddinggemma-300m
  SILENTLY TRUNCATES our large chunks (§3). 768 dims would have been a
  drop-in match for the existing index - which is exactly why it needed
  testing rather than assuming.

REJECTED:  @cf/baai/bge-{small,base,large}-en-v1.5
  512-token limit: would truncate 30.8% of chunks and destroy 49.2% of all
  corpus text.
```

## 1. Why Cloudflare removes the risk that killed other free options

Every other free candidate required embedding the corpus with one model and
serving queries with another, because no free provider absorbs both 23M+ tokens
of bulk work and production query traffic. Mismatched embedding spaces produce
plausible-but-wrong retrieval - the failure mode
`convex/embeddings/generate.ts:286-289` already warns about ("a different
embedding model would produce vectors in a different latent space, silently
breaking all vector similarity scores").

Cloudflare serves **the same endpoint for both** bulk corpus embedding and
query-time embedding. Same model, same weights, same space, by construction.
There is no parity gap to test because there is no second model.

## 2. Measured cost

Cloudflare returns a `cf-ai-neurons` response header with exact consumption per
call, so this is measured rather than inferred.

Two independent samples, and note how much the estimate moved with sample
choice:

```text
sample                              qwen3-0.6b          bge-m3
200 random chunks (avg 2537 ch)     370.5 neu/M ch      1173.5 neu/M ch
1000 stratified (avg 1251 ch)       336.6 neu/M ch      1620.6 neu/M ch

full-corpus projection (92.9M chars, using the random-sample rate):
  qwen3-0.6b   ~34,426 neurons   3.44 days at 10k/day free
  bge-m3      ~109,028 neurons  10.90 days at 10k/day free
```

**A correction worth recording.** An earlier projection in this evaluation put
bge-m3 at 2.62 days. That was extrapolated from a single favourable 10-chunk
batch (282 neurons/M chars). Against representative samples the real figure is
~1,173-1,620 neurons/M chars, i.e. **10.9 days - roughly 6x worse than the
first estimate**. Per-chunk cost varies enough with text shape that small
convenience samples are not safe to extrapolate from. This is why the final
numbers come from random and stratified samples, not from whatever batch was
already loaded.

Neuron cost scales with tokens, not request count (batches of 25/50/100 cost
10.05/20.09/40.19), so unlike Gemini's per-item daily cap there is no quota
shape to game; batch size is purely a throughput knob.

## 3. The gating correctness check: silent truncation

An HTTP 200 proves nothing - a truncating model still returns 200. So test the
observable consequence: embed a large chunk, then embed the same chunk with a
distinctive sentence appended **at the very end**. If the tail was read the
vectors differ; if it was truncated away they are identical.

`cf_dilution_control.py` sweeps prefix length to separate the two explanations
for a small shift - dilution vs truncation:

```text
prefix chars:      400      1000     2000     4000     7200
bge-m3:            0.911    0.963    0.963    0.980    0.993782
embeddinggemma:    0.794    0.873    0.927    0.961    1.000000  <-- cliff

single largest chunk (7200 chars):
qwen3-0.6b:        cosine 0.916223  -> tail read
bge-m3:            cosine 0.993326  -> tail read
embeddinggemma:    cosine 1.000000  -> tail NEVER read
```

- **qwen3-0.6b and bge-m3**: cosine stays clear of 1.0; the appended sentence
  always moves the vector, just less as it becomes a smaller fraction of the
  text. That is dilution - full text read.
- **embeddinggemma-300m**: smooth rise then a hard jump to *exactly* 1.000000.
  The appended sentence had literally zero effect, so it was never seen.
  Truncation between 4,000 and 7,200 chars, consistent with its 2,048-token
  limit.

Corpus impact had this gone undetected: **13,786 of 44,792 chunks (30.8%)
exceed 2,048 tokens**. This failure mode yields confidently wrong answers, not
visible errors.

## 3a. Operational limits discovered while building the ingest path

Findings that would each have broken an unattended multi-day run. All surfaced
by running real traffic, not by reading documentation.

**1. The context limit is a per-REQUEST budget across the whole batch, not
per-text.** A batch of 50 real chunks failed:

```text
HTTP 400  AiError: Max context reached 82650 tokens but model supports
          only 60000                                       (code 3030)
```

Batches must be sized by *total tokens across the batch*, with split-and-retry
on 400 - not by fixed item count, which works until it meets a run of large
chunks. qwen3 has a smaller per-request budget than bge-m3 (a 50,000-char batch
400s), so the budget must be per-model.

**2. This corpus runs ~1.6 chars/token, not the usual ~4.** Derived from that
same error (133,634 chars = 82,650 tokens). Estimates built on the conventional
chars/4 heuristic are ~2.5x optimistic here. The day figures above are
unaffected because neurons were measured directly rather than derived from a
token guess.

**3. The endpoint rate-limits (HTTP 429) under sustained batch traffic.** The
ingest needs exponential backoff honouring `retry-after` plus inter-request
pacing. 400 must be treated as deterministic (split the batch) and 429/5xx as
transient (back off and retry) - conflating them either wedges the run or loses
data.

**4. Cloudflare's own model metadata is not reliable.** The catalog reports
`context_window=153600` for `@cf/baai/bge-base-en-v1.5`, a model
architecturally capped at 512 tokens. Trusting that field would have produced
silent truncation across a third of the corpus.

## 4. Retrieval quality, measured on our corpus

Known-item retrieval over a stratified sample: 1,000 chunks spanning 1,000
distinct documents, 100 probes built by extracting a distinctive mid-chunk
sentence and requiring its source chunk to be retrieved. Ground truth needs no
labels and no model, so it cannot favour either candidate; conditions are
identical for both.

```text
model                            dim    R@1     R@5    MRR@10   neurons
@cf/baai/bge-m3                 1024   0.630   0.750   0.676     2027
@cf/qwen/qwen3-embedding-0.6b   1024   0.620   0.730   0.675      421
```

At n=100 the 1-2 point gaps are inside sampling noise - these two are
**indistinguishable on quality for this corpus**, while qwen3 does the identical
work for 4.8x fewer neurons.

This also contradicts published commentary claiming BGE-M3 roughly doubles
Qwen3-0.6B's hit rate; on UET Taxila's actual text they are level. Worth
recording as a reason to measure on the target corpus rather than adopt
leaderboard ordering.

Limitation, stated plainly: known-item retrieval measures discriminative power,
not end-to-end RAG answer quality. It is a fair *comparison* between models but
is not a substitute for the mandate's hybrid retrieval evaluation.

## 5. Consequences of the recommendation

```text
- 1024 dims, so the 768-dim Pinecone index must be recreated at 1024
  (currently exactly one index exists: uetgpt-p2-proof, dim=768)
- convex/embeddings/dimension.ts hardcodes 768 -> becomes 1024
- convex/embeddings/generate.ts query path moves from Gemini to Cloudflare
- the 3,000 chunks already embedded with gemini-embedding-2 are discarded
  (different latent space, ~7% of the work)
- qwen3-embedding-0.6b is a 0.6B open model, NOT frontier-tier like
  gemini-embedding-2; end-to-end retrieval quality must be measured against
  the mandate's gates, not assumed
```

A production query-path change sits behind the mandate's independent-review
gate and is not authorized by this evaluation.

## 6. Scalability

```text
query-time:     ~50 tokens/query for the embedding alone => ~180,000
                queries/day. NOTE: this is embedding-only. Adding the
                reranker (§6a) drops the practical ceiling to ~3,500
                queries/day at rerank-depth 20. See §6a for the full table.
cold start:     3.44 days for the full 44,792-chunk corpus.
refresh:        incremental. Each chunk record already carries contentHash,
                so a re-crawl re-embeds only changed chunks - minutes, not
                days. The 3.44-day figure is one-time.
corpus growth:  linear in neurons; 2x corpus = ~6.9 days cold, but refresh
                stays incremental.
```

## 6a. Conformance with 2026 community best practice

Checked against current published guidance (Aug 2026) for production RAG and
embedding pipelines.

**Ingestion — conforms:**

```text
idempotent on documentId + chunkKey ............ yes
content hashing to detect re-embedding need .... yes (contentHash per record)
resumable / restart-safe ....................... yes (fsync per batch, atomic
                                                 state, verified against a
                                                 real interruption)
micro-batches sized to model input ............. yes (char-budgeted, split on
                                                 400)
backpressure / rate-limit handling ............. yes (pacing + retry-after
                                                 backoff)
model+version recorded on every vector ......... yes (model, dims per record)
single model for the whole index ............... yes (enforced structurally -
                                                 one endpoint for corpus and
                                                 queries)
single-writer enforcement ...................... yes (lockfile; added after a
                                                 real concurrent-run incident,
                                                 see §9)
```

**Gaps, deliberately not yet built:**

```text
drift detection over time ...................... not built
dual-write model migration path ................ not built (relevant only when
                                                 changing embedding model)
```

**Retrieval — the highest-value outstanding item.** Community analysis is
consistent that when RAG fails, the failure is in *retrieval* ~73% of the time,
not generation, and that the largest single quality lever is a cross-encoder
reranking stage: retrieve top-~100 via hybrid search, rerank, keep top 5-10.
Reported gain is 20-30% in top-k quality. The standard fusion for the hybrid
stage is Reciprocal Rank Fusion with k=60.

Directly relevant finding: **`@cf/baai/bge-reranker-base` is available on the
same Cloudflare account and free tier already in use.** That makes the single
highest-value retrieval improvement available at $0 with no new vendor,
no new credentials, and no second embedding space to reconcile.

**Functionally verified** (not merely catalog-listed - catalog metadata has
already proven unreliable once, §3a.4). A real probe with one UET admissions
question and four candidate passages:

```text
0.442      "Undergraduate admission is open to students holding an
            intermediate qualification; merit is computed from
            matriculation, intermediate and entry test scores."
0.355      "Candidates ... must have passed FSc pre-engineering with at
            least 60% marks and appear in the ECAT entrance test."
0.0000383  "The department of mechanical engineering was established in 1975."
0.0000373  "The library remains open until 8 PM on weekdays."
```

Relevant passages score roughly four orders of magnitude above irrelevant ones
- strong discrimination on our own domain text. API shape is
`{query, contexts:[{text}]}` returning `{id, score}` sorted by relevance.

**Cost consequence, which constrains the design.** Measured: 224 tokens =
0.0633 neurons, i.e. ~283 neurons/M tokens. Reranking is applied per query over
many candidates, so it dominates query-time cost:

```text
rerank depth   tokens/query   neurons/query   queries/day within 10,000
top-100          ~50,000          14.1                ~709
top-50           ~25,000           7.1              ~1,410
top-20           ~10,000           2.8              ~3,540
```

This **corrects the scalability figure given in §6**: ~180,000 queries/day is
the embedding-only number. With reranking enabled the free tier supports
roughly 3,500 queries/day at top-20, or ~700 at the top-100 depth community
guidance suggests. Still adequate for a university chatbot, but it must be
designed for rather than assumed, and the daily allocation is shared with
corpus (re)embedding. Recommended shape: hybrid retrieve wide, rerank top-20 to
30, not top-100.

## 7. Reproduce

```text
cf_verify.py            token works; dims + batching + normalization per model
cf_measure.py           neuron cost against real corpus chunks; batch probe
cf_truncation_test.py   appended-marker truncation test
cf_dilution_control.py  prefix-length sweep separating dilution from truncation
cf_quality_bakeoff.py   known-item retrieval bake-off (R@1/R@5/MRR@10)
cf_final_checks.py      truncation check for qwen3 + clean cost measurement
```

All read credentials from `.env.local` and never print the token.

## 9. Incident: concurrent writers (2026-08-24, during the production run)

Recorded because the fix is now load-bearing.

Two instances of `cf_embed_corpus.py` ran simultaneously. The first was
launched with `nohup ... &`; the check that concluded it had died looked for
its log with a relative path *after* the `cd` had already stopped applying, so
"file not found" was misread as "process dead" and a second instance was
started. Both appended to the same output file and both raced on the shared
neuron ledger.

```text
duplicate rows written:      979
neurons wasted:              ~819 (of a 10,000/day free allocation)
invalid vectors produced:    0    (validation layer held throughout)
source corpus integrity:     unaffected - independently re-confirmed
                             44,792 unique (documentId, chunkKey), 0 dupes
```

Remediation: output deduplicated and re-validated (1,048 unique valid records
retained), the ledger corrected *upward* to 5,819 so the wasted spend is
charged honestly against the day's cap rather than hidden, and a PID lockfile
added so the script refuses to start alongside a live instance while
reclaiming a stale lock after a hard kill. Both lock paths were tested
explicitly - the first refusal test was itself invalid (the planted PID had
already exited, so it silently exercised the reclaim path instead) and was
re-run against a genuinely live process.

Generalizable lesson: append-only output plus a shared budget ledger makes
concurrency actively harmful, so single-writer enforcement belongs in the code
rather than in operator discipline. And a missing log file is not evidence that
a process died - verify with `ps`.

## 8. Cloud/cost activity for this evaluation

```text
Cloudflare Workers AI:  ~3,800 neurons total across all verification work
                        (of 10,000/day free)
Gemini API calls:       0
Pinecone API calls:     1 read-only list_indexes
Convex Cloud calls:     0
Money spent:            $0
```
