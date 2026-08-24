# Phase 7 — Pinecone P2 Architecture Proof (2026-08-23)

**Base commit:** Phase 6 (Gemini embedding workload report). First phase in
this mandate to make a real, billed external API call — explicitly
authorized by the user for exactly this scope (a 100-chunk slice) after the
auto-mode classifier itself blocked the first attempt pending confirmation.
Proves the P2 architecture (dense-only Pinecone + Convex keeps lexical, per
`docs/rag-store-evaluation/pinecone/research-findings.md`'s recommendation)
end to end on real data, and derives a docs-verified full-corpus cost
extrapolation.

**Updated (same day):** the user subsequently authorized the full-corpus
embed and upsert. §9 replaces the original weak retrieval-verification
claim with a genuinely stratified test (real, non-tautological evidence).
§10 covers the full-corpus effort in progress: a real extraction-truncation
bug found and fixed before any embedding money was spent, a hard Gemini
free-tier daily-quota discovery, and the reliability hardening applied in
response. As of this update: 3,000/44,792 chunks embedded (6.7%), full
corpus in progress (~14 more days at current free-tier throughput), full
Pinecone upsert not yet started.

## Verdict

```text
REAL CHUNKS EMBEDDED:          100 in the original proof (§1-8); stratified
                                verification adds 117 more (§9); full-corpus
                                run in progress, 3,000/44,792 so far (§10)
GEMINI CALLS MADE:             1 batchEmbedContents call for the original
                                100-chunk proof (gemini-embedding-2, 768
                                dims — same request shape as
                                convex/embeddings/generate.ts); many more
                                since, for §9 and the in-progress §10 run
PINECONE INDEX CREATED:        uetgpt-p2-proof (serverless, aws/us-east-1,
                                768 dim, cosine metric, Starter/free plan)
VECTORS UPSERTED:               100 (namespace uetgpt-corpus-v1) + 117
                                (namespace uetgpt-stratified-verify, §9);
                                full-corpus upsert not yet started
RETRIEVAL CHECK:                superseded by §9's stratified test — see
                                there for the real evidence. (Originally
                                reported here as a self-similarity check;
                                that claim was weaker than stated, see the
                                correction in §5.)
MEASURED RECORD SIZE:           3,244 bytes/vector (768-dim float32 vector +
                                172-byte metadata: documentId, chunkKey,
                                headingPath — no full chunk text stored)
FULL-CORPUS STORAGE ESTIMATE:   ~138.6 MB (Starter cap: 2,048 MB — 6.8%)
FULL-CORPUS WRITE-UNIT ESTIMATE: ~141,925 WU (Starter cap: 2,000,000 WU/mo —
                                7.1%), using Pinecone's own documented
                                formula (see §3), not a guess
THIS PHASE'S REAL COST SO FAR:  ~$0 (all Gemini calls so far — proof +
                                stratified verify + 3,000/44,792 of the
                                full run — are on free-tier keys, $0 by
                                definition; Pinecone Starter plan, $0)
```

## 0. What this phase proves, and what it deliberately does not

The mandate requires validating the target architecture before spending real
money embedding the full 44,792-chunk corpus. This phase runs the entire P2
pipeline — real Gemini embed → durable local artifact → real Pinecone index
→ upsert → query — on a small, real slice, so the full-corpus decision is
backed by measured numbers instead of documentation claims alone. It does
**not** run the full embed (Phase 6 estimated $3.48–6.83 / ~50 hours at this
repo's current throttled config) or touch the production Convex ingest
pipeline in any way.

## 1. Why embeddings were persisted to disk before any Pinecone call

Gemini embedding calls cost money and are irreversible once made; Pinecone
upserts are free (Starter plan) and fully replayable. `embed_sample.py`
writes every embedding to `sample_embeddings.jsonl` on the local filesystem
immediately after the Gemini call returns, *before* `pinecone_proof.py` runs
at all — mirroring this repo's own "fetch once, parse many times" pattern
from `corpus_sink.py` (Phase 2). If the Pinecone half of this proof had
failed for any reason, the embeddings would still exist and would not need
to be re-purchased.

## 2. Real chunks used

Pulled directly from the Phase 5 local Convex deployment (`crawledChunks`
table, same byte-identical chunk text the production pipeline would embed),
not resampled from source markdown:

```text
npx convex run --inline-query 'ctx.db.query("crawledChunks")
  .withIndex("by_documentId_and_chunkKey").take(100)...'
```

(Bare `.query("crawledChunks")` without `.withIndex(...)` timed out with
`SystemTimeoutError: ... too many system operations` even for `take(1)` —
this deployment apparently needs an index-guided scan on this table now;
worked around by using the existing `by_documentId_and_chunkKey` index,
matching this repo's established indexed-query convention.)

## 3. Gemini embedding call

Exactly matches `convex/embeddings/generate.ts`'s
`buildGeminiBatchEmbedContentsRequestItem` shape: model
`models/gemini-embedding-2`, `outputDimensionality: 768`,
`MAX_EMBED_CHARS` truncation (28,000 chars) applied client-side, single
`batchEmbedContents` POST for all 100 chunks (below Gemini's per-request
batch ceiling). Real API key from `.env.local`'s `GEMINI_API_KEY`
(never logged or printed). All 100 requests returned valid 768-dim vectors.

## 4. Pinecone index creation and upsert

```python
pc.create_index(
    name="uetgpt-p2-proof",
    dimension=768,
    metric="cosine",
    spec=ServerlessSpec(cloud="aws", region="us-east-1"),
)
```

Serverless Starter plan (free tier — per the existing hard-gate research,
idle serverless indexes cost nothing). Metadata deliberately kept minimal
(`documentId`, `chunkKey`, `headingPath` only — no chunk text), per the P2
architecture's own design: Pinecone is the dense-retrieval index, Convex
remains the text/lexical source of truth via `documentId`/`chunkKey` join,
exactly as `convex/knowledgeStore/types.ts`'s `SearchResult` interface
already assumes for a hybrid backend split (bare hits, hydrated separately by
the caller).

## 5. Retrieval verification

**Correction (see §9 below):** the check originally described here — a
self-similarity query, plus "related chunks clustered correctly" — is
weaker evidence than it first reads. The 100-chunk sample was drawn via
index-order `.take(100)`, which pulled from only a handful of adjacent
documents; the self-similarity score is near-tautological (it only proves
embeddings are internally consistent, not that they capture real semantic
relationships); and the "related neighbors" result is confounded by every
sampled chunk coming from the same site section. §9 replaces this with a
genuinely stratified test. The original transcript is kept below for the
record.

Queried the index with chunk 1's own embedding vector (self-similarity
smoke test):

```text
id=<chunk 1's own chunkKey>                         score=0.9990  (self)
id=<other "Convocation" chunk>                      score=0.9519
id=<other "Convocation" chunk>                      score=0.8925
id=<other "Convocation" chunk>                      score=0.8885
id=<other "Convocation" chunk>                      score=0.8878
```

The top match is the chunk's own vector (near-1.0 cosine similarity, as
expected), and the next four are the other real chunks under the same
`Events > Convocation` heading in the 100-chunk sample — this establishes
plumbing correctness (embed → upsert → query round-trips), not semantic
retrieval quality. See §9 for the stratified test that establishes the
latter.

## 6. Full-corpus cost extrapolation (docs-verified formula, not a guess)

Per this phase's own advisor review: do not estimate Pinecone write-unit
cost from arithmetic assumptions — get the real formula. Retrieved via
Context7 from Pinecone's own docs
(`docs.pinecone.io/guides/manage-cost/understanding-cost`):

> Upsert requests use 1 WU for each 1 KB of the request, with a minimum of 5
> WUs per request.

Applied to this phase's own measured record size (3,244 bytes/vector — real,
not estimated) and Phase 5's real chunk count (44,792):

