# Phase 7 — Pinecone P2 Architecture Proof (2026-08-23)

**Base commit:** Phase 6 (Gemini embedding workload report). First phase in
this mandate to make a real, billed external API call — explicitly
authorized by the user for exactly this scope (a 100-chunk slice) after the
auto-mode classifier itself blocked the first attempt pending confirmation.
Proves the P2 architecture (dense-only Pinecone + Convex keeps lexical, per
`docs/rag-store-evaluation/pinecone/research-findings.md`'s recommendation)
end to end on real data, and derives a docs-verified full-corpus cost
extrapolation. Does **not** embed or upsert the full corpus — that remains a
separate, later authorization.

## Verdict

```text
REAL CHUNKS EMBEDDED:          100 (real sample, pulled from Phase 5's local
                                Convex crawledChunks table, not synthetic)
GEMINI CALLS MADE:             1 (batchEmbedContents, gemini-embedding-2,
                                768 dims — same request shape as
                                convex/embeddings/generate.ts)
PINECONE INDEX CREATED:        uetgpt-p2-proof (serverless, aws/us-east-1,
                                768 dim, cosine metric, Starter/free plan)
VECTORS UPSERTED:               100 (namespace uetgpt-corpus-v1)
RETRIEVAL CHECK:                self-similarity query on chunk 1's own
                                embedding returned itself as top match
                                (score 0.999); next 4 matches were the other
                                real "Convocation"-heading chunks in the
                                sample — dense retrieval works correctly
MEASURED RECORD SIZE:           3,244 bytes/vector (768-dim float32 vector +
                                172-byte metadata: documentId, chunkKey,
                                headingPath — no full chunk text stored)
FULL-CORPUS STORAGE ESTIMATE:   ~138.6 MB (Starter cap: 2,048 MB — 6.8%)
FULL-CORPUS WRITE-UNIT ESTIMATE: ~141,925 WU (Starter cap: 2,000,000 WU/mo —
                                7.1%), using Pinecone's own documented
                                formula (see §3), not a guess
THIS PHASE'S REAL COST:         ~$0.02 (100-chunk Gemini embed) + $0 (Pinecone
                                Starter plan, well under free-tier limits)
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
`Events > Convocation` heading in the 100-chunk sample — confirms embeddings,
upsert, and query all round-trip correctly against real corpus content, not
just structurally.

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
