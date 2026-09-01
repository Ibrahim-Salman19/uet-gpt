# Pinecone full-corpus upsert - authorization request (mandate §51)

**Status: STOP - awaiting explicit user authorization. Nothing in this file has been executed.**
No index created (one already exists, empty), no vector uploaded, no benchmark query issued as
part of producing this report. Written 2026-08-29 in response to the active session goal
("follow the plan, highest quality") after confirming items §44/§56/§45-46-57 are blocked on
this exact gate, and that mandate §51 + project CLAUDE.md both require a separate, explicit
authorization before this specific action - not something "follow the plan" can self-authorize.

## Why this file exists instead of just doing the upsert

Mandate §51: "Before creating index / uploading vector / issuing benchmark queries... report...
then ask for explicit authorization. No Pinecone credential should be requested in chat."
Project CLAUDE.md: "Do not assume 'continue' or 'test this' authorizes... any cloud operation
beyond what was explicitly scoped - each is a separate authorization." Both predate this session
and apply regardless of how urgently the goal hook wants forward progress - executing this
without asking would be a *lower*-fidelity execution of the plan, not a higher one.

## Index config

```text
Index name:        uetgpt-corpus-v1-qwen1024   (already exists - created during
                                                 pineconeAdapter-live-test.ts,
                                                 confirmed 0 vectors as of last check)
Dimension:          1024   (qwen3-embedding-0.6b - NOT the mandate §49's stated 768;
                            see INDEPENDENT_REVIEW.md's §35 supersession note)
Metric:              cosine
Vector type:         dense
Namespace:           corpus-v1-full   (RECOMMENDED, not yet created - keeps this real
                                       upsert separable from any future benchmark/test
                                       namespace in the same index; the index name
                                       itself already encodes corpus-version + model
                                       identity per §50's intent, so a hash-suffixed
                                       namespace name adds little beyond what the
                                       index name already provides)
```

## Vector count and payload size

```text
Vector count:              44,792   (= frozen Corpus V1 chunk count, exact)
Metadata shape (per vector, from pineconeAdapter.ts:173, source-confirmed,
  NOT the chunk text - §49's "identity + filter fields only" is followed,
  text stays in local/Convex canonical storage):
    documentId   32 hex chars (Convex ID)
    chunkKey     64 hex chars
    category     string, exact length not directly measured - 20 chars used
                 below as a conservative estimate, flagged as such
    generation   integer
  -> ~182 bytes/vector metadata (measured via json.dumps on a real sample)
Vector ID:                  64 hex chars (computeRagVersionKey = sha256Hex output,
                            confirmed from convex/crawl/chunkKey.ts:116-121)
Raw vector payload:         1024 x float32 = 4,096 bytes/vector

ESTIMATED VECTOR+METADATA BYTES (raw payload lower bound, MEASURED_LOCAL
  computation from real field lengths, NOT Pinecone's actual billed/indexed
  size - HNSW/index-structure overhead is unmeasured and NOT included):

  1x (44,792 vectors):  194,486,864 bytes = 185.5 MB = 0.181 GB
  2x (89,584 vectors):  388,973,728 bytes = 371.0 MB = 0.362 GB
  3x (134,376 vectors): 583,460,592 bytes = 556.4 MB = 0.543 GB

Starter serverless storage limit: 2 GB (OFFICIAL_VENDOR_FACT,
  pinecone/research-findings.json). Even 3x raw payload (556.4MB) leaves
  meaningful headroom under 2GB - a materially more comfortable picture
  than the Convex lexical-only finding (local-convex-lexical-proof-2026-08
  report.md §7: 247.3MB content-only at 1x, no headroom by 2x). This is a
  lower bound, not a guarantee: real Pinecone serverless storage includes
  index-structure overhead this estimate does not measure or model. Per
  §62's own instruction not to rely solely on raw vector-byte arithmetic,
  this projection should be treated as directionally comfortable, not
  precisely bounded.
```

## Expected write/read workload

