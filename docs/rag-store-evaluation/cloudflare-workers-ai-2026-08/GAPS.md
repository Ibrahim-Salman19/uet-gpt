# Gap register - UETGPT retrieval pipeline (2026-08-24)

Every known gap, with its blocker and what would close it. Written to be
falsifiable: a gap is only "closed" if there is evidence in this directory or
in the repo that closes it, not because it seems fine.

## A. Closed, with evidence

```text
GAP                              CLOSED BY                          EVIDENCE
embedding backend choice         measured bake-off on our corpus    report.md §4
  (not vendor reputation)        R@1/R@5/MRR, 1000 chunks/1000 docs quality-bakeoff-run.log
silent truncation risk           appended-marker + prefix-sweep     report.md §3
                                 test; disqualified 2 models        cf_dilution_control.py
cost/throughput estimate         measured cf-ai-neurons header on   report.md §2
  (an earlier estimate was       random AND stratified samples;
   6x wrong - see §2)            corrected in place
ingest idempotency               documentId+chunkKey identity,      cf_embed_corpus.py
                                 resume verified against a real
                                 interruption
ingest robustness                char-budgeted batching, split-on-  cf_embed_corpus.py
                                 400, retry-after backoff,
                                 fsync per batch, atomic state
silent-corruption defence        per-vector dim/finite/norm         cf_embed_corpus.py
                                 validation before write;           verify_embeddings.py
                                 count-mismatch guard
concurrent-writer bug            PID lockfile; BOTH paths tested    report.md §9
                                 (refuse on live pid, reclaim
                                 stale)
daily resumption                 cron 66497bff, 6:13 AM local       CronList
stale Gemini cron                deleted (job 7af5191d) - it would  n/a
                                 have run the abandoned pipeline
reranker viability               functionally verified, not just    report.md §6a
                                 catalog-listed; quality probe +
                                 cost table measured
completeness tooling             verify_embeddings.py, exercised    verify_embeddings.py
                                 against partial output (correctly
                                 FAILS on incomplete corpus)
evidence durability              committed to git (b0920c5)         git log
```

## B. Open - blocked only on elapsed time (automated, no decision needed)

```text
corpus embedding completion   3,506 / 44,792 as of writing. ~2.8 days at the
                              9,500-neuron/day self-imposed cap. Cron resumes
                              daily; script is idempotent so manual re-runs are
                              always safe.
                              CLOSES WHEN: verify_embeddings.py exits 0.
```

## C. Open - blocked on the corpus completing

