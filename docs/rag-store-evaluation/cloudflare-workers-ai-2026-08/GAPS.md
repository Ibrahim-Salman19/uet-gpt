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
                              STATUS: adapter BUILT and its contract PROVEN
                              against the live model -
                              reranker-worker/worker.js plus wrangler.toml,
                              with reranker-worker/test_contract.py
                              reproducing the worker's exact mapping and
                              asserting shape, index/text alignment (a wrong
                              index would silently return the wrong passage),
                              descending order, and semantic correctness.
                              Test passes.
                              REMAINING: `wrangler deploy` (a cloud action
                              needing user approval) and setting RERANKER_URL.
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

## H. Corpus-quality finding: 17.1% duplicate chunk text

Surfaced while investigating repeated embedding fingerprints during
verification (6,710 distinct fingerprints across 7,324 records). The repeated
vectors are NOT degenerate embeddings - they are the correct output for
genuinely identical input text:

```text
embedded chunks sampled:  7,324
distinct texts:           6,656
rows with duplicate text: 1,252  (17.1%)

  x11  "Document Title: SocietyDetails | ## Official resources
        - [HEC Pakistan Higher Educ..."
  x4   "Document Title: Department of Software Engineering, UET Taxila..."
  x4   "Document Title: Building and Works Department, UET Taxila..."
```

So the embedding model is behaving correctly and this is not an integrity
failure. It IS a retrieval-quality issue: site-wide boilerplate (shared
"Official resources" blocks, repeated departmental preambles) is chunked once
per page, so a single query can retrieve the same text several times and crowd
genuinely diverse passages out of top-k. That directly reduces the useful
context reaching the LLM.

### Measured impact (measure_duplicate_impact.py, zero API cost)

Rather than assume the community's generic 20-30% rerank figure applies,
measured directly: 300 already-embedded chunks used as probes against the
already-embedded set, counting how many of each top-10 carried text
byte-identical to another result already in that same window.

```text
mean redundant slots:  0.93 / 10   (9.3% of the window)
median:                0
queries with >=1 dup:  94 / 300    (31.3%)
worst case:            9 of 10 slots redundant

distribution (redundant slots -> query count):
   0: ############################################ 206
   1: ###### 18
   2: ##### 16
   3: ########## 33
   4: ##### 16
   5: # 4
   6: ## 5
   7: 1
   9: 1
```

**The mean is misleading and the distribution is the finding.** 68.7% of
queries are entirely unaffected, which is why an average of "9%" understates
the harm badly. Among the 31.3% that ARE affected, the mean is ~3 redundant
slots - roughly **30% of the context window carrying no new information** - and
the tail reaches 9 of 10 slots wasted on a single repeated boilerplate block.

So this is not a uniform 9% tax; it is a small set of queries being severely
degraded while most are fine. That shape matters for the fix: a near-duplicate
filter is cheap insurance that does nothing for two-thirds of traffic and
rescues the third that is currently badly served. It also means any evaluation
averaging over a random query set will barely register the problem - the
regression must be measured on affected queries specifically, or it will look
like noise.

Not yet addressed. Options, cheapest first:

```text
(a) dedupe at upsert     collapse byte-identical chunk text to one vector,
                         keeping the documentId list as metadata. Cheapest,
                         and shrinks the index. Loses per-page attribution
                         unless the metadata is carried carefully.
(b) MMR / diversity      apply Maximal Marginal Relevance or a near-duplicate
    at retrieval         filter after fusion. Keeps attribution intact and is
                         the standard 2026 answer to redundant top-k.
(c) boilerplate strip    improve extraction so shared nav/footer blocks never
    at chunking          become chunks. Best long-term fix, but Corpus V1 is
                         frozen - this belongs to a future Corpus V2.
```

Recommendation: (b) for the current corpus since it needs no re-crawl and no
re-embed, plus (c) whenever Corpus V2 is built. Must be measured under the
retrieval-quality gates rather than assumed.

## I. Shared Cloudflare budget: reranking and embedding compete for one allocation

Discovered while live-testing `convex/reranking/cloudflareRerank.ts`: it hit
the actual daily neuron allocation (confirmed via direct API probe, code
4006 "you have used up your daily free allocation") because the corpus
embedding run was already using the SAME account's budget that day.

This is a real production concern, not just a testing inconvenience: if
reranking is ever wired into the live cascade while a corpus (re)embed is
running, query-time reranking can silently degrade to its position-decay
fallback for the duration - degraded quality with no error, no alert, in
production traffic. `cloudflareRerank.ts`'s fallback is safe (never throws,
never hangs) but the QUALITY regression itself is invisible unless someone is
watching for the fallback's exact score signature.

Not yet mitigated. Options: a second Cloudflare account/token dedicated to
reranking (clean separation, more to manage); a reserved sub-budget enforced
in application code (one shared account, artificial split); or accept the
risk and monitor for the fallback signature in production logs. Needs a
decision before this is wired into cascade.ts, not before it's used for
evaluation work (where an occasional degraded run is a nuisance, not a
production quality regression affecting real users).

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