```text
Expected write units:  ~44,792 (1 WU/upserted record is an ASSUMPTION, not
                        a confirmed Pinecone billing fact from the research
                        file read for this report - flagged as such). Even
                        at 10x that assumption's plausible error margin,
                        nowhere near the 2,000,000/mo Starter WU ceiling
                        (OFFICIAL_VENDOR_FACT) for a single one-time upsert.
Upsert batching:        Starter max 1000 records or 2MB/request, whichever
                        binds first (OFFICIAL_VENDOR_FACT). CORRECTED after
                        measuring real serialized payloads (the ~4,278-byte
                        estimate above assumed raw binary floats; the SDK
                        actually JSON-serializes each float as verbose
                        decimal text - e.g. "-0.010189768858253956" - which
                        measured ~22,990 bytes/record on 200 real corpus
                        records, ~5.4x larger than the raw-binary estimate).
                        Real safe batch size: 73 records (85% margin under
                        2MB / measured max record size), used at 60/batch
                        for extra margin -> ~747 requests for the full
                        corpus. This does NOT change the storage projection
                        below - Pinecone's actual index storage is
                        overwhelmingly likely to be a compact binary
                        representation, not the verbose JSON text used only
                        for the wire request - but it does mean the request-
                        batching math above was wrong before being measured,
                        exactly the kind of silent-corruption risk being
                        guarded against here.
Expected read workload: benchmark queries only (see below) - no read
                        workload from the upsert itself.
```

## Benchmark queries planned (after upsert, not part of this authorization request alone)

```text
Number of benchmark queries:  50 (scripts/eval/golden_set.jsonl, once
                               query embedding clears its current
                               Cloudflare quota block)
Query type:                    ANN Recall@{5,10,20} vs. exact-cosine ground
                               truth (mandate §56) - needs NO relevance
                               labels, self-referential, will be a real
                               number regardless of the labeling-gap issue
                               below.
                               Retrieval-quality metrics (§45 Layer B/C/D,
                               §57 HitRate/MRR/nDCG) DO need labels - see
                               "Open decision" below.
```

## Lifecycle / delete tests

```text
Lifecycle test writes:   NOT part of this authorization request. Mandate
                          §58-61's 7-scenario lifecycle matrix + concurrent-
                          generation torture test already ran and PASSED
                          (pinecone-p2-proof-2026-08/lifecycle-matrix-
                          report.md) - against the OLDER 768d
                          uetgpt-p2-proof index, not yet re-run against
                          uetgpt-corpus-v1-qwen1024. Re-running that matrix
                          against the real index is a SEPARATE, smaller
                          authorization question from the full-corpus
                          upsert - not bundled into this request. If
                          authorized together, lifecycle writes would use a
                          throwaway namespace (e.g. lifecycle-recheck),
                          deleted after, not the corpus-v1-full namespace.
Delete tests:             None planned against corpus-v1-full itself as
                          part of this request - the only deletes in scope
                          are the lifecycle-recheck namespace above, if
                          separately authorized.
```

## Resource budget / stop conditions

```text
Money:                    $0 - Starter free tier only, no upgrade
Requests:                 ~96-200 upsert requests (batch-size dependent,
                          conservative concurrency per §53) + 50 benchmark
                          queries + ~5 verification fetch-by-id spot checks
                          (§55)
Stop conditions:          - Any 429 sustained past bounded exponential
                            backoff -> stop, report, do not force through
                          - Vector count after upload != 44,792 -> stop,
                            do not proceed to benchmarking, investigate
                          - Any write lands in a namespace other than
                            corpus-v1-full -> stop immediately, that is a
                            bug, not a retry-able condition
                          - Storage/WU approaching either Starter ceiling
                            (2GB / 2M WU) -> stop and re-report; not
                            expected given the projections above, but not
                            assumed away either
```

## Decision made 2026-08-29: real labels first, §45/§57/§63 PAUSED

Asked directly via AskUserQuestion: "invest in real labeled queries first" vs. proceed with the
existing set relabeled. User chose **invest in real labeled queries first**. This is a made
decision, not an open question: §45 (Layer B/C/D), §57 (HitRate/MRR/nDCG), and §63's "retrieval
quality acceptable" gate are PAUSED pending a real HUMAN_VERIFIED query/label set - not attempted,
not approximated with the existing golden_set.jsonl/stage_e query sets, until that set exists.
Building that set requires the user's own domain review and is not something this session
manufactures unilaterally (§47/§57). §56 (ANN Recall@10 vs. exact ground truth) is UNAFFECTED -
it needs no labels and proceeds normally once query embedding and the corpus upsert both
complete.

## What authorization actually unlocks

Given the go-ahead, this session would: batch-upsert the 44,792 frozen vectors into the
`corpus-v1-full` namespace of the existing `uetgpt-corpus-v1-qwen1024` index (§52-53 batching/
concurrency discipline), verify count/spot-check correctness (§55), wait for LSN-confirmed write
visibility rather than a fixed sleep (§54), then run the ANN Recall@10 gate (§56) against the
exact local ground truth once query embedding clears its Cloudflare quota block. That is the
next concrete step this session is ready to execute the moment it is authorized.