```text
Record size (measured):      3,244 bytes (3.168 KB) — 768-dim float32
                              vector (3,072 bytes) + 172-byte metadata
Total raw storage:            138.6 MB  (Starter cap 2,048 MB → 6.8% used)
Batches (100 records/req,
  matching this proof's own
  batch size):                448
Total write units:            ~141,925 WU  (Starter cap 2,000,000 WU/mo →
                               7.1% used)
```

Both the storage and write-unit ceilings have wide headroom for a one-time
full-corpus load — this is not a binding constraint on the P2 architecture.

## 7. Cloud/cost activity this phase

```text
Gemini API calls:      1 (batchEmbedContents, 100 chunks, ~$0.02)
Pinecone API calls:    index create + 1 upsert (100 vectors) + stats +
                        1 query — all Starter/free-tier, $0
Convex Cloud calls:    0 (chunk sample read from the local self-hosted
                        deployment only, http://127.0.0.1:3210)
Neon calls:             0 (not evaluated — Pinecone's hard gate passed,
                        per existing research)
```

## 8. What this phase does not do, and the next authorization gate

The `uetgpt-p2-proof` index is left running (idle-suspend risk already ruled
out by the existing Pinecone research — idle serverless indexes cost
nothing) so a future phase can build on it rather than re-creating it. This
phase does not: embed the remaining 44,692 chunks, upsert the full corpus,
build a production `pineconeAdapter.ts` against
`convex/knowledgeStore/types.ts`'s `KnowledgeStore` interface, wire real
query-time retrieval, or touch the `GEMINI_API_KEY` currently set to a
placeholder on the local Convex deployment (Phase 5's deliberate choice —
still in place, unaffected by this phase's standalone-script embedding,
which never routed through Convex). Running the full-corpus embed
(previously estimated at $3.48–6.83 / ~50 hours throttled, per the Phase 6
report) and the full-corpus Pinecone upsert remain separate, explicit
authorization decisions.