```text
Pinecone 1024-dim index       Current index uetgpt-p2-proof is 768-dim and
                              cannot hold qwen3 vectors. Needs a new index at
                              dimension=1024, cosine, aws/us-east-1.
                              Sizing is fine: 44,792 x 1024 x 4B = ~183MB
                              against the 2GB Starter cap.
                              STATUS: creation attempt was BLOCKED by the
                              permission classifier (cloud resource creation).
                              NEEDS: user approval to run the create, or the
                              user creates it in the Pinecone console.
                              The free-plan index-count limit is therefore
                              still unconfirmed.
ANN recall benchmark          Mandate gate: Recall@10 >= 0.98 vs exact cosine
                              ground truth. Needs the full vector set.
hybrid retrieval evaluation   Mandate gate. Needs BOTH the vectors and a
                              working Convex deployment for the lexical side
                              (see D) - these two blockers converge.
reranker integration          FINDING: the retrieval architecture is ALREADY
                              best-practice - convex/embeddings/search.ts does
                              3-way RRF fusion with RRF_K = 60 (exactly the
                              community-standard constant) over overfetched
                              candidate pools, and convex/reranking/cascade.ts
                              implements a tiered reranker with a bounded
                              5s timeout and graceful degradation. A previous
                              generative-JSON Groq reranker was deliberately
                              removed with the correct reasoning recorded
                              in-code ("reranking should use dedicated
                              rerankers, not ask an LLM to manufacture a JSON
                              ranking").

                              BUT IT IS CURRENTLY INERT: neither RERANKER_URL
                              nor COHERE_API_KEY is set, so every query falls
                              through Tier 2 and Tier 3 to the Tier-1
                              word-overlap heuristic. No cross-encoder
                              reranking runs in production today. This is the
                              single largest available quality gain.

                              CLOSING PLAN: @cf/baai/bge-reranker-base is
                              verified working and free (report.md §6a). The
                              contracts differ and need a thin adapter:
                                cascade expects  POST {RERANKER_URL}/rerank
                                                 {query, documents:[str],
                                                  top_n}
                                                 -> [{index, score, text}]
                                Cloudflare gives POST .../ai/run/@cf/baai/
                                                 bge-reranker-base
                                                 {query, contexts:[{text}]}
                                                 -> {result:{response:
                                                     [{id,score}]}}
                              A small Cloudflare Worker exposing /rerank in the
                              expected shape is the natural fit (it already
                              lives on the same account), and needs no change
                              to cascade.ts at all - only the RERANKER_URL env
                              var. That keeps the production code path
                              untouched, which matters given E below.
                              Budget: CASCADE_CONFIG.tier2CandidateCount is 15,
                              so ~7,500 tokens/query = ~2.1 neurons = roughly
                              4,700 reranked queries/day inside the free tier.
                              Comfortably affordable.
                              Must still be benchmarked under the mandate's
                              retrieval-quality gates rather than adopted on
                              reputation.
```

## D. Open - blocked on user action only (I cannot resolve these)

```text
Convex production outage      adamant-stork-623 is DISABLED for exceeding
                              free-plan limits; this is why live UETGPT is
                              down. rugged-bird-156 separately reported over
                              IO/egress. confident-viper-402 errors on
                              users:getByClerkId.
                              NEEDS: a dashboard/billing decision. I cannot
                              fix quota or billing, and the mandate forbids
                              creating another deployment to route around it.
                              This also blocks the hybrid-retrieval gate in C.
```

## E. Open - behind the mandate's independent-review gate (deliberately not done)

```text
convex/embeddings/dimension.ts   768 -> 1024
convex/embeddings/generate.ts    query path Gemini -> Cloudflare
production cutover               mandate §68/§73: a passing benchmark does NOT
                                 authorize cutover, and Agent A must not
                                 self-certify.
```

## F. Open - deliberately not built (scope, not oversight)

```text
drift detection                 Recommended by 2026 practice for long-running
                                embedding systems. Not built.
dual-write model migration      Only relevant when changing embedding model
                                again. Not built.
incremental freshness/re-crawl  Corpus V1 is a frozen snapshot; the mandate
                                specifies source changes create Corpus V2
                                rather than mutating V1. No scheduled refresh
                                exists. The crawler does NOT send conditional
                                GET (no If-None-Match/If-Modified-Since)
                                despite storing etag/last_modified, so a
                                refresh currently means a full re-fetch.
                                Chunk-level contentHash DOES exist, so
                                delta-embedding only changed chunks is
                                straightforward once a refresh path is built.
```

## G. Known-unreliable inputs (standing cautions)

```text
Cloudflare model catalog metadata   Misreports bge-base-en-v1.5 as a 153,600-
                                    token context; it is capped at 512.
                                    Verify empirically, always.
published model leaderboards        Claimed BGE-M3 roughly doubles
                                    Qwen3-0.6B's hit rate; on our corpus they
                                    are statistically tied. Measure on target
                                    data.
chars/token heuristics              This corpus runs ~1.6 chars/token, not the
                                    conventional ~4. Estimates built on
                                    chars/4 are ~2.5x optimistic here.
small convenience samples           A 10-chunk sample produced a 6x-wrong cost
                                    projection. Use random/stratified samples.
"process must be dead"              A missing log file is not evidence.
                                    Verify with ps.
```