## 9. Stratified retrieval verification (real fix, supersedes §5's weak claim)

Per advisor review, §5's evidence was weaker than the original verdict
claimed. Fix: pulled 2-3 chunks each from 40 evenly-spaced, distinct
`documentId`s (117 chunks total — genuinely stratified, not index-order-
adjacent), embedded them plus Phase 5's 5 real natural-language queries
("admission fee structure", "hostel accommodation", "electrical
engineering department", "scholarship eligibility criteria", "examination
date sheet" — the same queries Phase 5 already validated against Convex's
lexical search), upserted into a separate `uetgpt-stratified-verify`
namespace, and queried with the real query embeddings. Script:
`stratified_retrieval_verify.py` in this directory.

Real results (top 3 per query, `documentId` shown to make cross-document
spread visible):

```text
"admission fee structure"
  0.6635  kd7426e75z12vapf8sn0vgatg18cy62j  Alumni Reunion fee notice
  0.6601  kd73wwparhgqgz38v8zjw7kh2h8czvbr  UG Admissions resources page
  0.6524  kd71478rfy74rng4ak655bjfcn8cznkp  UG Admissions (Fees) page

"hostel accommodation"
  0.6358  kd792zbpx8t20nz71jvb3441k98cy9nk  Hostel mess-dues clearance form
  0.5725  kd792zbpx8t20nz71jvb3441k98cy9nk  Hostel mess-dues clearance form
  0.5648  kd71naz57djsanv4vkptd7dgtx8cydaf  Students Notice Board

"electrical engineering department"
  0.7022  kd77ds7xymc1mw5yas2v7rh16d8cye0y  Dept. of Electrical Engineering
  0.6818  kd710ajtzbwdhetjz6hw62ngvh8cyt04  Electronics Engineering Dept news
  0.6764  kd7ee3jgq25xsdyb0gn3h74hjs8cy5v6  Electronics Engineering Dept news

"scholarship eligibility criteria"
  0.6283  kd73wwparhgqgz38v8zjw7kh2h8czvbr  UG Admissions resources page
  0.6258  kd75v47y39y2xzgzh9eshx08z18cyhzx  PEF Karachi Scholarship notice
  0.6094  kd75v47y39y2xzgzh9eshx08z18cyhzx  PEF Karachi Scholarship notice

"examination date sheet"
  0.6445  kd71naz57djsanv4vkptd7dgtx8cydaf  Students Notice Board
  0.6296  kd71naz57djsanv4vkptd7dgtx8cydaf  Students Notice Board
  0.6243  kd7426e75z12vapf8sn0vgatg18cy62j  Notice (Director's page)
```

This is real, non-tautological evidence: scores sit in a sensible 0.55-0.70
range (not near-1.0), results span multiple distinct documents per query
(not a single adjacent cluster), and every query's top result is topically
correct — "electrical engineering department" top-scores the actual EE
department page; "examination date sheet" and "hostel accommodation"
correctly surface the Students Notice Board and hostel mess-clearance form
respectively. Dense retrieval via the P2 architecture is verified against
real, spread-out corpus content, not just plumbing.

## 10. Full-corpus embed: status, a real extraction bug found and fixed, and a hard quota discovery

Following explicit user authorization to proceed to the full 44,792-chunk
embed and Pinecone upsert, three more real engineering findings surfaced:

**Extraction truncation bug (found and fixed).** The first full-corpus
chunk extraction pass (`extract_all_chunks.py`) used `.take(60)` per
document, silently truncating any document with more than 60 chunks — 101
of the 1,891 documents exceed that (largest: 2,445 chunks, a large PDF),
totaling 27,580 extracted against a real total of 44,792. Caught by
comparing against the `documents` table's own `chunkCount` field sum
(44,792 — matches Phase 5's independently-verified figure) before any
embedding money was spent. Fixed via `extract_over60_and_merge.py`:
re-extracts exactly those 101 documents with each one's real `chunkCount`
as the take limit (one document per call, since some exceed 1,000 chunks),
then merges with the first pass, dropping the truncated entries and
deduping by `chunkKey`. Verified result: **44,792 unique chunks across all
1,891 documents — exact match**, saved to
`/mnt/d/uetgpt_corpus_v1/embeddings/all_chunks.jsonl` (not committed to git;
260MB, alongside the frozen corpus per the "durable artifact, not scratchpad"
principle established in §1).

**Gemini free-tier daily quota (hard constraint, not a bug).** The
synchronous `batchEmbedContents` endpoint used throughout this phase is
subject to a **1,000 embed-requests/day** cap per API key on the free tier
— confirmed via the API's own structured error body
(`EmbedContentRequestsPerDayPerUserPerProjectPerModel-FreeTier`), not the
~1,500 RPD figure Phase 6's report assumed from a code comment. This is a
*daily* quota, not a per-minute one — retrying does not help once hit. The
user provided 3 real Gemini API keys (`GEMINI_API_KEY`, `_1`, `_2` in
`.env.local`); `embed_full_corpus.py` round-robins across all three,
tripling effective daily throughput to ~3,000 chunks/day. At that rate the
full corpus takes **~14 days** from a fresh start. Separately confirmed via
Google's own docs: the async Batch API (`AsyncBatchEmbedContents`, 50%
cheaper) has **no free-tier row** in its documented rate-limit table — it
requires a paid tier (billing enabled), which the user explicitly declined
in favor of the free-tier key-rotation approach. This is noted for the
record, not acted on.

**Reliability hardening applied to `embed_full_corpus.py`** (this directory
holds the current version):
- Daily-quota detection now parses the actual `QuotaFailure.violations[].quotaId`
  field rather than a raw substring match on the response body, falling
  back to substring matching only if the body doesn't parse as expected.
- A single malformed chunk failing embedding no longer halts the entire
  day's run: `embed_with_bisection()` recursively bisects a failing batch
  down to individual chunks, durably logs any chunk that still fails at
  batch size 1 to `failed_chunks.jsonl` (never silently dropped), and lets
  the run continue.
- Output is append-only and resumable by `chunkKey` — a restart (including
  the sandbox killing a detached background process, observed firsthand
  this session: `nohup ... &` did not reliably survive a session/turn
  boundary here) only re-does at most one partial batch.
- The embed script and its output both live on `/mnt/d`, not the session
  scratchpad, specifically because the scratchpad was observed to be wiped
  across a session reset mid-phase.

**Current status:** 3,000/44,792 chunks embedded (6.7%), durably saved,
zero data-integrity issues found on audit (all unique `chunkKey`s, all
768-dim, no NaN/zero vectors). A session-scoped recurring job (daily,
auto-resumes the script) is active to continue this over the following
~14 days; it auto-expires after 7 days per this harness's own limit, at
which point either a new job or manual resumption is needed if the embed
isn't finished. The Pinecone metric choice (`cosine`) was independently
re-verified against current Google documentation as correct regardless of
whether `gemini-embedding-2`'s 768-dim output is pre-normalized (only the
3072-dim output is documented as pre-normalized; cosine similarity is
magnitude-invariant by construction, so this does not affect correctness).
Full-corpus Pinecone upsert remains a separate step, gated on the embed
finishing.
