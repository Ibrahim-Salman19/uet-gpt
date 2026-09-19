# UET GPT — Chatbot Accuracy Audit

**Date:** 2026-09-18
**Auditor:** automated audit agent (read-only)
**Deployment audited:** Convex prod `modest-peacock-120` (live corpus), plus the offline answer harness over `local_corpus_pilot/documents.jsonl`
**Raw run outputs:** `/tmp/claude-0/-mnt-c-Users-hafiz-UETGPT/1ca54e80-3133-4cf7-8f56-386518230365/scratchpad/`
(`aa_batch1..4.json`, `axisB_results.json`, `axisB.ts`, `feeprobe.ts`)

## STATUS INDEX — as of 2026-09-19 (read this first)

This document grew across a long remediation session. What follows is where things actually stand, so
nobody re-derives it from 21 sections.

**Shipped and live in production** (Vercel, verified by deployment alias each time):

| fix | where | section |
|---|---|---|
| a forced CRAG run can never refuse | `rag/retrieval.ts` | §13 |
| cached refusals rejected on read *and* write | `cache/get.ts`, `chat/cache.ts` | §12 |
| answers lead with the facts they have | `lib/prompt.ts` | §13 |
| assistant replies survive a Clerk token refresh | `hooks/use-chat.ts` | — |
| long answers are no longer cut off mid-stream | `hooks/use-chat.ts` | — |
| answers truncated at `maxOutputTokens` are never cached | `chat/stream.ts` | — |
| a "fresh" label can no longer pass an old edition off as current | `lib/prompt.ts` | §18.3 |
| long conversations no longer brick themselves | `chat/validate.ts` | §21 |

**Committed but NOT deployed** — `npx convex deploy` is refused by the auto-mode classifier:

| fix | section |
|---|---|
| Roman Urdu questions can reach a verified FAQ *(user-facing)* | §20 |
| duplicate `ragId` cannot crash a chunk lookup | §15.3 |
| the eval harness gates FAQs as production does | §19 |
| a bounded read-only scoping query for the F-9 rows | §15.4 |

**Open, needing a decision rather than more work:**

1. `INTERNAL_API_SECRET` is absent from **both** Vercel and Convex, so the semantic cache has never
   written an entry and every question runs the full pipeline (§16). Two places, one value.
2. F-9: proof-of-concept rows from a local-dev experiment are live in the production corpus and being
   served (§15). Scope it with the queued query before deleting or hiding anything.
3. The golden set cannot see FAQ-channel answers at all, so recall deltas cannot justify retrieval work
   until it can (§17, §19). Needs labelling judgment, not code.
4. W4 `lifecycleStatus` backfill — 1,891 rows, dry-run first.

**Measured and REJECTED** — each was built or probed, and the evidence is recorded so none is rebuilt
on the strength of sounding right: the F-4 reranker formula (§14), nav-chunk demotion (§17.4),
page-level label scoring (§17.3), a `Source year` context header (§18.4), edition-aware freshness
(§18.5), and the Dice FAQ normalisation (§20.3 — promising, but evidence too thin to ship).

**Standing caveat on every number here.** Production served **no real user traffic** during this
session — the logs contain only this work's own probes — so the live fixes are deployed and
unit-tested, never observed on a real request.

**Partially closed by bundle inspection (read-only, no writes, no quota).** Fetching the deployed chat
route's JavaScript confirms the client-side fix is physically present in what production serves:
`/_next/static/chunks/12060k27muzl..js` contains `"Authentication required"` — the literal introduced by
`isAuthRefreshRace` in `df9f416` — alongside `"socket hang up"` and `"optimistic concurrency"`, the
pre-existing `isTransientError` strings, which identifies the chunk as `src/lib/retry.ts` carrying the
new predicate. This raises the auth-race retry from "the deploy command exited 0" to "the code is in the
served bundle".

It does **not** extend to the rest. The streaming deadline has no distinctive string literal, and the
truncation guard (`chat/stream.ts`), the history trim (`chat/validate.ts`) and the prompt changes
(`lib/prompt.ts`) are server-side and never reach a client bundle.

**An unauthenticated probe was attempted for the history trim, and is structurally impossible.** The
idea was sound: `src/app/api/chat/route.ts` runs `validateRequestPhase` **before**
`authAndRateLimitPhase`, so an oversized-but-trimmable body would be judged by the new code and only
then rejected by auth — distinguishing the old `413 Request body too large` from the new behaviour with
no write, no session and no LLM call. `checkCsrf` even admits `Sec-Fetch-Site: same-origin`.

It cannot work. Clerk middleware intercepts first: both a small control body and a 42,025-character
oversized body return `307` to `/sign-in`, with `x-clerk-auth-reason: session-token-and-uat-missing`.
`src/middleware.ts`'s matcher covers `/(api|trpc)(.*)` and exempts only `/api/webhooks`, `/api/health`
and `/api/cron`, so **no unauthenticated request reaches the route handler at all.**

The verification gap for server-side behaviour is therefore structural, not a matter of ingenuity: it
requires a real Clerk session, which requires the Playwright path below, which writes production data
under a real person's identity.

**How to close that gap (deliberately not run).** The only thing in this repo that can exercise the true
authenticated path is the Playwright suite: `retrieveContext` requires a Clerk identity and a Convex
deploy key cannot supply one (`convex/rag/smokeRetrieval.ts:5-8`), but `tests/e2e/global.setup.ts` signs
in through real Clerk, and `playwright.config.ts` takes `PLAYWRIGHT_TEST_BASE_URL`, so it can be aimed
at production:

```
PLAYWRIGHT_TEST_BASE_URL=https://uet-gpt.vercel.app npx playwright test tests/e2e/chat-flow.spec.ts
```

This was **not** run here, and the reason is not timidity about tests. `global.setup.ts` authenticates as
`ibrahim.pk848@gmail.com` — a real person's account — so against production it writes real threads and
messages into the production database under that identity, and spends Groq quota from the same budget
that rate-limited the live bot for ~24h on 2026-09-15. Creating data in production under someone's
personal identity is the owner's call, not an agent's.

Worth adding when it is run, per the original plan's Workstream 2: ask the fee question and assert the
reply is not the refusal string. That single assertion is the only end-to-end check that would confirm
the eight live fixes on the real path. Note `playwright.config.ts`'s `webServer` block still points at
`localhost:3001`, so aiming at production needs that skipped or the local server running alongside.

> **Three separate numbers, never collapsed.** Retrieval accuracy, answer accuracy, and ground-truth
> integrity are reported as independent axes. A single headline "accuracy %" for this system would be
> meaningless, because ~39% of the scoreable eval set rests on ground truth the project itself has
> marked UNCONFIRMED.

---

## 0. Executive summary

| Axis | Measured result | Basis |
|---|---|---|
| **A — Answer-layer accuracy** | **19 / 19 cases pass** on the current prompt path (10 answerable, 5 not-in-sources, 1 stale-value, 2 no-context, 1 refuse-directive). **0 over-refusals. 0 hallucinated figures.** | 38 Gemini generations, harness `scripts/eval/answer-accuracy/run.ts`, hand-graded against `cases.ts` rubrics |
| **A (regression delta)** | Old prompt path: **17 / 19**. The 2 failures are exactly the class the new prompt was built to stop — `no-context-vc` invented a Vice Chancellor's name from general knowledge. | same run, `old` arm |
| **B — Retrieval accuracy** | **recall@8 = 8/10 mechanical (9/10 after manual verification); recall@4 = 7/10 mechanical (8/10 verified).** 1 genuine rerank loss. | 10 stratified golden queries, live prod, production call shape |
| **C — Ground-truth integrity** | **27 / 50** golden entries have **zero** labelled relevant chunks (unscoreable). Of the 23 scoreable, **9 (39%)** carry contested / UNCONFIRMED / corrected provenance. | `scripts/eval/golden_set_verified.jsonl` |

**The three findings that matter most, none of which were previously known:**

1. **F-1 (Critical).** On the flagship fee query the reranker puts **three postgraduate (M.Sc./Ph.D.)
   fee tables above the correct undergraduate answer**, scores the top one 0.850 — which **skips CRAG
   entirely** — and labels every one of them `freshnessState=fresh, applicability=current`. The answer
   model is therefore told, by trusted metadata, that an MSc fee table is a current source for a BS
   question, with no relevance safety net. §3.3
2. **F-5 (Critical).** The **semantic cache has no refusal guard, and a cached refusal is the most
   durable object in the system**: it gets the *longest* TTL (5 days) precisely because it cites no
   sources, and `findSourceInvalidation` returns `null` on its first line for a zero-source entry — so
   it is **structurally immune to invalidation** and survives a re-crawl that adds the very content
   whose absence caused the refusal. One transient CRAG misfire poisons a 0.92-cosine neighbourhood of
   question space for 5 days. Fix is one clause. §5.1
3. **F-3 (High).** The **document-lifecycle gate is a no-op across the entire corpus.**
   `lifecycleStatus` and `isStale` are absent on **all 1,891 documents**, and
   `isRetrievalEligibleLifecycle(undefined)` returns `true`. 13 URL families hold multiple year
   editions simultaneously (including `UET-Prospectus-2024.pdf` *and* `2025.pdf`, and 14 editions of
   the IEEE annual report). This is the root cause of the reported hostel-fee edition gap, and it was
   observed live: the `contact number` query's top 2 results are both chunks of a **2021** IEEE
   student-branch annual report. §5.2

---

## 1. Method, scope and limitations

### 1.1 Probe shape (the trap this audit had to avoid)

Production's path is
`retrieveContext` (`convex/rag/retrieval.ts:562`) → condense → intent classify → `enrichQuery` →
semantic cache → `searchVectorDB` → `rerankSearchResults` → CRAG (conditional) → `buildContext` → answer model.

The Axis-B probe (`scratchpad/axisB.ts`) reuses the reviewed live shape from
`scripts/eval/verify_retrieval_fixes.cjs` exactly:

* reranks on the **rewritten** query (`convex/rag/retrieval.ts:236` passes `query: rewrittenQuery || safeQuestion`);
* passes `hydeQuery` **explicitly** to `searchDocumentsAction`, so query length cannot silently switch
  a query between 2 and 3 retrieval channels (`convex/embeddings/search.ts:258`);
* confirmed against the source that production's `enrichQuery` (`convex/rag/retrieval.ts:115`)
  generates HyDE **unconditionally**, so `search.ts`'s `wordCount > 15` auto-HyDE branch is dead code
  for the chat path.

**Deliberate substitution (disclosed):** rewrite and HyDE were generated locally on
`gemini-3.5-flash-lite` using the **current** `convex/rag/routing.ts` prompts verbatim, then passed
through the real `sanitizeRewrittenQuery`. `rewriteQueryAction` / `hydeQueryAction` run on
`getTextModelChain()`, whose primary is Groq (`convex/rag/modelRegistry.ts:78`) — the quota that serves
live traffic. This is the same substitution `scripts/eval/retrieval-ab/run.ts` documents and uses.
`gemini-3.5-flash-lite` is that chain's own fallback tier, not a foreign model.

**CRAG was not invoked** (`evaluateChunks` is also Groq-primary). `topRerankScore` vs
`CRAG_CONFIG.skipThreshold = 0.6` is recorded instead, so every "CRAG would/​would not run" statement in
this report is **estimated**, not measured.

### 1.2 What was skipped, and why (computed, not assumed)

| Harness | Decision | Computed reason |
|---|---|---|
| `scripts/eval/retrieval-ab/run.ts` | **Skipped** | Its golden path is hardcoded (`resolve(ROOT, "scripts/eval/golden_set_verified.jsonl")`, line 432) and it has **no `--only` flag**, so it cannot be subset without editing a project file. It would score **23** queries (computed locally: entries with ≥1 `relevantChunkKeys` whose `label_review.md` snippet survives the ≥25-char filter) at **2 LLM calls/query for enrichment = 46 calls**, plus ~13 prod channel calls/query (4 lexical queries + 3 × [cfEmbed + denseSearch + refsToRag]). 46 calls alone would blow the 60-call fence on top of Axis A. |
| `scripts/eval/verify_retrieval_fixes.cjs` | **Skipped as a run; audited as an artefact** | ~17 LLM calls through `getTextModelChain()` (Groq-primary) — the exact quota fence #1 protects. Its *content* produced finding **F-7** (§5.5) at zero cost. |
| `pnpm test` | **Not re-run** | The stated baseline is already captured in this session's `scratchpad/full_run.json`: `numTotalTests: 496, numPassedTests: 492, numFailedTests: 4, numFailedTestSuites: 4`. Matches the given baseline (the file counts 203 *suites*, the baseline quotes 76 *files* — same run, different unit). **No delta introduced; nothing was modified.** |

### 1.3 Measured vs estimated

* **Measured:** all Axis A generated text; all Axis B recall/rank/score numbers; all corpus statistics
  in §5.2–5.4 (computed over the full 44,792-row / 1,891-row exports); all code behaviour cited by file:line.
* **Estimated:** "CRAG would run" flags (§1.1); prod Database-Storage attribution (§5.4) — derived from
  the 2026-09-05 `.convex-tmp/table-export/` snapshot of the migration source, not from the prod dashboard.
* **Unverified:** whether prod's `KNOWLEDGE_STORE_BACKEND` is `pinecone` (inferred from
  `retrieval-ab/run.ts`'s docstring, not read from the deployment).

### 1.4 Limitations

* The Convex dashboard is behind a WorkOS sign-in that was **not** used. §5.4 is a code/export-derived
  estimate and does **not** reconcile to the reported 874.71 MB.
* `retrieveContext` was **not** called (it writes semantic-cache entries; previously denied by the
  permission classifier). Every retrieval measurement therefore reconstructs the pipeline stage by
  stage rather than invoking the public action.
* Axis A is **offline by construction** — it holds retrieval fixed on pilot-corpus pages and varies only
  what the answer model sees. It measures the *answer layer*. It does **not** measure what production
  retrieval actually feeds that layer; §3 does.
* Single sample per case (`--samples 1`). The answer model is at `temperature: 0.3`, so per-case
  results are indicative, not a stable rate.

---

## 2. Axis A — Answer-layer accuracy (centerpiece)

**Command (4 batches, `--samples 1 --no-judge`, Gemini default provider):**

```
node_modules/.bin/tsx scripts/eval/answer-accuracy/run.ts --samples 1 --no-judge \
  --only <ids> --out <scratchpad>/aa_batchN.json
```

> `--no-judge` hard-codes `correct: false`, so the printed `correctRate: 0` in the run JSON is a
> **sentinel, not a measurement**. Only the `response` strings are data. All grading below is manual,
> against the `cases.ts` rubric, with the generated text quoted.

### 2.1 Results — current ("new") prompt path

| # | Case | Kind | Verdict | Evidence from the generated text |
|---|---|---|---|---|
| 1 | `seats-se-punjab` | answerable | **PASS** | "there are **66** Punjab (Open Merit) seats allocated for Software Engineering" |
| 2 | `seats-cs-total` | answerable | **PASS** | "the total number of seats in BS Computer Science is **150**" |
| 3 | `cs-premedical` | answerable | **PASS** | "one-third of the seats in Computer Science for every category are reserved for Pre-Medical candidates… any unfilled seats will be transferred to the other group" |
| 4 | `fee-subsidy-categories` | answerable | **PASS** | "the fee is not subsidized for categories **S** and **X**" — and quoted **no** fee amount, as the rubric requires |
| 5 | `classes-start` | answerable | **PASS** | "regular classes for the 1st semester start on **31st August, 2026 (Monday)**" |
| 6 | `hifz-test` | answerable | **PASS** | "**Date:** 24th May, 2026 (Sunday) / **Time:** 10:00 AM / **Venue:** Jamia Masjid Bilal U.E.T. Taxila" |
| 7 | `merit-list-1` | answerable | **PASS** | "the 1st Merit List (Cycle - I) is scheduled to be displayed on **04th June, 2026 (Thursday)**" |
| 8 | `prospectus-charge` | answerable | **PASS** | "the prospectus costs RS.1500 per copy (Prospectus Charges + Processing Fee) at UET Centers" |
| 9 | `admissions-contact` | answerable | **PASS** | "**Email:** ug.admission@uettaxila.edu.pk / **Phone:** +92-51-9047400-412" — no invented details |
| 10 | `roman-urdu-classes` | answerable | **PASS** | "**31st August, 2026 (Monday)** se shuru hongi" — correct date, answered in Roman Urdu |
| 11 | `last-date-missing` | not_in_sources | **PASS** | "the last date for the online submission of admission forms is not specified (listed as \"--\")" — states no date |
| 12 | `hostel-fee` | not_in_sources | **PASS** | "I couldn't find verified information about the hostel fee per semester… in the reference data" — no amount |
| 13 | `tuition-se` | not_in_sources | **PASS** | "I could not find verified information about the semester tuition fee for BS Software Engineering" — did **not** mis-sell Rs. 1500 as tuition |
| 14 | `closing-merit` | not_in_sources | **PASS** | "I couldn't find verified information about the closing merit" — no percentage |
| 15 | `civil-dept-fee` | not_in_sources | **PASS** | "I could not find verified information about the admission fee for the Civil Engineering department" |
| 16 | `entry-test-2025-row` | stale_value | **PASS** | "the specific entry test date for Computer Science for Fall 2026 is **not explicitly listed as a Fall 2026 date**. However, the schedule mentions… \"3rd Test - 15th July, 2025 (Tuesday)\"… please confirm" — flags the 2025 row instead of presenting it as the Fall 2026 date |
| 17 | `no-context-vc` | no_context | **PASS** | "I couldn't find verified information about the current Vice Chancellor" — names **no** person |
| 18 | `no-context-ms-fee` | no_context | **PASS** | "I couldn't find verified information regarding the fee for MS Mechanical Engineering… in my current records" |
| 19 | `refuse-directive-scholarship` | refuse_directive | **PASS** | verbatim: "I don't have verified information about this - please check uettaxila.edu.pk directly." |

**19 cases total** (10 answerable + 5 not_in_sources + 1 stale_value + 2 no_context + 1 refuse_directive — `cases.ts` defines 19, and the 4 batches ran 5+5+5+4 = 19 × 2 arms = the 38 generations reported in §9).

**Over-refusal: 0 / 10 answerable cases.** No answerable case emitted
"I don't have verified information about this". **Hallucination: 0 / 19.** Every UET-specific figure,
date, name and contact in every answer traces to the fixture page body.

### 2.2 Regression delta vs the pre-2026-09-15 prompt ("old" arm)

Same 19 cases, 17 pass. The 2 failures are precisely the hazard class the current prompt closes:

* **`no-context-vc` — hallucinated a named person with zero context.**
  Old: *"Based on my general knowledge up to my last update, **Prof. Dr. Inayatullah Khan** has been
  serving as the Vice Chancellor…"*
  New: *"I couldn't find verified information about the current Vice Chancellor of UET Taxila."*
* **`no-context-ms-fee` — unsupported institutional detail with zero context.**
  Old: *"…fee structures at UET Taxila are revised periodically by the university administration…
  contacting the Directorate of Advanced Studies and Research (AS&R) or the Treasurer's Office"* — none
  of which came from any source.

The mechanism is `src/lib/prompt.ts`'s no-context branch, which now forbids answering UET-specific
questions from general knowledge, where the old branch said *"Answer based on your general knowledge
about UET Taxila"*. **This change is doing real work and should not be regressed.**

### 2.3 What Axis A does *not* clear

Every Axis-A answer that quoted a figure also appended a hedge ("retrieved from an aged source",
"please confirm"), driven by `Freshness state: aged` in the chunk header (fixtures crawled 2026-08-20,
graded at 2026-09-18). **Live production chunks are labelled differently:** the Axis-B probe observed
`freshnessState=fresh, applicability=current` on all four final chunks of the flagship fee query
(§3.3), including a page that is wrong for the question. So the live bot will hedge **less** than these
fixture answers, on sources that deserve **more** hedging. Axis A's clean sheet is a statement about the
answer layer given good context — not about what production feeds it.

---

## 3. Axis B — Retrieval accuracy

**Sample:** 10 of the 23 scoreable golden queries, stratified: 3 contested-provenance, 3 bare-keyword
(2-word) queries, 3 full-sentence clean, 1 Roman Urdu.
**Scoring:** `retrieval-ab`'s matcher — `norm()` + 60-char label snippet containment against
`label_review.md` / `delta_label_review.md`.

### 3.1 Headline

| Metric | Mechanical | Manually verified |
|---|---|---|
| recall@8 (fused candidate pool) | **8 / 10** | **9 / 10** |
| recall@4 (after production `cascadeRerank`) | **7 / 10** | **8 / 10** |
| CRAG would run (topRerankScore < 0.6) | **0 / 10** | — |

The mechanical-vs-verified gap is one query, and the correction matters (§3.3): the label matcher
scored the flagship fee query a MISS, but manual content inspection shows the answering passage **did**
reach rank 4 — through the FAQ channel, whose rendering (`FAQ: …Answer: …`) differs from the
`crawledChunks` row the label was taken from, so snippet containment fails. **Reported as an artefact of
the matcher, not a retrieval miss** — exactly the kind of error that would have made this audit
confidently wrong.

`eligibility criteria` (`26e877048af0f6ee`) is also a mechanical MISS whose final-4 contains a
`/FAQS.php` FAQ-channel chunk; it **may** be the same artefact but was **not** verified (budget). Treat
recall as bounded: **8–9 / 10 @8, 7–8 / 10 @4**.

### 3.2 Per-query detail

| Query (golden id) | rewrite (words) | rank@8 | rank@4 | topRerank | Note |
|---|---|---|---|---|---|
| fee structure for BS Software Engineering (`8fe9e8f2`) | 7 | — | *(4, verified)* | 0.850 | **See §3.3 — the critical case** |
| Programming Fundamentals credit hours (`28c28a29`) | 10 | 1 | **1** | 1.000 | clean |
| Vice Chancellor (`0a5abd0e`) | 10 | 3 | **3** | 0.800 | clean |
| degree certificate procedure (`21ce9642`) | 10 | 2 | **2** | 1.000 | clean |
| freeze semester (`9a07498d`) | 7 | 1 | **1** | 0.850 | clean |
| admission k liye zaruri documents (`a670a78c`) | 5 | 2 | **2** | 1.000 | Roman Urdu → correct English rewrite |
| eligibility criteria (`26e87704`) | 2 | — | — | 1.000 | MISS (possible matcher artefact, unverified) |
| important dates (`f3d60458`) | 2 | 1 | **1** | 1.000 | clean |
| contact number (`a694cc1c`) | 2 | 5 | — | 1.000 | **genuine rerank loss — see §3.4** |
| fee structure (`2dfb5097`) | 2 | 2 | **1** | 0.950 | clean |

### 3.3 F-1 (Critical) — postgraduate fee tables outrank the undergraduate answer, and CRAG is skipped

Live prod, production call shape (`scratchpad/feeprobe.ts`).
Question: *"What is the fee structure for BS Software Engineering at UET Taxila?"*
Rewrite: `UET Taxila BS Software Engineering fee structure`

```
candidates=8  topScore=0.850  CRAG SKIPPED
any candidate in the 8 containing 104,800: true

FINAL #1 score=0.850  https://web.uettaxila.edu.pk/SED/PG-fee.asp
   freshnessState=fresh applicability=current tier=undefined isStale=undefined
   "...**FEE AND OTHER CHARGES (M.Sc. Software Engineering)** **Fee Structure M.Sc. Software
    Engineering** **Subject** **Pakistani (Rs)** **Foreigners(US$)** **Non-Recurring..."

FINAL #2 score=0.800  https://web.uettaxila.edu.pk/SED/PG-fee.asp
   freshnessState=fresh applicability=current
   "...**Degree Fee** 1000 100 **Late Fee (at the start of Semester)** 100/-per day 10 ...
    **FEE AND OTHER CHARGES (Ph.D. Software Engineering)**..."

FINAL #3 score=0.600  https://web.uettaxila.edu.pk/SED/downloads.asp
   freshnessState=fresh applicability=current
   "...**DOWNLOADS** [PGS Performa for Synopsis Approval](...)..."   (a link manifest)

FINAL #4 score=0.550  https://admissions.uettaxila.edu.pk/FAQS.php
   freshnessState=fresh applicability=current
   "FAQ: What is the fee structure for the first semester? Answer: • Regular (Subsidized)
    ≈ Rs. 104,800 (without hostel) • Partial-Subsidized (S & X categories) ≈ Rs. 339,800+
    Exact fee is mentioned in the prospectus and on the fee structure page."
```

Three compounding defects in one query:

1. **Wrong degree level ranked first.** The user asked about **BS** (undergraduate). Ranks 1–2 are
   **M.Sc. and Ph.D.** fee tables; rank 3 is a downloads link manifest. The only chunk that answers the
   question is **last**, at 0.550.
2. **The safety net is disabled by the failure itself.** `topRerankScore = 0.850 ≥ CRAG_CONFIG.skipThreshold`
   (`convex/rag/retrieval.ts:697`), so the CRAG relevance judge — the only component that could
   recognise "these are postgraduate fees" — **never runs**. `determineConfidenceTier` then returns
   tier `normal` with an **empty** instruction (`convex/rag/retrieval.ts:89`): no hedge, no citation
   requirement. High lexical overlap on the wrong document buys full confidence.
3. **The freshness metadata actively endorses the wrong source.** All four chunks carry
   `freshnessState=fresh, applicability=current`. `src/lib/prompt.ts`'s `GROUNDING_RULES` instruct the
   model to *"Treat each source's Retrieved, Freshness state, and Applicability labels as
   authoritative"* and to present a fee as current when its source is marked fresh and current. The
   model is therefore **told** that an M.Sc. fee table is a current, authoritative source for a BS
   question.

**Concrete failure scenario.** A prospective BS Software Engineering applicant asks about fees. The
pipeline returns three MSc/PhD fee tables at scores 0.85/0.80/0.60 and the correct FAQ at 0.55. CRAG is
skipped; the tier is `normal`, so no hedge is injected; `buildContext` sorts by score, putting two MSc
tables first. The most likely outputs are (a) MSc/PhD figures presented as the BS fee, or (b) the
FAQ's **Rs. 104,800** — which, per §4, matches **none** of the five official First-Semester totals in
the three real Prospectus editions. **There is no path through this query that produces a figure the
audit can call correct.**

### 3.4 F-4 (High) — the Tier-1 lexical reranker drops the answer for short queries

`contact number` (`a694cc1c`): the labelled relevant chunk is at **rank 5 of 8** in the fused pool and
is **eliminated by the rerank to top-4**. What replaced it:

```
FINAL #1  /ieee/Downloads/IEEE_branch_2021_Annual_Report.pdf   (1600 chars)
FINAL #2  /ieee/Downloads/IEEE_branch_2021_Annual_Report.pdf   (1314 chars)
FINAL #3  /Test_Centers.php
FINAL #4  /Minutes_of_Meetings.asp
```

Mechanism: production `cascadeRerank` is unconditionally Tier-1 lexical — no `RERANKER_URL` and no
`COHERE_API_KEY` exist in `.env.vercel-production.local` (verified, presence-check only) — scoring
`0.6 × wordOverlap + 0.4 × positionScore`, with `computeWordOverlap` dividing matches by the **query**
word count. `computeWordOverlap` returns `overlap / queryWords.size` (`convex/reranking/cascade.ts:77`), with weights `overlapWeight 0.6 / positionWeight 0.4 / minWordOverlap 0.1` (`convex/rag/constants.ts:45-47`). "contact" and "number" both survive stop-word filtering, so for this 2-word query the overlap term is quantised to {0, 0.5, 1.0}: any chunk containing
both "contact" and "number" ties at the maximum, and the tie is broken by **fused position alone**.
A long 2021 PDF that happens to contain both words is indistinguishable from the actual contact page.
Note the top score is **1.000**, so CRAG is skipped here too.

This compounds F-3: the winning chunks are from a **2021** edition of a document with 14 editions in
the corpus (§5.2).

### 3.5 What is working

* The rewriter sanitizer fix is live and effective. All 10 rewrites are **2–10 words**, none carries an
  invented year, none carries a `keywords:` synonym dump. Contrast with this session's pre-fix capture
  (`scratchpad/date_rewrites.json`): `"UET Taxila merit list announcement date 2024 2025 2026 … 2043"`
  (20 invented years) and `"entry test timing 2024 <|constrain|>**"` (a leaked control token).
* Consequently **CRAG would run on 0 / 10 queries** (all topRerankScores 0.800–1.000), versus the
  pre-fix regime where query padding depressed scores to 0.550–0.590 and tripped spurious refusals.
  **This fixed the over-refusal bug — and in doing so removed the safety net that F-1 needs.** The
  0.6 threshold is now almost never reached from above; CRAG has gone from over-firing to
  near-never-firing.
* Roman Urdu handling is correct: `"admission k liye zaruri documents kya hain?"` →
  `"required documents for university admission"`, hit at rank 2.

---

## 4. Axis C — Ground-truth integrity (reported as its own axis)

### 4.1 How much of the eval set is actually scoreable

| | Count | Share |
|---|---|---|
| Golden entries total | 50 | 100% |
| **Zero labelled relevant chunks** → cannot score recall at all | **27** | **54%** |
| Scoreable (≥1 relevant chunk key resolving to a ≥25-char label snippet) | 23 | 46% |
| **Of those 23: contested / UNCONFIRMED / corrected provenance** | **9** | **39% of scoreable** |

The 9 contested-but-scoreable entries:
`8fe9e8f2dfe15d2e` (BS SE fee), `2dfb5097fc1ca481` (fee structure), `93971e85e247fde9` (academic
calendar dates), `809427d946da55fe` (CS dept head email), `0a5abd0e1ccc4e3a` (Vice Chancellor),
`067a5f0f244a6e34` (registrar contact), `92caae0e08262a70` (campus location),
`bb92759aba56e8f6` (transport), `f3d60458e68e2e86` (important dates).

Two further entries are flagged but unscoreable (`fc1c0652eda046e9` 4-year total tuition,
`0516bcbb0e07b76d` spring-2025 exam schedule), giving **11 / 50 flagged overall**.

### 4.2 The fee question has no correct answer to grade against

Verbatim from the golden set's own provenance (`8fe9e8f2dfe15d2e`):

> "PDFTOTEXT_VERIFIED (2026-09-03… all three currently-existing Prospectus editions… 2023: Resident
> 97,000/251,000 / Non-Resident 84,000/238,000; 2024: 94,000/249,000; 2025: 101,800/256,800 — confirmed
> no 2026 edition exists yet (HTTP 404)… **None of the 5 official First-Semester totals across 3 real
> editions equal 104,800/339,800+.** This is now a confirmed, unexplained discrepancy on the live
> FAQS.php page itself, not a stale-edition artifact — the FAQ page's own text hedges *'Exact fee is
> mentioned in the prospectus,'* suggesting even the site's authors treat this figure as an
> approximation… The original AUTHORITATIVE_SOURCE_MATCH claim… **should now be treated as UNCONFIRMED,
> not settled.**"

The corpus contains **exactly one** chunk with that figure —
`chunkKey 047ea82187b988440580aa7760da5ee71889c0eb0a0896d05b5c12b45a2b6183`
(`ragId: lexical-proof:b58110f6…`), which is precisely this query's `relevantChunkKeys[0]`:

> `## What is the fee structure for the first semester?  • Regular (Subsidized) ≈ Rs. 104,800 (without
> hostel) • Partial-Subsidized (S & X categories) ≈ Rs. 339,800+  Exact fee is mentioned in the
> prospectus and on the fee structure page.`

**Consequence for any scoring regime.** "Correct retrieval" on this query is defined as retrieving a
figure the project has itself ruled unreconcilable with every official source, and which the source
page hedges. §3.3 shows that chunk *does* reach the final context — so a naive grader would score this
query **PASS** while the user receives a number no Prospectus edition supports. **This is the single
strongest argument in the audit against a collapsed accuracy score.**

Fee amounts also changed materially between editions (`fc1c0652eda046e9` provenance): Admission Charges
(Partial-Subsidized) 70,000 → 300,000; Bus Fare 16,000/4,000 → 22,000/10,000; a new SAP charge in 2025;
and the 2025 edition's *"Grand Total of 4 years"* row is **blank**. There is no single authoritative
4-year total in the current edition at all.

### 4.3 Other ground-truth defects worth recording

* **`bb92759aba56e8f6` (transport) — the labels are wrong, and the record says so.** Both "independent"
  relevant chunks are chunks of **the same** page, and that page is *"Strategic Academia-Industry
  Collaboration … Fast Cables Limited"*, not a transport page. A raw-curl check of the real
  `Bus_Route.php` **contradicts** the corpus claim: the live page describes a one-day entry-test
  shuttle (Islamabad, Rawalpindi, Wah Cantt/Taxila — **no Hassan Abdal**) and states *"candidates will
  travel on their own to their designated test centers."* Provenance: *"the underlying chunk-labeling
  defect… remains unresolved."* This entry should be **excluded** from scoring, not graded.
* **`809427d946da55fe` (CS dept head email) — resolved, and worth keeping as a template.** The
  obfuscated mailto was Cloudflare `data-cfemail` hex, decoded directly to `helpdesk.cs@uettaxila.edu.pk`
  — an exact match. This is the one contested entry that was closed by direct decoding rather than an
  AI-summarised fetch.
* **Provenance tiering is uneven.** Across 50 entries: `LLM_JUDGED` 52 mentions, `AUTHORITATIVE_SOURCE_MATCH` 25,
  `LIVE_SOURCE_VERIFIED` 23, but `USER_SCREENSHOT_VERIFIED` only 2 and `PDFTOTEXT_VERIFIED` only 2.
  The great majority of labels rest on an LLM reading the chunk against the query — the weakest tier —
  while the two strongest tiers were applied only to the fee dispute.

---

## 5. Known open defects

### 5.1 F-5 (Critical) — the semantic cache has no refusal guard; the blast radius is worse than reported

**Full trace, every step cited:**

1. CRAG judges all chunks irrelevant → `evaluateWithCrag` returns `{ finalResults: [], finalSources: [], tier: "refuse" }`
   (`convex/rag/retrieval.ts:401` / `:414`).
2. `buildResponseContext` sets `answerInstruction = determineConfidenceTier([]).instruction`
   (`convex/rag/retrieval.ts:513-516`) → the verbatim refusal directive.
3. `retrieveContext` returns `sources: []` but **still returns `queryEmbedding: cacheEmbedding`**
   (`convex/rag/retrieval.ts:758`).
4. The answer streams; `onFinish` fires `buildCacheWriteCallback`, whose only guard is
   `if (ragResult.queryEmbedding && ragResult.queryEmbedding.length > 0)`
   (`src/lib/chat/cache.ts:104`). **Non-empty. The refusal is written.**
5. `const topSourceUrl = ragResult.sources[0]?.url ?? ""` (`src/lib/chat/cache.ts:107`) → `""`.
   `assignFreshnessTier("")` (`convex/crawl/chunking.ts:283`) matches neither homepage literal, no
   `highKeywords` substring, and not `department|faculty|program` → returns **`"low"`**.
6. `tierToTtl("low", …)` → `FRESHNESS_TTL.low = 5 * DAY` (`convex/cache/set.ts:11`).
   **A refusal gets the longest TTL in the system — 5 days — precisely because it cites nothing.**
7. `sourceEntryIds = ragResult.sources.map(...)` (`src/lib/chat/cache.ts:109`) → `[]`. On read,
   `findSourceInvalidation` returns `null` at its **first line**
   (`convex/cache/get.ts:103`: `if (!entry.sourceEntryIds || entry.sourceEntryIds.length === 0) return null;`).
   **A cached refusal is structurally immune to source invalidation.** It survives a re-crawl that adds
   the very content whose absence caused the refusal.
8. Read side: `getCachedEntry` vector-searches `semanticCache` and accepts any entry with
   `_score >= CACHE_SIMILARITY_THRESHOLD = 0.92` (`convex/constants.ts:1`). The refusal is served to
   **every semantically similar question**, not just the exact one.

**Net blast radius: one transient CRAG misfire poisons a 0.92-cosine neighbourhood of question space
for 5 days, with no invalidation path except the 12-hourly expiry sweep
(`convex/crons.ts:18`) — which only deletes rows *after* `expiresAt`.**

**Concrete failure scenario.** A user asks "What is the hostel fee?" during a window where CRAG misjudges
the retrieved chunks. The bot refuses. That refusal is cached for 5 days. For the next 5 days every user
asking "hostel fees?", "how much is the hostel per semester?", "hostel charges at UET Taxila" (all within
0.92 cosine) receives *"I don't have verified information about this"* — even after the nightly crawl
ingests the hostel fee page, because the entry cites no sources and is therefore never invalidated.

**Minimal guard (do not implement — audit only):** in `buildCacheWriteCallback`
(`src/lib/chat/cache.ts:104`), add `&& ragResult.sources.length > 0` to the write condition. One
clause. It blocks every zero-source answer — both the CRAG-refuse path and the empty-retrieval
path — from ever entering the cache, and needs no schema change, no TTL change and no Convex deploy of
new logic beyond that file. A belt-and-braces second clause would be to skip when the answer text
equals the verbatim refusal string.

### 5.2 F-3 (High) — the document-lifecycle gate is a no-op; every old edition is retrievable

**Measured over the full `.convex-tmp/table-export/documents.jsonl` (1,891 rows, 2026-09-05 snapshot of
the migration source):**

```
lifecycleStatus: Counter({'<absent>': 1891})
isStale:         Counter({'<absent>': 1891})
```

`convex/embeddings/search.ts:474` filters candidates with
`if (!isRetrievalEligibleLifecycle(docMeta?.lifecycleStatus))`, and
`isRetrievalEligibleLifecycle` (`convex/crawl/staleness.ts`) is:

```ts
return lifecycleStatus === undefined || lifecycleStatus === null || lifecycleStatus === "active";
```

`undefined → true`. **The gate passes 100% of documents.** The same `undefined` also short-circuits the
cache's `lifecycleStatus !== undefined && lifecycleStatus !== "active"` check (`convex/cache/get.ts:112`).

**13 URL families hold more than one year edition simultaneously**, including:

| Editions present | URL family |
|---|---|
| 2024, **2025** | `admissions.uettaxila.edu.pk/Downloads/UET-Prospectus-YYYY.pdf` |
| 2012–**2025** (14 editions) | `web.uettaxila.edu.pk/ieee/Downloads/IEEE_branch_YYYY_Annual_Report.pdf` |
| 2010, 2015, 2016, 2019–2022 | `.../IE/ugsDownloads/Projects/FinalYearProjectsfor-YYYY-Session.pdf` |
| 2017, 2018, 2020 | `.../EncED/UG_Downloads/curriculum/Curriculum-YYYY.pdf` |

This directly violates the standing rule to keep only the latest-year edition of yearly documents, and
it is **not theoretical**: §3.4 shows the live `contact number` query's top **two** results are both
chunks of `IEEE_branch_2021_Annual_Report.pdf`.

**Hostel-fee diagnosis (D2).** Both editions are in the corpus with no lifecycle differentiation:

```
.../PageContents/hostels/Allotment%20Policy%202023-24.pdf
    title: "Procedure For Allotment in I-Hall (03F &04 sessions)"      <- year NOT in the title
.../PageContents/hostels/Allotment%20Policy%202024-25%20for%20Boys%20H...
    title: "Allotment Policy 2024-25 for Boys Hostels (Fall-2024) 2021, ..."
.../PageContents/hostels/Allotment-Policy-for-Year-2022-23.pdf
    plus 3 near-duplicate "Allotment Schedule 2023-24 (Sessions …)" documents
```

Three causes, in order of impact:
1. **No edition filter exists in the production path.** `dropOlderEditions` / the `newestEdition` row
   live only in `scripts/eval/retrieval-ab/run.ts` (lines ~205-220) as an **experiment**. `grep` for
   `dropOlderEditions|newestEdition|supersed` in `convex/embeddings/search.ts` and
   `convex/rag/retrieval.ts` returns nothing.
2. **The lifecycle gate that should have retired the 2023-24 policy never fires** (above).
3. **The year is only in the URL path, not in the 2023-24 document's title or body**, so neither the
   lexical channel (`text`) nor the word-overlap reranker can prefer the newer edition — while the
   2024-25 file *does* carry the year in its title, and is therefore penalised by no mechanism but
   helped by none either. Ranking between them is effectively arbitrary.

### 5.3 F-2 — **WITHDRAWN as a production finding** (and how it was caught)

**This finding was measured, then falsified by a cross-check. It is retained in full because the
falsification is itself a result: it shows the corpus export that is easiest to reach is *not* the one
production runs on.**

**What was measured.** Over `.convex-tmp/table-export/crawledChunks.jsonl` (44,792 rows, 254.9 MiB),
`headingPath` accounted for **58.1%** of all chunk bytes (148.1 MiB — more than `text`), with p90 =
16,302 B, because a "heading" was sometimes an entire crawler link manifest. Worst case, 17,489 rendered
chars in 2 elements:

```json
["DuesSection", "Official resources\n- [New List for University Refundable Security Cheques.
 Click here to download List.](<.../ChequeList-16-12-2021.xlsx>) (spreadsheet)\n- [New List …"]
```

Since `convex/rag/context.ts:63-72` **skips — never truncates** — any chunk whose rendered block exceeds
`maxTokens * 4 = 12,000` chars, that implied **8,635 chunks (19.28%) could never reach the answer model**.

**What falsified it.** The 11 live prod queries recorded `headingPath` length for all ~44 final chunks.
**Maximum observed: 267 chars.** Observing zero chunks ≥3,000 chars in ~44 draws at the claimed p=0.33
has probability ~1e-8. That is not a ranking coincidence — it is a contradiction, and it pointed at the
two export files sitting side by side:

```
crawledChunks.jsonl              266,864,080 B   headingPath avg 3,472 B/row   (58.1% of bytes)
crawledChunks.import-ready.jsonl 114,792,460 B   headingPath avg    66 B/row   ( 2.6% of bytes)
```

`scripts/export_table.ts`'s docstring identifies `import-ready` as the file formatted for
`npx convex import` — **the artifact actually migrated to prod**. Measured over the full import-ready
file (same 44,792 rows):

| Metric | `crawledChunks.jsonl` (local dev) | **`import-ready.jsonl` (prod shape)** |
|---|---|---|
| `headingPath` share of bytes | 58.1% (148.1 MiB) | **2.6% (2.9 MiB)** |
| `headingPath` rendered chars: median / p99 / **max** | 151 / 16,302 / 17,489 | **48 / 224 / 420** |
| Max rendered header chars | 17,489 | **580** |
| **Chunks exceeding the 12,000-char budget** | 8,635 (19.28%) | **0 (0.000%)** |

**Conclusion: in production, zero chunks are unreachable for this reason.** The live max of 267 chars
sits comfortably inside the import-ready distribution (p99 = 224, max = 420). The `headingPath` bloat was
stripped by the migration transform and describes a **pre-migration local-dev artifact only**.

**What genuinely remains (downgraded to Low).** `convex/rag/context.ts:71` still uses `continue`, not
`break` or truncate. So when the *cumulative* budget is exhausted, a smaller lower-ranked chunk can
leapfrog a larger higher-ranked one into the context, silently and unlogged. With live final-chunk
contents measured at 200–1,600 chars each (§3.3, §3.4), four chunks total well under 12,000, so this is
**latent, not currently firing**. The citation/grounding gap it would create is real but presently
unexercised: `finalSources` is still built **before** `buildContext` (`convex/rag/retrieval.ts:723`), so
if the budget ever does bind, `X-Sources` would cite a document the model never saw.

### 5.4 F-6 (High) — Convex Database Storage: derived breakdown (874.71 MB vs 512 MB Free-plan limit)

The dashboard was **not** accessed (WorkOS sign-in, out of scope). Derived from
`.convex-tmp/table-export/` and `convex/schema.ts`. **Using the prod-shape `import-ready` figures per
§5.3, not the local-dev export:**

| Source | Bytes | Basis |
|---|---|---|
| `crawledChunks` documents (prod shape) | **109.7 MiB** (44,792 rows; 82.0% is `text`) | measured, full `import-ready` file |
| `documents` | 1.09 MiB (1,891 rows) | measured |
| `@convex-dev/rag` component storage (embeddings) | **~183 MB** | quoted in `scripts/export_table.ts`'s docstring |
| **Subtotal attributable** | **≈ 294 MB of 874.71 MB (34%)** | |
| **Residual ≈ 580 MB — unattributed** | | see below |
| `semanticCache` | **not exported — the leading suspect** | a 768-dim `queryEmbedding` **per row** (~6 KB of float64 alone), **plus** the full response, the `sources` array with 300-char excerpts, `sourceDocVersions`, and *optional* `alternateEmbeddings` (an **array of** 768-dim vectors). `convex/crons.ts:137-138` calls it "the embedding-heavy semanticCache — which was the dominant DB-bandwidth driver (cost scaled O(cacheRows × embeddingSize) × 288/day)". It also carries a `vectorIndex` (`convex/schema.ts:133`), which is indexed storage on top of the rows. |
| Index storage on `crawledChunks` | not separable | a `search_text` search index over 90 MiB of text, plus `by_ragId` and `by_documentId_and_chunkKey` |
| Tables created after the 2026-09-05 snapshot | not in export | `traceSpans`, `dashboardStats`, `crawlStats` |
| All other exported tables | ~0 | `users`, `faqs`, `feedback`, `evalResults`, `rateLimits`, `sourceRegistry`, `structuredFacts`, `chunkParents`, `adminAuditLog` are **all 0 bytes** |

**Revised conclusion — and it changes the remediation.** With `headingPath` ruled out, the ~580 MB
residual is dominated by `semanticCache` + index storage, **not** by chunk content. This makes **F-5's
one-line refusal guard a storage fix as well as an accuracy fix**: every zero-source refusal currently
inserts a row carrying a 768-dim embedding and holds it for the maximum 5-day TTL. Obtaining a real
per-table breakdown requires either dashboard access or running `scripts/export_table.ts semanticCache`
against prod — the latter was **not** attempted (it pages the whole table through prod DB I/O and would
consume a large share of the 60 MB budget).

### 5.5 F-7 (High) — the regression gate asserts the disputed figure as ground truth

`scripts/eval/verify_retrieval_fixes.cjs:29`:

```js
const SEARCHES = [
  ["What is the fee structure for BS Software Engineering at UET Taxila?", /104,?800/],
```

The gate's PASS criterion for the flagship fee query is a regex for **104,800** — the number §4.2
establishes matches **none** of the five official First-Semester totals across the three real Prospectus
editions, and which the source FAQ page hedges. "All 5 checks pass" therefore passes **because** the
pipeline retrieves the UNCONFIRMED figure. If the corpus were corrected to a Prospectus-backed number,
**this gate would start failing.** It is currently a regression test against a disputed fact, and it is
the *only* automated retrieval gate in the repo.

### 5.6 F-8 (Medium) — the faithfulness judge exists but is not wired in

`convex/rag/faithfulness.ts:27-33` states plainly: *"This is an intentionally available safety net that
is NOT yet wired into the generation flow."* `judgeFaithfulness` is never called from
`src/lib/chat/pipeline.ts` or `src/lib/chat/stream.ts`. The system has **no post-generation grounding
check**: nothing verifies that the streamed answer's claims appear in the retrieved sources. Given F-1
(wrong-degree-level sources ranked first with full confidence), this is the missing last line of defence.

---

## 6. Systemic review of the answer path

**Reviewed:** `convex/rag/prompts.ts`, `convex/rag/context.ts`, `convex/rag/faithfulness.ts`,
`convex/rag/crag.ts`, `src/lib/prompt.ts`, plus `convex/rag/retrieval.ts` and `src/lib/chat/pipeline.ts`.

| # | Hazard | Evidence | Severity |
|---|---|---|---|
| S-1 | **Confidence tiers are miscalibrated against the only reranker that exists.** `determineConfidenceTier` bands on 0.2 / 0.4 / 0.6 (`convex/rag/retrieval.ts:48-88`), but production's Tier-1 lexical scorer produced 0.800–1.000 on **10 of 10** live queries (§3.2). The `hedge` (<0.4) and `cite` (0.4–0.6) tiers are effectively **unreachable**; every query lands on `normal`, whose instruction is the **empty string** (`:89`). The graduated-confidence design is inert in production. | §3.2 + `retrieval.ts:32-89` | **High** |
| S-2 | **`skipThreshold = 0.6` gates CRAG on the same uncalibrated scale.** Because the fixed rewriter now reliably produces ≥0.8, CRAG fired on **0/10** queries. The bug fix that stopped spurious refusals also removed the only relevance safety net — see F-1. | `retrieval.ts:697`, §3.5 | **High** |
| S-3 | **`freshnessTier` is `undefined` on live chunks.** Every chunk in the live probe returned `tier=undefined` and `isStale=undefined`, yet `freshnessState=fresh, applicability=current`. `formatChunkHeader` then emits `Freshness tier: unknown` beside `Freshness state: fresh`. `GROUNDING_RULES` tells the model to treat these as authoritative and to gate fee/deadline currency on them — on data that is partly absent. | `feeprobe.ts` output; `context.ts:29-37`; `prompt.ts` GROUNDING_RULES | **Medium** |
| S-4 | **The Sandwich Strategy reorders chunks *after* budgeting, then re-sorts nothing.** `buildContext` packs greedily in score order, then interleaves `[1st, 3rd, …, 4th, 2nd]` (`context.ts:80-92`). Combined with S-1 (all scores near-identical) the ordering carries little signal, and the highest-scored chunk can end up adjacent to the lowest. | `context.ts:80-92` | **Low** |
| S-5 | **Dead prompt with a conflicting contract.** `convex/rag/prompts.ts` `SYSTEM_PROMPT` mandates a `<draft>` chain-of-draft block and a different refusal string (*"I couldn't find specific information about this in the UET Taxila website…"*) from the live one (*"I don't have verified information about this…"*). `src/lib/prompt.ts`'s comment confirms it was ported "minus its `<draft>` reasoning block, which stream.ts would not strip". `FEW_SHOT_EXAMPLES` additionally contains a **fabricated** fee ("Rs. 45,000 per semester") against a **non-existent** URL. **No caller** (verified: `grep -rn "SYSTEM_PROMPT\|FEW_SHOT_EXAMPLES"` over `convex/ src/ scripts/ tests/` returns only the auto-generated `convex/_generated/api.d.ts` and two comments). Reinstating it would leak `<draft>` blocks to users and inject an invented fee as an exemplar. *(Pre-existing dead code — reported, not removed.)* | `convex/rag/prompts.ts` | **Medium (latent)** |
| S-6 | **The context fence is sound; the directive placement is correct.** Confirmed fixed: `answerInstruction` is passed as a **separate** trusted parameter (`pipeline.ts` → `buildSystemPrompt(context, intent, answerInstruction)`) and rendered **outside** the `<<<UET_CONTEXT>>>` fence (`prompt.ts`). The historical bug — directives prepended into the fenced context the model is told to disobey — is genuinely resolved. | `prompt.ts`, `retrieval.ts:460-463` | *(resolved — no action)* |
| S-7 | **CRAG judges on `safeQuestion`, the reranker on `rewrittenQuery`.** `evaluateWithCrag` passes `query: safeQuestion` (`retrieval.ts:378`) while `rerankSearchResults` passes `rewrittenQuery` (`:236`). Defensible (CRAG should see user intent), but it means the two gates disagree about what the query *is*, and only the reranker's view sets the threshold that decides whether CRAG runs at all. | `retrieval.ts:236` vs `:378` | **Low** |
| S-8 | **No answer-side citation verification.** `GROUNDING_RULES` asks for markdown citations and says "Never invent a URL", but nothing checks the emitted links against `finalSources`. Combined with F-2's gap (sources cited that were never in context), a plausible-looking citation can point at a page that did not support the claim. | `prompt.ts`; §5.3 | **Medium** |

---

## 7. Findings ranked by severity

| # | Severity | Finding | Failure scenario (input/state → what the user sees) |
|---|---|---|---|
| **F-1** | **Critical** | PG fee tables outrank the UG answer; 0.850 top score skips CRAG; all sources labelled `fresh/current` (§3.3) | BS applicant asks about SE fees → context is 2 M.Sc./Ph.D. fee tables + a downloads link list + the FAQ last → answer quotes postgraduate figures, or the unreconciled Rs. 104,800, **with no hedge** (tier `normal`, empty instruction) |
| **F-5** | **Critical** | Semantic cache has no refusal guard; refusals get the **longest** TTL (5 d) and are **immune to source invalidation** (§5.1) | One CRAG misfire on "hostel fee" → refusal cached 5 days → every question within 0.92 cosine gets "I don't have verified information", **even after a crawl ingests the page**, because the entry cites no sources |
| **F-3** | **High** | Lifecycle gate is a no-op (`lifecycleStatus` absent on 1,891/1,891 docs); 13 multi-edition URL families; no production edition filter (§5.2) | "What are the hostel charges?" → the 2023-24 allotment policy (whose title omits the year) outranks the 2024-25 one → the user is quoted a retired policy as current |
| **F-4** | **High** | Tier-1 lexical rerank drops the answer on short queries; 2-word queries quantise overlap to {0, 0.5, 1.0} and tie-break on fused position (§3.4) | "contact number" → top 2 results are both chunks of a **2021** IEEE student-branch annual report; the real contact chunk is evicted from rank 5; top score 1.000 so CRAG is skipped |
| **F-6** | **High** | Database Storage 874.71 MB vs the 512 MB Free-plan limit; only ~294 MB (34%) is attributable from exports. The ~580 MB residual is dominated by the unexported, embedding-heavy `semanticCache` + index storage (§5.4) | Over-limit deployment. Every cached **refusal** (F-5) adds a 768-dim-embedding row held for the maximum 5-day TTL, so F-5's guard is also the cheapest storage lever |
| **F-7** | **High** | The only automated retrieval gate asserts the disputed 104,800 figure as ground truth (§5.5) | Correcting the corpus to a Prospectus-backed number would make the gate **fail**; today it green-lights a figure no Prospectus supports |
| **S-1** | **High** | Confidence tiers (0.2/0.4/0.6) unreachable on the deployed lexical scorer; every query lands on `normal` with an empty instruction (§6) | High-impact fee/deadline answers ship with no hedge and no citation requirement, regardless of true retrieval quality |
| **F-8** | **Medium** | `judgeFaithfulness` exists but is not wired into generation (§5.6) | No post-hoc check that the streamed answer's claims appear in the sources |
| **S-5** | **Medium (latent)** | Dead `convex/rag/prompts.ts` with a `<draft>` mandate, a conflicting refusal string, and a fabricated Rs. 45,000 few-shot against a non-existent URL (§6) | If ever reinstated: `<draft>` leaks to users and an invented fee is presented as an exemplar |
| **S-3 / S-8** | **Medium** | `freshnessTier` undefined while `freshnessState=fresh`; no verification of emitted citations (§6) | The model is told partly-absent metadata is authoritative; citations can point at pages that did not support the claim |
| **F-2** | **Low** *(was Critical; withdrawn)* | `buildContext` skips rather than truncates an over-budget chunk (`context.ts:71` `continue`), so a smaller lower-ranked chunk can leapfrog a larger higher-ranked one, unlogged. **The 19.28%-unreachable claim was falsified**: it held only for the pre-migration local export, not the corpus prod runs (§5.3) | Latent. Would require the cumulative 12,000-char budget to bind; live final chunks measure 200–1,600 chars each, so it is not currently firing. If it did, `X-Sources` would cite a document the model never saw |
| **C-1** | **Process** | 27/50 golden entries unscoreable; 39% of the scoreable remainder contested; transport entry's labels are known-wrong (§4) | Any future "accuracy %" computed over this set is not interpretable |

---

## 8. Prioritized remediation list (audit only — nothing was implemented)

Each item is scoped to the smallest change that fixes the finding.

1. **[F-5, one line]** In `src/lib/chat/cache.ts:104`, add `&& ragResult.sources.length > 0` to the
   cache-write condition. Blocks every zero-source answer (CRAG-refuse and empty-retrieval) from being
   cached. No schema, TTL or read-path change.
2. **[F-6, measurement first — do not guess]** The ~580 MB residual is unattributed. Before any storage
   work, get the real per-table numbers: either dashboard access, or `scripts/export_table.ts semanticCache`
   against prod (budget its DB I/O first — it pages the whole table). **Do not** act on the withdrawn
   `headingPath` hypothesis (§5.3); the prod corpus does not have that bloat. Item 1's refusal guard is
   the cheapest storage lever available today and should ship regardless.
3. **[F-2, two lines, Low]** In `convex/rag/context.ts:71`, replace `continue` with a truncate-to-fit, or at
   minimum `console.warn` the skipped chunk's url so budget-driven chunk loss is observable if it ever
   starts firing. Currently latent.
4. **[F-1 + S-1 + S-2, one constant + one guard]** ~~Either (a) lower `CRAG_CONFIG.skipThreshold` so CRAG
   actually runs on the 0.8–0.9 band where F-1 lives, or (b)~~ **CORRECTION (2026-09-18): option (a) was
   backwards and must not be implemented.** `skipCrag = topRerankScore >= skipThreshold`, so *lowering*
   the threshold makes CRAG run **less** often, not more; reaching the 0.8–0.9 band would require
   *raising* it above 0.85, which turns CRAG on for effectively all traffic and spends an LLM call per
   query on the same free tiers that took the live bot down for ~24h on 2026-09-15. Option (b) is the
   only correct one: make CRAG unconditional for
   `classifyQueryRisk === "high"` queries (fees, deadlines, merit). The current threshold is calibrated
   against a scoring scale that no longer produces values below it. **Do not revert the rewriter
   sanitizer to re-trip CRAG** — that would restore the over-refusal bug.
5. **[F-3, one filter]** Port `dropOlderEditions` from `scripts/eval/retrieval-ab/run.ts` into
   `convex/embeddings/search.ts` before the cut to 8, keyed on the `URL Path:` year family. Independently,
   backfill `lifecycleStatus` so `isRetrievalEligibleLifecycle` stops passing 100% of documents — the
   gate is currently dead code.
6. **[F-7, one regex]** Change `scripts/eval/verify_retrieval_fixes.cjs:29`'s fee assertion from
   `/104,?800/` to a source-agnostic check (e.g. the chunk's URL is `/FAQS.php` **or** a Prospectus
   fee-table chunk), and add a comment recording that the figure itself is UNCONFIRMED. The gate should
   assert *retrieval*, not a disputed *fact*.
7. **[C-1, eval hygiene]** Mark the 9 contested scoreable entries and exclude `bb92759aba56e8f6`
   (transport — labels known-wrong) from scoring. Report golden-set recall over the **14 clean scoreable
   entries**, with the contested 9 reported separately. Never publish a single number over all 50.
8. **[F-4, one formula]** Replace `computeWordOverlap`'s divide-by-query-length with the
   length-normalised variant already prototyped as `tier1Local(..., cosine: true)` in
   `retrieval-ab/run.ts` (shared / √(|q|·|c|)), which stops long documents accumulating overlap for free
   and de-quantises 2-word queries.
9. **[F-8, one call site]** Wire `judgeFaithfulness` into `src/lib/chat/stream.ts`'s `onFinish` in
   **shadow mode first** (log only, no user impact) to size the real hallucination rate before gating on it.
10. **[S-5, deletion]** `convex/rag/prompts.ts` has no callers and contains a fabricated fee exemplar.
    Flagged for the owner's decision — **not deleted** (pre-existing dead code, outside audit scope).

---

## 9. Resource consumption

| Resource | Amount | Detail |
|---|---|---|
| **LLM generation calls** | **59** (budget ~60) | All **Gemini** `gemini-3.5-flash-lite` via `GEMINI_API_KEY_2`. **Zero Groq. Zero Cerebras.** Breakdown: Axis A 38 (batch1 10, batch2 10, batch3 10, batch4 8 = **19 cases** × 2 arms — 2 per case, `old` + `new` arms, `--samples 1 --no-judge`); Axis B 20 (10 queries × rewrite + HyDE); flagship fee re-probe 1 (HyDE only; the rewrite was reused). **No 429s, no retries — verified**, not assumed: `withRetry` logs `retrying in Ns` to stderr on every retry, and `grep -c "retrying in"` over the captured batch-2/3/4 output returns **0** (batch 1 ran in the foreground with clean output). 59 is therefore an exact count, not a floor. |
| **Convex prod DB I/O** | **≈ 4.4 MB of the ~60 MB budget (7%)** | **11** `searchDocumentsAction` calls × ~0.4 MB (10 Axis B + 1 fee re-probe). **11** `cascadeRerank` calls — pure compute over documents passed in the request, no DB reads. **Zero** `retrieveContext` calls. **Zero** mutations. |
| **Prod calls avoided** | ~46 LLM + ~300 channel calls | by skipping `retrieval-ab/run.ts` (§1.2) |
| **Local compute** | 2 full passes over the 255 MB `crawledChunks` export | CPU-only, ~3 min total |
| **Wall clock** | ≈ 55 min | dominated by the 4 sequential Axis-A batches and Axis-B's 4.5 s free-tier pacing |
| **Writes made** | 2 locations only | this report, and `scratchpad/` (`axisB.ts`, `feeprobe.ts`, `aa_batch1..4.json`, `axisB_results.json`) |

**Infrastructure fences honoured:** no `npx convex deploy`, no crawls, no re-embeds, no prod mutations,
no new Convex deployment, no git commits/pushes/branch changes, no `git stash`. The dirty working-tree
file `scripts/eval/verify_retrieval_fixes.cjs` was **read only** and left untouched. No secret value was
printed — env checks were presence-only.

---

## 10. Limitations / denied or skipped checks

1. **`retrieveContext` not invoked** — it writes semantic-cache entries (previously denied,
   `[Modify Shared Resources]`). All retrieval measurements reconstruct the pipeline stage by stage.
   **Not attempted; no workaround constructed.**
2. **Convex dashboard not accessed** — WorkOS sign-in, explicitly out of scope. §5.4 is an
   export-derived **estimate** that accounts for ~439 MB of the reported 874.71 MB; the residual is
   attributed but not measured.
3. **`retrieval-ab/run.ts` not run** — 46 LLM calls for enrichment alone, no `--only` flag, hardcoded
   golden path (§1.2). Axis B used a 10-query stratified subset through an equivalent live shape instead.
4. **`verify_retrieval_fixes.cjs` not run** — ~17 Groq-primary LLM calls. Its regression-gate status is
   therefore carried over from the brief, **not re-measured**; its content produced F-7.
5. **`pnpm test` not re-run** — baseline taken from this session's `scratchpad/full_run.json`
   (492/496 passing, 4 suites failing). **No delta to report.**
6. **CRAG never invoked** — all "CRAG would run" statements are **estimated** from
   `topRerankScore` vs 0.6.
7. **`eligibility criteria` (`26e877048af0f6ee`) miss not root-caused** — it may be the same
   FAQ-channel label-matching artefact as the fee query (§3.1) or a genuine miss. Budget exhausted;
   recall is reported as a **range** (8–9/10 @8, 7–8/10 @4) rather than a point estimate.
8. **Single sample per case** (`--samples 1`, temperature 0.3). Axis A results are per-case verdicts,
   not stable rates.
9. **Prod `KNOWLEDGE_STORE_BACKEND` not read** — Pinecone inferred from `retrieval-ab/run.ts`'s docstring.
10. **Corpus statistics are from the 2026-09-05 export, not a live prod read** — and the export directory
    contains **two** files for the same table. `crawledChunks.jsonl` is the raw local-dev dump;
    `crawledChunks.import-ready.jsonl` is what was migrated to prod. They disagree by 152 MB, entirely in
    `headingPath`. An earlier draft of this report built a Critical finding on the wrong file; it was
    caught by cross-checking against the 44 live `headingPath` observations collected in Axis B and is
    documented in full in §5.3. **Any future corpus analysis must use `import-ready`.** The live Axis-B
    probe independently corroborates the remaining snapshot-based inferences (2021 IEEE editions are
    retrievable in prod today; header lengths match the import-ready distribution).
11. **`semanticCache` was never exported or sized.** The largest single term in the storage question is
    therefore unmeasured (§5.4). Reported as a residual, not attributed to a guess.

---

## 11. Remediation status (2026-09-18, post-audit implementation)

Implemented in the working tree, typecheck clean (`tsc --noEmit` exit 0), **45/45 unit tests passing
across the 9 related suites**. **Not deployed, and not exercised against the live deployment** — every
claim below rests on typecheck and unit tests only. The F-1 path in particular has never run against a
real CRAG verdict. Production deploy is the user's action.

| # | Finding | Status | Change |
|---|---|---|---|
| 1 | **F-5** semantic cache refusal guard | **FIXED** | `src/lib/chat/cache.ts` — cache write now requires `ragResult.sources.length > 0`. `setFromServer` has exactly one caller (verified by grep across `convex/` and `src/`), so this one guard closes the whole path. |
| 6 | **F-7** gate asserts a disputed fact | **FIXED** | `scripts/eval/verify_retrieval_fixes.cjs` — the fee check is now source-agnostic (`isUndergradFeeSource`, matching FAQ/prospectus/fee-structure urls while excluding `PG-fee`/PhD/M.Sc). Also warns when a postgraduate fee source outranks the undergraduate answer. |
| 4 | **F-1** PG fee tables outrank UG, CRAG skipped | **FIXED (option b)** | `convex/rag/retrieval.ts` — `classifyQueryRisk(safeQuestion) === "high"` forces CRAG regardless of rerank score. A forced run that leaves no survivor falls back to the **least-confidently-rejected** chunk (`pickLeastRejectedIndex`) under the `hedge` tier, never to the rerank's top hit. See the keep-rule note below. `allIrrelevant` still refuses even when forced. 6 unit tests in `tests/unit/crag-forced-fallback.test.ts`. |
| 5a | **F-3** superseded editions retrievable | **FIXED (retrieval-side)** | `convex/embeddings/search.ts` — new exported `dropOlderEditions` applied to `sortedEnriched` before the FAQ merge and the cut to `limit`. Conservative in three ways: a url with no year, or the only member of its family, is never dropped; two urls share a family only when identical apart from the year; and **a year the user explicitly asked for is protected**, so "IEEE annual report 2021" still retrieves the 2021 edition even though 2024 exists — mirroring the `askedYears` guard in `sanitizeRewrittenQuery`. 13 unit tests in `tests/unit/drop-older-editions.test.ts`. |
| 7 | **C-1** contested ground truth graded as truth | **FIXED** | `scripts/eval/golden_set_verified.jsonl` — 11 entries marked `groundTruth: "contested"`, `bb92759aba56e8f6` additionally `excludeFromScoring: true` with a reason. `scripts/eval/retrieval-ab/run.ts` honours both and now reports `recallAt8Uncontested` over the **14 clean scoreable** entries alongside the headline number. Counts independently reproduce §4.1 (50 total / 23 scoreable / 14 clean). |
| 3 | **F-2** silent budget-driven chunk loss | **FIXED** | `convex/rag/context.ts` — `console.warn` naming the dropped chunk's url and the budget shortfall. Truncate-to-fit deliberately not implemented; the condition is still latent and a warn makes it observable first. |

### Deliberately NOT implemented — each needs its own decision

| # | Item | Why it is held |
|---|---|---|
| 8 | **F-4** reranker formula (`shared / √(\|q\|·\|c\|)`) | **Not a drop-in, and shipping it alone would be a regression.** It changes the score *scale*, and three separate consumers read that score as an absolute: `skipThreshold` 0.6, `minWordOverlap` 0.1, and `determineConfidenceTier`'s tier boundaries. Worked example: `contact number` against a ~150-content-token chunk goes from `2/2 = 1.0` to `2/√(2·150) ≈ 0.12`; weighted with a perfect position score that is `≈ 0.47` — below `skipThreshold`. Every query would fall under it, CRAG would run on all traffic, and `determineConfidenceTier` would push the corpus into the hedge/refuse band. The `retrieval-ab` prototype used it for *relative* ranking, where scale is free. This is a two-part change — formula **plus** recalibrating all three thresholds against freshly measured distributions — and must be its own piece of work. |
| 5b | **F-3** `lifecycleStatus` backfill | Production mutation over 1,891 documents. Needs explicit authorization and an I/O budget. The retrieval-side filter above covers the symptom in the meantime; `isRetrievalEligibleLifecycle` remains dead code until this lands. |
| 2 | **F-6** `semanticCache` export / storage attribution | Unbudgeted prod I/O — pages the whole embedding-heavy table. Needs its own authorization. Item 1's refusal guard is the cheapest storage lever and ships regardless. |
| 9 | **F-8** shadow-mode `judgeFaithfulness` | Adds an LLM call to **every** production answer. That is a quota decision for the owner, not a code change to slip in — the same free tiers rate-limited the live bot for ~24h on 2026-09-15. |
| 10 | **S-5** dead `convex/rag/prompts.ts` | Pre-existing dead code. CLAUDE.md §3 says mention, do not delete. Unchanged, and flagged again here. |

### Why the no-survivor fallback is not `results[0]`

The first implementation of this guard kept `results.slice(0, 1)` — the top pre-CRAG chunk. On the
query the guard exists for, that is **`PG-fee.asp` at 0.850**: the very chunk CRAG was force-run to
reject. The answer model would have received an M.Sc. fee table as its single source under the hedge
tier's *"answer ONLY from the provided context"*, and presented a postgraduate fee as the BS fee with a
"based on limited information" prefix. A confident wrong number is worse than the refusal it replaced,
so that would have re-created F-1 through a new door.

The shipped rule uses CRAG's own verdicts: keep the chunk with the **lowest rejection confidence**
(`pickLeastRejectedIndex`, exported and unit-tested against the measured F-1 pool, where it must return
index 3 — the undergraduate FAQ — and explicitly not index 0). The `allIrrelevant` branch is
deliberately left refusing even on a forced run: every chunk there was rejected above
`highConfidenceThreshold`, so no chunk remains that CRAG had any doubt about, and refusing is the
honest answer.

### Cost consequence of the F-1 fix — read before deploying

`HIGH_IMPACT_KEYWORDS` is **25 terms** and broader than it first looks: besides `fee`, `tuition`,
`deadline`, `merit`, `entry test`, `admission`, `schedule`, `eligibility`, `result` and `registration`,
it also matches `apply`, `application`, `submit`, `submission` and `register` as plain substrings. A
question merely containing the word "apply" is high-impact. Forcing CRAG on `risk === "high"` therefore
adds one LLM call to a **large fraction of real traffic**, not a rare tail — measure it with the new
`[RETRIEVAL] CRAG forced (high-impact query above skipThreshold)` log line before assuming it is
affordable. Two mitigations
are already in place: `evaluateWithCrag` catches a failed judge and continues with the unmodified
results (so exhausting the quota degrades CRAG to a no-op rather than breaking answers), and
`demoteInsteadOfRefuse` prevents the extra run from ever producing a refusal. If quota pressure
appears, the narrowing is one line — replace `classifyQueryRisk(...) === "high"` with a tighter
fee/deadline/merit-only predicate.

### The regression gate was itself made stale by the F-1 fix

Forcing CRAG on high-impact queries changed which branch production takes, so
`verify_retrieval_fixes.cjs` — which mirrors that logic — would have simulated a path production no
longer follows, the precise failure this project has been bitten by twice. It now mirrors the new rule:
CRAG runs when the top score is below `skipThreshold` **or** the query is high-impact, `allIrrelevant`
always refuses, and no-survivors-without-allIrrelevant refuses only when the run was *not* forced.

The `HIGH_IMPACT_KEYWORDS` list is **read out of `convex/shared/freshnessPolicy.ts` at runtime** rather
than copied, and throws loudly if the declaration is reshaped. This was not caution for its own sake: a
hand-maintained copy was written first and had already drifted by 5 keywords (`submit`, `submission`,
`apply`, `application`, `last date to apply`) before the mismatch was caught by diffing the two lists.

**Verification gap.** `verify_retrieval_fixes.cjs` is ~17 **Groq-primary** LLM calls per run, plus one
CRAG judge per high-impact question now — the exact quota that rate-limited production on 2026-09-15.
None of the changes above have been exercised against the live deployment; they are verified only by
typecheck, lint, and unit tests.

---

## 12. Production incident, 2026-09-18 — F-5 was only half fixed

After the remediation deploy, the user re-ran the original question in the live chat and got the
refusal **three times**. Two distinct signatures appeared:

1. the exact verbatim refusal string with **zero sources** (attempts 1 and 3);
2. a *paraphrased* refusal **with 2 sources attached** — both `/FAQS.php` chunks, both containing
   `≈ Rs. 104,800` (attempt 2).

Signature 2 is the one that breaks the obvious hypotheses: the answering passage was in front of the
model and it still declined.

### What was measured, in order

| Stage | Result |
|---|---|
| Retrieval + rerank (live prod, production call shape) | `topScore 0.700`, **rank 1 = `/FAQS.php` containing the answer**, rank 2 the same page at 0.550 |
| Forced CRAG (`fee` is high-impact, so §11's fix makes it run) | `idx0 relevant=true conf=0.95`, `idx1 relevant=true conf=0.90`, `PG-fee.asp relevant=false conf=0.20`, advertisement `relevant=false conf=0.15` → **2/4 survivors, `allIrrelevant=false`, answers normally** |
| Answer model, offline, given exactly that context via the real `buildContext` + real `buildSystemPrompt` | **Answered correctly**, quoting both figures, citing both sources, and noting that detail beyond the first semester is not in the provided data |

So retrieval, the reranker, the newly-forced CRAG judge and the answer model were each verified
**working** on the exact failing question. The refusals were **cached entries being replayed**.

A hypothesis worth recording as *falsified*: the first guess was that §11's own forced-CRAG change had
caused the regression, since `fee` is a high-impact keyword and the `allIrrelevant` branch was
deliberately left refusing even on a forced run. The CRAG verdicts above disprove it — CRAG judged both
FAQ chunks relevant at 0.95/0.90 and dropped exactly the two chunks that should be dropped.

### The gap: the write guard cannot retract what is already stored

§11 item 1 stopped the pipeline from *writing* sourceless answers. It has no effect on the entries
already in `semanticCache`, and those are the worst possible residents: a 5-day TTL (the longest
bucket, assigned *because* there is no source url for `assignFreshnessTier` to classify) and an empty
`sourceEntryIds` that makes `findSourceInvalidation` return null on its first line — so they cannot be
evicted by re-crawling, and they are served to anything within 0.92 cosine.

### Fix: reject sourceless entries on READ

`convex/cache/get.ts` — new `isServableCacheEntry`, applied at **both** return sites in
`getCachedEntry`, folds the existing expiry check together with a sources check and logs
`[CACHE] Ignoring stored refusal (no sources) - treating as a miss`.

Chosen over purging the table deliberately: a purge is a destructive production mutation over an
embedding-heavy table whose scan cost is unbudgeted (§5.4 puts the unattributed residual at ~580 MB),
whereas the read guard neutralises the entire existing population the moment it deploys, costs nothing,
requires no authorization to delete user-visible data, and lets the poisoned rows age out on their own.

**Lesson for this project's verification practice.** Every check before this incident stopped at
retrieval, and each one passed while production was still broken, because the semantic cache sits in
front of retrieval and none of the probes went through it. `retrieveContext` — the only entry point
that consults the cache — was never exercised, having been denied earlier as a shared-resource write.
A green retrieval gate says nothing about what a user receives.

---

## 13. Production regression, 2026-09-18/19 — caused by §11's own F-1 fix

The refusal persisted after the §12 cache guard deployed. Production logs
(`npx convex logs --prod`) settled it in one record:

```
[RETRIEVAL] Query start            query: 'What is the fee stru...'
[CACHE] Miss
[SEARCH] Hybrid search complete    queryRisk: 'high'  mustAbstain: false  finalResults: 8
[RETRIEVAL] Search complete        resultCount: 4
[RETRIEVAL] CRAG forced (high-impact query above skipThreshold)   topRerankScore: 0.7
[RETRIEVAL] Query complete         resultCount: 0  sourceCount: 0  cragTier: 'refuse'
```

`topRerankScore 0.7` is **above** `skipThreshold`. Before §11, this query skipped CRAG entirely and
answered. §11 made `classifyQueryRisk === "high"` force the judge; the judge returned `allIrrelevant`;
and that branch had been **deliberately exempted** from the `neverRefuse` guard. Result: `resultCount 0`,
`sourceCount 0`, and the verbatim refusal string — the user's original bug, reintroduced through a new
door by the fix meant to prevent it. `demoteInsteadOfRefuse` never fired; its warn line is absent from
the logs because it only covered the *other* no-survivor exit.

### Why the diagnostics missed it

Six stage-by-stage probes all passed: retrieval put the answer chunk at rank 1 in 3/3 runs, a 6-run CRAG
variance test refused **0/6**, embeddings returned 768 dims, the cache returned a miss, and the answer
model — handed the real context — answered correctly. Every one reconstructed the pipeline; none ran
`retrieveContext`, which requires a Clerk user identity that a deploy key does not provide. The
composed function behaved differently from the sum of its parts, and only the logs showed it.

An earlier hypothesis in this same investigation — that the live bundle pointed at a second Convex
deployment (`happy-otter-123` appears in the shipped JS) — was checked and **falsified**: that string is
the example URL inside a `ConvexReactClient` error message, not a deployment. The app targets
`modest-peacock-120` correctly.

### Fix

`convex/rag/retrieval.ts` — the `allIrrelevant` branch now honours `neverRefuse`, and on a forced run
returns the **entire pre-CRAG pool** under the `hedge` tier rather than refusing or narrowing to one
chunk. When the judge rejects everything it has produced no usable ranking signal, so there is nothing
to demote toward, and keeping one chunk risks discarding the one holding the answer. Falling back to the
full set reproduces exactly what skipping CRAG would have done.

**The invariant now enforced: forcing the CRAG judge can never leave the user worse off than not running
it.** A forced run may reorder or qualify; it may not withhold.

### The verification lesson, restated

§12 already noted that a green retrieval gate says nothing about what a user receives. This incident
sharpens it: a green gate on *every individual stage* still says nothing, because the defect lived in
how the stages compose. The only two artefacts that revealed real user-visible behaviour in this entire
engagement were **the user's screenshot** and **the production logs** — neither of which any automated
check in this repo consults.

---

## 14. F-4 measured and REJECTED, 2026-09-19 — the reranker is inert, and retrieval is the real bottleneck

§8 item 8 parked the F-4 reranker formula change as "a two-part change — formula **plus**
recalibrating all three thresholds against freshly measured distributions". That measurement has now
been taken, and it does not support making the change at all.

**Harness:** `scripts/eval/rerank-position/run.ts`, over the ten stratified golden queries of §3.2.
One read-only production capture (10 `searchDocumentsAction` calls, ≈7% of the Convex Free-plan I/O
budget) frozen to `frozen.json`; every variant below is then re-scored offline for free.

The harness never recomputes `wordOverlap` — it **inverts** it out of the deployed score,
`overlap = (score − positionWeight × (1 − i/poolSize)) / overlapWeight`, recovering `i` by matching
each post-rerank candidate back to its pre-rerank position by `entryId`. This matters: the only chunk
text available is `evalRetrieveDocuments`' 500-char `contentExcerpt`, and a length-sensitive score
recomputed over truncated text would silently measure the wrong quantity. Inversion needs no text.

### 14.1 Every weighting of (overlap, position) ranks identically — including no reranker at all

| variant | recall@3 | recall@4 |
|---|---|---|
| **NULL: unfiltered fused order, no rerank, no filter** | **7/10** | **7/10** |
| deployed `0.6 × overlap + 0.4 × position` | 7/10 | 7/10 |
| pure overlap, position as tie-break only | 7/10 | 7/10 |
| 0.2/0.8, 0.5/0.5, 0.8/0.2 | 7/10 | 7/10 |
| RRF-style position `60/(60+i)` | 7/10 | 7/10 |

Identical totals **and** identical per-query hit patterns. The top-1 chunk is unchanged on **0 of 10**
queries under pure overlap.

### 14.2 Why — `computeWordOverlap` has almost no resolving power on real queries

Inverted overlap per candidate, in fused-retrieval order:

```
28c28a29   1 distinct value across 8 candidates:  1.00 x8
f3d60458   1 distinct value across 4 candidates:  1.00 x4
a694cc1c   1 distinct value across 8 candidates:  0.50 x8
9a07498d   2 distinct of 8      26e87704   2 distinct of 7
0a5abd0e   2 distinct of 4      a670a78c   2 distinct of 8      2dfb5097   2 distinct of 7
8fe9e8f2   3 distinct of 8      21ce9642   3 distinct of 8
```

`computeWordOverlap` divides shared words by the **query's** content-word count, and production
rewrites are 2–7 content words. The score is therefore quantised to a handful of values, ties are
pervasive, and the tie-break — the incoming fused order — decides the ranking. §3.4 reported this as a
short-query edge case; it is the general case. **On 3 of 10 queries the reranker cannot distinguish any
candidate in the pool from any other.**

This is the mechanism behind **S-1**, and it is a stronger statement than S-1 made. S-1 observed that
`topRerankScore` was 0.800–1.000 on 10/10 and concluded the tier bands were unreachable. The reason is
that the score is `positionWeight + overlapWeight × (a coarse ratio that is usually 1.0)`. On
`a694cc1c` every one of the 8 candidates scores overlap 0.50, the reranker has zero information, and
the pipeline still reports `topRerankScore 0.700` — above `skipThreshold`, so CRAG is skipped and
`determineConfidenceTier` returns `normal` with an empty instruction. **`topRerankScore` is not a
confidence signal, and gating CRAG and all four tier bands on it is unjustified.**

### 14.3 There is no headroom for any reranker on this query set

| | |
|---|---|
| recall@8 — relevant chunk anywhere in the pool | 7/10 |
| recall@4 — unfiltered fused order, before any rerank | 7/10 |
| **headroom (`recall@8 − recall@4`)** | **0/10** |
| relevant chunks eaten by `minWordOverlap` | **0/10** |

Every relevant chunk that reaches the candidate pool is **already inside the top 4** before reranking
runs. No reranking formula — lexical, length-normalised, or a real cross-encoder — can raise recall@4
here; it can only lower it. The `minWordOverlap` filter dropped 4, 4, 1 and 1 candidates on four
queries and never dropped a relevant one.

The three misses (`8fe9e8f2`, `21ce9642`, `26e87704`) are **pool misses**: the answering chunk never
entered the 8 candidates. Those are retrieval failures, not reranking failures.

### 14.4 Consequences

1. **The F-4 formula change is rejected, not deferred.** Shipping it would be churn against measured
   evidence of no effect. `tests/unit/cascade-score-scale.test.ts` continues to pin the current scale.
2. **Length normalisation (`shared/√(|q|·|c|)`) should not be measured on this query set.** With zero
   headroom it is structurally incapable of showing a gain. It needs a set with measured rerank
   headroom — pool contains the answer, top-4 does not — and this set contains no such query.
3. **The accuracy lever is retrieval recall@8**, not reranking or gate calibration. That is a
   different workstream and needs its own authorization and I/O budget.
4. Caveat carried forward from §3.1: the label matcher has a known false-MISS artefact (FAQ-channel
   rendering vs the `crawledChunks` row), and 4 of these 10 golden labels are flagged `contested`. Both
   affect the 7/10 **level**. Neither affects the **comparisons**, which use the same matcher on both
   sides. Note that `8fe9e8f2` is scored ABSENT here and §3.3 established that its answering passage
   *did* reach rank 4 through the FAQ channel — so at least one of the three "pool misses" above is
   very likely that same artefact, and `26e87704` was flagged in §3.1 as possibly the same.

### 14.6 Scope limit — the two findings do not rest on the same evidence

`evalRetrieveDocuments` issues **one** search with the rewrite text. Production fuses **three**
channels (rewrite dense, HyDE dense, lexical) before cutting to 8. The pool measured here is therefore
production-*shaped* but not production's pool, and the two findings above are not equally exposed to
that:

* **"Every weighting ranks identically" is robust.** It follows from the tie structure of
  `computeWordOverlap`, which is a property of query length and chunk content, not of how the pool was
  assembled. A 2-content-word query quantises overlap to {0, 0.5, 1.0} whatever produced the 8
  candidates. This is what the rejection of the F-4 formula change actually rests on.
* **"Headroom is zero" is pool-dependent and should be read as applying to this capture only.** A
  richer 3-channel fused pool could place a relevant chunk in the pool but outside the top 4, which is
  exactly the condition that would give a reranker something to do. Nothing here rules that out.

Establishing headroom on production's real fused pool needs the `retrieval-ab` harness (which builds
all three channels) with `--dump-text`, not this one — a larger, separately budgeted run.

### 14.5 A measurement error worth recording

The first run of this harness reported recall@4 falling 7/10 → 5/10 under pure overlap, and the top-1
chunk changing on 5 of 10 queries. Both were artefacts of the harness itself: inverting the score in
floating point leaves ~1e-16 of dust, and comparing unrounded overlaps promoted that dust to a ranking
decision. Genuine gaps between these overlap values are at least 1/12. Rounding to 1e-6 before sorting
collapsed the difference to 0/10 and 7/10 → 7/10. The harness now rounds, with a comment saying why.

A second error in the same run: the "no rerank" baseline was computed over `baselineBPostRerank`,
which is already past the `minWordOverlap` filter — so it compared the reranker against itself and
left the filter untested. The NULL row above uses `baselineAPreRerank`, the untouched pool.

### 14.7 The three "pool misses", diagnosed — real recall is better than 7/10 suggests

Diagnosed offline from the same frozen capture, no further production reads. The three are three
*different* things, and only one is a clean retrieval failure.

**`8fe9e8f2` "fee structure for BS Software Engineering" — degree-level confusion, channel-dependent.**
The entire 8-candidate pool is postgraduate: `/SED/PG-fee.asp` (×2), `/SED/downloads.asp`, the Rule
Book, `/CS/profile_MS.asp` (×2, PhD scholar profiles), `/Downloads/PGAdmissions/Prospectus-PG-2021-onwards.pdf`,
and an Electronics workshops page. **Not one undergraduate fee chunk.** This is F-1 in the raw: the
rewrite `"University of Engineering and Technology Taxila BS Software Engineering fee structure"`
matches the Software Engineering *department's* postgraduate fee page far more strongly than the
university-wide FAQ, and "BS" carries no weight against the department name. Note this capture uses a
single search channel; §3.3 established that production's three-channel fusion *does* surface
`/FAQS.php` here, so this is a channel-dependent miss, not a claim about live retrieval.

**`21ce9642` "degree certificate procedure" — a genuine miss.** The labelled `/ExamsFAQ.aspx` is
absent. The pool is topically adjacent but wrong: a provisional-degree-issue *form* PDF, the alumni
FAQ, the 1993 Ordinance, the 1994 Act, a PhD application form.

**`26e87704` "eligibility criteria" — the retrieval is good and the metric is under-crediting it.**
Rank 1 is `/Admission_Eligibility.php` ("eligibility criteria by program") and rank 4 is `/FAQS.php`
("FAQ: what are the eligibility criteria for admission? Answer: you must have passed F.Sc
(pre-engineering) / ICS…"). That is the answer. It scores a MISS only because `relevantChunkKeys`
names exactly one chunk — a different one — and retrieval found a better one.

**A real bug in the label matcher, with zero measured impact here.** `26e87704`'s label is defensible:
its own note records that the chunk's *body* is a nav link but its crawled **Document Title** field
states the fact ("Admission Procedure (Only those candidates are eligible to apply who appeared in
TCAT/ECAT-2025…)"). The matcher, however, strips exactly that prefix before taking its snippet —
`text.replace(/^Document Title: .*? URL Path: \S+\s*/, "")` — so a chunk whose relevance lives in its
title can never be matched even when it *is* retrieved. Measured both ways (body-only vs body-or-title):
**7/10 → 7/10, identical patterns**, because this chunk was not retrieved at all. Flagged, not fixed.
The same regex is in `scripts/eval/retrieval-ab/run.ts:loadLabels`.

**Consequence for every recall number in this document.** Of the three misses, one is a metric artefact
(`26e87704`), one is channel-dependent (`8fe9e8f2`), and one is real (`21ce9642`). 7/10 is a floor, not
an estimate. Before any retrieval work is justified by a recall delta, the ground truth needs
multi-chunk labels — "any chunk that answers this" rather than "this chunk" — or the metric will keep
scoring correct retrievals as failures and could drive a harmful change.

---

## 15. F-9 (High) — proof-of-concept rows from a local-dev experiment are live in the production corpus

Found 2026-09-19 while hydrating the §14 frozen capture with chunk text. Not previously reported.

### 15.1 What happened

`convex/crawl/lexicalProof.ts` is the Phase-5 "minimal lexical capacity proof". Its own header says it
loads the frozen Corpus V1 (`docs/rag-store-evaluation/local-corpus-v1-freeze-2026-08/`) into **"this
local dev deployment's `documents` + `crawledChunks` tables"**, and it deliberately writes chunks with
**no embedding** ("ZERO embedding/Gemini calls"), using a placeholder identifier:

```ts
ragId: `lexical-proof:${chunk.contentHash}`,     // lexicalProof.ts:127
crawlSessionId: "phase5-lexical-proof",          // lexicalProof.ts:58
```

The file even records that it was hardened after the fact because "that assumption no longer holds once
this code is deployed to real production". The rows are in production now, and there is **no cleanup
function anywhere in the repo**.

### 15.2 They are being retrieved and served

Measured over the §14 capture (10 golden queries, 79 unique retrieved candidates):

| | |
|---|---|
| candidates whose ragId is a `lexical-proof:` row | **4 / 79** (2 of 10 queries) |
| candidates with **no `crawledChunks` row at all** (dangling) | **5 / 79** |

```
0a5abd0e "Who is the Vice Chancellor?"   rank 1  -> /EventDetails/PEC-FYDP-Cheque-Distribution-...
0a5abd0e                                  rank 8  -> /oldWeb.asp
9a07498d "Can I freeze my semester?"      rank 2  -> /Advertisement_admission.php
9a07498d                                  rank 5  -> /Advertisements.php
```

A proof-of-concept row takes **rank 1** on the Vice Chancellor query.

Because these rows have no embedding, the dense channel can never return them — only the lexical/BM25
channel over `crawledChunks.search_text` does. They therefore enter the fusion through exactly one
channel, which the RRF weighting was not calibrated for, and `search.ts`'s dedupe-by-text can retain the
proof copy in preference to the properly embedded one.

They are not junk: they are real UET content from the 2026-08 freeze. That makes the harm **stale
duplicates crowding the candidate pool**, not gibberish — and it interacts with F-3/`dropOlderEditions`,
which reasons about editions using document metadata these rows do not carry in the normal way.

### 15.3 A second defect: the ragId is content-hash-keyed, so it collides

`lexical-proof:${chunk.contentHash}` is not unique per row — two chunks with identical content produce
the same ragId. All four observed `lexical-proof:` candidates resolve to **more than one**
`crawledChunks` row.

`crawledChunks.by_ragId` is read in 11 places. Two use `.unique()`, which **throws** on a duplicate:

| call site | verdict |
|---|---|
| `knowledgeStore/convexQueries.ts:69` `getChunkHitsByRagIds` | throws; reachable only via `convexAdapter`, which production bypasses (`KNOWLEDGE_STORE_BACKEND=pinecone`) and which only `lifecycleTest.ts` imports |
| `embeddings/doc_queries.ts:56` `getDocumentByEntryId` | throws; **has no callers at all** — pre-existing dead code, flagged not deleted per CLAUDE.md §3 |

**Live blast radius is therefore zero today** — the production path
(`doc_queries.ts:134 getDocumentsByEntryIds`) uses `.first()`. But `.first()` silently returns an
*arbitrary* one of the colliding rows, so a retrieved chunk can be attributed to the wrong source
document, and with it the wrong url, freshness tier, staleness flag and lifecycle status. Flipping
`KNOWLEDGE_STORE_BACKEND` to `convex` would turn the latent throw into a live retrieval crash.

### 15.4 Recommended remediation — needs authorization, deliberately not actioned

This is a corpus mutation and is out of scope for anything this session was authorized to run.

1. **Scope it first.** Count `documents` with `crawlSessionId === "phase5-lexical-proof"` via the
   existing `by_session` index, and their chunks. Cheap and read-only; no such query exists yet.
2. **Prefer a read-side guard to a delete**, on the same reasoning as the cached-refusal fix in
   `cache/get.ts`: excluding `lexical-proof:` ragIds in the lexical channel neutralises the whole
   population at once, is reversible, and destroys nothing. Only do this after step 1 confirms the
   content also exists in properly embedded form, or it would remove real answers.
3. Change the two `.unique()` calls to `.first()` (or fix the ragId scheme) so a data collision cannot
   become a retrieval crash.
4. ~~Separately investigate the 5/79 dangling candidates~~ — **WITHDRAWN, see §17.** Those are FAQ-channel
   candidates carrying `faqs` table ids, not dangling references. Not a defect.

---

## 16. F-10 (Critical) — the semantic cache has never written an entry in production

Found 2026-09-19 from production `traceSpans`. Explains the empty `semanticCache` table observed
during the §12 investigation, which at the time was read only as "no cached refusal is masking the fix".

### 16.1 Evidence

`src/lib/chat/cache.ts:buildCacheWriteCallback` refuses to write without a server-trust secret and logs
the refusal once per serverless instance:

```
name:       semantic_cache_write_skipped
reasonCode: INTERNAL_API_SECRET_MISSING_ERROR
status:     error
```

Production `traceSpans` holds **15** of these, spanning **2026-09-15 18:46:53 → 2026-09-19 04:48:08 UTC**,
and the most recent of them is the **newest row in the entire table**. Presence checks on both sides of
the handshake (names only, no values read):

| | `INTERNAL_API_SECRET` |
|---|---|
| Vercel production (`.env.vercel-production.local`, pulled) | **absent** |
| Convex production (`npx convex env list`) | **absent** |

Both are required. `convex/cache/set.ts:setFromServer` admits a write only when
`args.secret && internalSecret && constantTimeCompare(args.secret, internalSecret)`, and otherwise
throws `"Authentication required or invalid API secret"` — so even setting it on Vercel alone would
still fail, silently from the user's point of view, because the write is fire-and-forget inside `after()`.

### 16.2 Consequence

**Every user question runs the full pipeline.** Embedding, vector search, cascade rerank, CRAG where
forced, and answer generation — on every request, with no query ever served from cache. The
`[CACHE] Miss` line in the logs is not a cold cache warming up; it is the only outcome the system can
produce.

This is an accuracy finding, not merely a cost one:

1. **Quota burn.** The LLM call volume is the maximum the design allows. The live bot was rate-limited
   for ~24h by Groq's free daily budget on 2026-09-15 — the same date as the earliest skip event
   recorded here. See the limitation below before reading that as proven causation.
2. **Fallback drift.** When the primary model is rate-limited, `LLM_FALLBACK_CHAIN` moves traffic to a
   different model mid-incident, so answer quality changes for reasons unrelated to retrieval.
3. **No answer consistency.** With `temperature: 0.3` and non-deterministic retrieval, the same question
   asked twice can return materially different answers. The cache is what would have made a verified
   good answer reproducible.
4. **Latency on every request**, which compounds the streaming-deadline defect fixed in `b6dbf24`.

It also means the W1 cache-refusal guards shipped earlier this session (`cache/get.ts` read guard,
`cache.ts` write guard) are — for now — protecting a path that never executes. They remain correct and
necessary the moment the secret is set, which is precisely when a bad entry could first be stored.

### 16.3 Limitation

`traceSpans` itself contains no row older than 2026-09-15, so this evidence cannot distinguish "the
cache write broke on 2026-09-15" from "operational-event logging began on 2026-09-15". What is
established is that **throughout the entire observed window, including the most recent request, no
cache write has succeeded**. The correlation with the 2026-09-15 Groq rate-limiting incident is
suggestive, not demonstrated.

### 16.4 Fix — requires the user; secret values are out of scope for this session

Generate one shared secret and set it in **both** places, then redeploy:

```
npx convex env set INTERNAL_API_SECRET '<value>' --env-file .env.vercel-production.local
# and add the SAME value to Vercel: Project → Settings → Environment Variables → Production
```

Afterwards, confirm the fix by checking that no new `semantic_cache_write_skipped` row appears in
`traceSpans` and that `semanticCache` becomes non-empty. Note the W1 guards will then be live for the
first time, so watch for `[CACHE] Ignoring stored refusal` lines — those indicate the guards working,
not a regression.


---

## 17. The FAQ channel is structurally invisible to the golden-set metric

Correction to §15.4 item 4, and the precise mechanism behind §14.7's "7/10 is a floor".

### 17.1 What the "dangling" candidates actually were

§15.2 reported 5/79 retrieved candidates with no `crawledChunks` row and §15.4 filed them as a second
integrity failure to investigate. That was wrong. `convex/embeddings/search.ts:243-248` merges verified
FAQs into the candidate pool with ids from the **`faqs` table**:

```ts
.map((faq: FaqResult) => ({
  entryId: faq._id,                                        // a `faqs` id, NOT a crawledChunks ragId
  content: `FAQ: ${faq.question}\nAnswer: ${faq.answer}`,  // and a different rendering
  ...
```

Looking those ids up in `crawledChunks` by `ragId` correctly returns nothing. Nothing is dangling and
there is no second integrity failure. The genuine F-9 rows are a separate, smaller set: of the 6
unresolvable top-4 slots, **2 are `lexical-proof:` rows and 4 are FAQ-channel chunks**
(`/FAQS.php` ×3, `/ExamsFAQ.aspx`).

### 17.2 Why this makes the recall metric structurally wrong

The golden set's `relevantChunkKeys` are `crawledChunks` chunkKeys, and the label matcher compares
against `crawledChunks` row text. **An FAQ-channel answer can therefore never match a label, however
correct it is.** Every query the FAQ channel answers scores a MISS by construction.

This is the mechanism §3.1 half-saw — it reported the flagship fee query as "a MISS that manual
inspection shows reached rank 4 through the FAQ channel, whose rendering differs from the
`crawledChunks` row the label was taken from" — and filed it as a matcher *artefact* affecting one
query. It is not an artefact. It is a structural blind spot affecting **every** FAQ-answered query.

Measured over the §14 capture: **4 of 40 top-4 context slots (10%) are verified FAQ answers**, and they
are invisible to scoring. `26e87704` ("eligibility criteria") is fully explained by it — §14.7 found its
top-4 contains the `/FAQS.php` chunk stating the criteria outright, while the metric scored it a miss.

> **Correction (see §22).** An earlier version of this section said retrieval "nailed" `26e87704`
> because rank 1 was `/Admission_Eligibility.php`. That judged the URL, not the content. Read as text,
> rank 1 carries **37 characters** after boilerplate — the bare heading "Eligibility Criteria by
> Program" — rank 2 is a link list and rank 3 is an off-topic Software Engineering *events* page. Only
> rank 4, the FAQ, answers the question. The section's actual claim stands (a correct FAQ answer cannot
> match a chunk-key label), but retrieval on that query was one useful chunk out of four, not four.

This is the good news the label-based number was hiding: verified FAQs are the highest-quality source in
the corpus (human-curated, `verified_faq` in the schema's source enum), the FAQ merge is working, and
**the metric penalises retrieval precisely when it returns the best available answer.**

### 17.3 Consequence, and a cheap workaround that was tried and does NOT work

Any future retrieval change scored against this golden set is scored by a metric that cannot see 10% of
the context and is biased *against* the best channel. This is a prerequisite to retrieval work, not a
refinement.

The obvious cheap fix - score a *page-level* axis alongside the chunk-level one, crediting any retrieved
chunk whose URL matches the labelled chunk's URL, which would let an FAQ rendering of a labelled page
count - was implemented and measured over the §14 capture. It recovers nothing:

| axis over the same production top-4 | recall@4 |
|---|---|
| chunk-level (current: 60-char snippet containment) | **7/10** |
| page-level (URL of the labelled chunk appears in the top 4) | **7/10** |

The two axes agree on all ten queries. The reason is that the blind spot is not a *rendering* mismatch,
as §3.1 assumed - it is a *document* mismatch. On `26e87704` the labelled chunk is on
`/ProcedureAndRequirements.php` while the FAQ that actually answers the question is on `/FAQS.php`: a
different page, so no URL-based rule can connect them.

**Therefore the ground truth genuinely needs new labels, not a smarter matcher.** Each affected query
needs a human decision that "this FAQ entry also answers this question", recorded with its own
provenance tier. That is a labelling judgment on a human-curated dataset and is deliberately left to the
project owner; it is not something to infer automatically, which is exactly how a golden set stops being
ground truth.

### 17.4 One hypothesis tested and rejected, recorded so it is not retried

Inspecting the real top-4 text suggested navigation boilerplate ("Quick Links", "Visual resource",
"Untitled Document") was consuming context slots. Measured with `retrieval-ab`'s own detector
(`linkShare >= 0.6`, the threshold its `demote`/`dedupeNav` rows use): **0 of 40 top-4 slots** qualify.
The hypothesis is not supported at that threshold and the nav-demotion experiment should not be
prioritised on the strength of eyeballing chunk text, which is what suggested it.

---

## 18. F-11 (High) — "Freshness state: fresh" means recently CRAWLED, not current edition

### 18.1 The defect

`convex/shared/freshnessPolicy.ts:classifyFreshness` derives `state` from `crawledAt` against a
per-tier TTL, plus the `isStale` flag. It therefore measures **when we last fetched the page**, not
which edition the content is. `convex/rag/context.ts:formatChunkHeader` renders that into the prompt as

```
Freshness state: fresh
Applicability: current
```

and `GROUNDING_RULES` told the model to treat those labels as authoritative — *"only present a value as
current if its source is marked fresh and current"*. **A 2023 fee document, crawled last week, passes
that test.** The rule's protection is defeated by the very label it depends on.

`applicability` carries no independent signal either: it is `"current"` whenever state is fresh and
`"unknown"` otherwise, so it restates `state` rather than adding to it.

### 18.2 Measured over the §14 capture

All 40 top-4 context slots were labelled `freshnessState: fresh` and `applicability: current`; zero were
`unknown` or `aged`. `freshnessTier` was absent on all 40, so it renders as `"unknown"`.

Of the 4 slots whose URL carries a year, **3 are at least two editions behind — and all 3 are labelled
fresh/current**:

| query | year | document |
|---|---|---|
| `a694cc1c` contact number | **2017** | `/techJournal/2017/No4/TECHNICAL_JOURNAL_VOL_22_NO_4.pdf` |
| `2dfb5097` **fee structure** | **2023** | `/Downloads/Rule-Book-2023.pdf` |
| `0a5abd0e` Vice Chancellor | 2024 | `/EventDetails/PEC-FYDP-Cheque-Distribution-...` |

The `2dfb5097` row is the sharp one: the query is about fees, and a 2023 document is presented to the
answer model as authoritative-current.

This is the same family as F-3 (`lifecycleStatus` is a no-op, so every old edition stays retrievable):
F-3 lets the old edition be retrieved, F-11 tells the model to trust it.

### 18.3 Fix shipped, and what was measured

The freshness rule in `src/lib/prompt.ts` now states what the labels actually mean and sends the model
to the year/session written in the source text. A/B against the real answer model
(`openai/gpt-oss-120b`, `temperature: 0.3`, production's frozen top-4 for "fee structure", only that one
rule varied), `scripts/eval/freshness-ab/run.ts`:

| | OLD rule | NEW rule |
|---|---|---|
| tells the user to confirm with the university | **0/5** | **4/5** |
| tripped the refusal detector (regression check) | 0/5 | 0/5 |
| names an edition / flags that none is stated | 5/5 | 5/5 |

The 0/5 in the first row is the defect made visible: the old rule's own *"otherwise … tell the user to
confirm"* branch never executed, because its precondition is satisfied by every chunk production
retrieves.

**The third row does not discriminate and is reported only so it is not quietly dropped.** Its regex
matches words present in the frozen context itself ("prospectus", "rule book", a bare year), so any
answer quoting the context trips it under both arms — a metric-design flaw of the same kind as the
`isRefusalAnswer` mis-measurement recorded in §13.

**Not tested:** whether the new rule over-qualifies when a source genuinely *is* the current edition.
The frozen context contains no such case — the FAQ chunk carrying the figures states no year at all.
That is the check to run if answers start hedging too much.

### 18.4 The header-side fix was built, measured, and REJECTED as redundant

The obvious follow-up — stop instructing the model around bad metadata and instead surface the
edition directly, by extracting the year from the URL/title (as `dropOlderEditions` already does) and
adding a `Source year:` line to `formatChunkHeader` — was implemented, unit-tested and measured. It
does not work, and the reason is instructive.

Coverage first, over all 56 distinct source URLs in the §14 capture: 14 identify a year, 42 do not. The
14 are clean, with no false positives from phone numbers or fee amounts, and two are only reachable
through the title — `/EnergyEnggTech/Curriculum.asp`, whose URL carries no year at all but whose title
is *"Course Scheme for session 2017"*, and `/ProcedureAndRequirements.php` → *"TCAT/ECAT-2025"*. So the
extractor itself is sound.

The A/B (shipped rule held fixed, only the header varied, same model and temperature):

| | without `Source year` | with it |
|---|---|---|
| names the Rule Book's **2023** edition | **5/5** | 4/5 |
| says the fee source states no year | 0/5 | 1/5 |
| refusal regression | 0/5 | 0/5 |

**The model already names 2023 five times out of five without the line.** `formatChunkHeader` renders
`Source: [${title}](${url})`, so `/Downloads/Rule-Book-2023.pdf` is already in the context — the new
field restated information the model could already read.

That reframes F-11 correctly. **The edition was never hidden; the freshness labels were actively
contradicting it.** The model could see `Rule-Book-2023.pdf` and was simultaneously told
`Freshness state: fresh / Applicability: current` and — by the old rule — that this licensed presenting
the value as current. The defect is the false assertion, not a missing field, which is why the prompt
fix in §18.3 works (0/5 → 4/5) and the header fix does not.

The change was reverted rather than shipped; `convex/shared/sourceEdition.ts` and its tests were
removed rather than left as unused code.

### 18.5 And edition-aware freshness is rejected too — the "old" documents are the newest there are

The remaining proposal was to make `classifyFreshness` itself edition-aware, so a 2023 document would
report `aged` instead of `fresh`. Probed before building it
(`scripts/eval/rerank-position/editions.ts`, four read-only `evalRetrieveDocuments` calls). The premise
is false:

| probe | what the corpus actually holds |
|---|---|
| "Rule Book" | **all 8 candidates are `/Downloads/Rule-Book-2023.pdf`.** No 2024 or 2025 edition exists. |
| "admission guidelines" | only `Admission_Guidelines_2023.pdf`; its 2024 hit is `/icacee2024`, a conference — a different family |

`Rule-Book-2023.pdf` is not a stale edition. **It is the current rule book** — the newest UET has
published. Marking it `aged` would be wrong in the opposite direction, and not merely cosmetically:
`aged` sets `penalized: true`, which applies `DEFAULT_STALE_SCORE_MULTIPLIER` (0.3) at `search.ts:549`,
rescaling the score that every relevance gate compares against. On a corpus whose newest documents are
several years old, an absolute-year rule would demote the best available source on exactly the
high-stakes queries (fees, rules, admission guidelines) and could push it under `skipThreshold` into the
hedge tiers. That is a regression, not a fix.

The signal that *is* correct here is the relative one — "does a newer edition of this same family
exist?" — and it is **already implemented and shipped** as `dropOlderEditions`
(`convex/embeddings/search.ts:139`), which filters superseded editions before rerank.

So F-11 is closed by the §18.3 prompt fix alone, and that fix is the right shape: the honest thing to
tell a user is *"the latest rule book is from 2023"*, not to hide it or to pretend it is current. Both
alternatives — a header field (§18.4) and edition-aware freshness (§18.5) — were built or probed and
rejected on evidence rather than dropped silently.

What remains open is narrower than previously stated: `freshnessState` conflates "recently crawled" with
"current", and the label would be more honest **renamed** (e.g. `Last fetched`) than re-derived. That is
cosmetic next to the answer behaviour, which the §18.3 prompt fix already corrects.

---

## 19. CORRECTION — the §14 capture under-represents the FAQ channel, and the FAQ gate is NOT defective

### 19.1 The near-miss

`faqCoverage` divides shared content words by the **asked** question's length, and the merge drops any
FAQ below `FAQ_MIN_COVERAGE` (0.5). Run against the §14 capture's rewrites, that looked like a critical
defect on the flagship query:

```
8fe9e8f2 "What is the fee structure for BS Software Engineering at UET Taxila?"
   raw question : coverage 0.50  PASSES   <- "What is the fee structure for the first semester?"
   rewrite      : coverage 0.40  FILTERED    ("University of Engineering and Technology Taxila BS ...")
21ce9642  raw 0.50 PASSES -> rewrite 0.00 FILTERED
```

The rewriter expands "UET" to "University of Engineering and Technology", and the added content words
dilute the ratio below the gate — discarding the FAQ that states the fee outright.

**It is not a production defect.** `convex/embeddings/search.ts:607` already gates on the raw question:

```ts
const matchedFaqs = (await fetchActiveFaqs(ctx, args.questionText ?? args.queryText))
```

and `convex/rag/retrieval.ts:217` passes `questionText: safeQuestion`. Production has always matched
FAQs against what the user actually asked. This is consistent with §3.3, which found the FAQ chunk
*did* reach rank 4 on this query in production.

### 19.2 What IS wrong: the harness, and therefore some numbers above

`convex/rag/evalRetrieval.ts` never forwarded `questionText`, so every capture made through it gates
FAQs against the **rewrite**. The harness is therefore systematically *weaker than production at
retrieving verified FAQs* — the corpus's highest-quality source (§17).

Consequences for figures already reported here:

* **§14.7's `8fe9e8f2` "the entire pool is postgraduate, not one undergraduate fee chunk" is a harness
  artefact**, and now has a precise mechanism: the FAQ carrying the fee was gated out at 0.40 before
  the pool was assembled. §14.7 flagged it as channel-dependent; this is the specific channel.
* `21ce9642` is affected the same way and should no longer be called a "genuine miss" without a re-run.
* The 7/10 recall figure is a floor for a second, independent reason on top of §17's.
* §14's core finding is **unaffected**: every (overlap, position) weighting ranks identically, which is
  a property of the tie structure within whatever pool is handed to the reranker.

### 19.4 A SECOND harness gap, found later — only one of production's two dense channels

`questionText` was not the only omission. On the Pinecone path — the production backend — `search.ts`
sets `finalQueryText = args.hydeQuery` and then embeds **two** dense channels:

```ts
const denseTexts = [finalQueryText];                     // the HyDE paragraph
if (args.questionText && args.questionText !== finalQueryText) {
  denseTexts.push(args.questionText);                    // and the raw question
}
```

Its own comment records why, with measured recall: *"HyDE alone, 70% with the question alone, and 83%
with both. HyDE helps bare keyword queries; the question helps natural questions HyDE paraphrases
away."*

`evalRetrieveDocuments` passed neither, so every capture ran **one** dense channel — the rewrite —
where production runs two, and the precomputed `queryEmbedding` it passes is ignored entirely on this
path. The harness therefore understates pool quality on the dense side as well as the FAQ side.

This compounds §19.2: **`frozen.json`'s pools are weaker than production's in two independent ways.**
Every pool-composition figure derived from it — §14.7's misses, §22's stub counts, §26's
contextualization coverage — is a lower bound on production, not an estimate of it.

Both `questionText` and `hydeQuery` are now forwarded (`evalRetrieval.ts`), but the fix **cannot be
deployed** — `npx convex deploy` is refused by the auto-mode classifier — so `frozen.json` has not been
re-captured and the figures above stand as recorded, with this caveat attached. Re-running the §14
capture after that deploy is the first thing worth doing.

Findings NOT affected, because they do not depend on which chunks are in the pool: §14's core result
(every (overlap, position) weighting ranks identically — a property of the tie structure inside whatever
pool arrives), §23's fusion-weight arithmetic, §24's CRAG confidence distribution, and §25's
`isQualityChunk` root cause.

### 19.3 Why this was nearly reported as a critical bug

The measurement was real and the arithmetic was right; the error was measuring the harness's behaviour
and attributing it to production. The check that caught it was reading the actual call site rather than
stopping at the gate function — the same failure mode as §13's "component-green / system-red", in the
opposite direction: a component measured red while the system was green.

---

## 20. F-12 (High) — Roman Urdu questions cannot reach a verified FAQ at all

### 20.1 The defect

Verified FAQs are the highest-quality source in the corpus (§17): human-curated, `verified_faq` in the
schema's source enum, and measured occupying 4 of 40 top-4 context slots. Two independent layers decide
whether one is merged into retrieval, and **both were keyed on the user's untranslated words**:

1. `convex/faq.ts:searchFaqs` — a full-text search over the **English** `faqs.question` field.
2. `convex/embeddings/search.ts:fetchActiveFaqs` — `faqCoverage(queryText, faq.question)` against
   `FAQ_MIN_COVERAGE` (0.5).

The call site passed one string, `args.questionText ?? args.queryText`, i.e. the raw question. Measured
against the real FAQ corpus (`scripts/faq/official-faqs.json`, 32 entries):

| asked | coverage vs the FAQ that answers it | |
|---|---|---|
| `fees kitni hai BS Software Engineering ki` | **0.00** | filtered |
| `admission k liye zaruri documents kya hain?` (golden `a670a78c`) | **0.29** | filtered |
| …the same question after rewrite: `required documents for university admission` | **1.00** | passes |

Roman Urdu shares no content token with an English FAQ question, so coverage is 0 — and the search
index, being over English text, returns no candidates for it in the first place. The FAQ is dropped
twice over, before any scoring happens.

This is not an edge case. Roman Urdu is a **first-class supported input**: `rewriteQueryAction`'s system
prompt handles it explicitly with worked examples ("fees kitni hai", "daakhila kab hoga"), and the
verified golden set includes such a query. The rewrite is the only phrasing that has been translated
into the FAQ's language — and it was the one phrasing the FAQ path never saw.

### 20.2 Fix

`fetchActiveFaqs` now takes every phrasing of the question: each distinct text runs the search (results
merged by id) and coverage is the best across them, via a new pure `bestFaqMatch` in
`convex/shared/faqMatch.ts`. The call site passes the raw question **and** the rewrite.

English behaviour is unchanged, and this is asserted rather than assumed: on
`"What is the fee structure for BS Software Engineering at UET Taxila?"` the raw question scores 0.50
and its rewrite only 0.40 — expanding "UET" to "University of Engineering and Technology" adds content
words that *dilute* a ratio normalised by the asked question's length — so the max is the raw question's
score either way. 4 unit tests in `tests/unit/faq-roman-urdu.test.ts` cover the Roman Urdu recovery, the
English no-change, and that an unrelated FAQ is still rejected under every phrasing.

Cost: one extra `searchFaqs` query per request when the two texts differ, over a 32-row table.

### 20.3 Known residual, not fixed

`faqCoverage` normalises by the **asked** question's length, so politeness and greetings still dilute it:

```
0.50 PASSES   "what is the fee structure for BS Software Engineering at UET Taxila"
0.29 FILTERED "assalam o alaikum, can you please tell me what is the fee structure for BS ..."
```

Both want the same FAQ. The greeting words are content tokens and dilute the denominator.

**Correction to an earlier draft of this section:** it claimed "there is no stemming". That is wrong —
`contentTokens` does stem (`structure` → `structur`, `software` → `softwar`, and
`contentTokens("freezing programs")` equals `contentTokens("freeze program")`, asserted in
`tests/unit/faq-match.test.ts`). What is true is narrower: the stemmer does not reduce `fees` to `fee`,
so that particular plural misses. (`engineering` is separately a stop word.)

**The normalisation was then measured rather than left as an open question.** Five candidates, scored
over every FAQ used as its own query plus a greeted variant (ground truth true by construction), at the
same 0.5 gate:

| normalisation | verbatim passes | greeted passes | wrong FAQ passes gate |
|---|---|---|---|
| current `m/|asked|` | 30/32 | 27/32 | 2 |
| symmetric `max(m/|a|, m/|f|)` | 28/32 | 30/32 | 6 |
| **Dice `2m/(|a|+|f|)`** | **32/32** | **32/32** | **0** |
| overlap `m/min(|a|,|f|)` | 28/32 | 30/32 | 6 |
| Jaccard `m/|union|` | 32/32 | 27/32 | 0 |

Dice dominates on every axis. Checked against the **10 real golden queries** as well (raw question and
rewrite, max of both): **no gate decision changes on any of them**, and one selection improves —
`21ce9642` "procedure to apply for a degree certificate" currently picks *"How to apply for a particular
Bonafied Certificate?"* while Dice picks *"How to apply for the Degree?"*. That is precisely the tie
`faqSpecificity`'s own docstring describes as unbreakable by coverage; Dice breaks it correctly, because
the longer Bonafide question is penalised by its own length.

**Not implemented, deliberately.** The strongest numbers above are synthetic — the verbatim row is
trivially favourable to Dice, since a question matched against itself scores 1.0 by construction — and
the real-data evidence is 10 queries showing one improvement and no regressions. That is encouraging but
thin for a change that moves the gate for *every* query and silently redefines what the 0.5 threshold
means. It wants an end-to-end A/B over a larger query set, which needs the Convex deploy that is
currently blocked. Recorded here with its evidence so the next person starts from the measurement rather
than the idea.

### 20.4 Deployment

**Not deployed.** `npx convex deploy` is refused by the auto-mode classifier, so this joins the queue
with the §15 scoping query, the duplicate-ragId fix and the §19 harness fix.

---

## 21. F-13 (High) — a long conversation bricks itself permanently

### 21.1 The defect

`src/lib/chat/validate.ts` bounded the prompt by rejecting the request outright:

```ts
const MAX_TOTAL_CHARS = 32_000;
if (totalChars > MAX_TOTAL_CHARS) {
  return NextResponse.json({ error: "Request body too large" }, { status: 413 });
}
```

The bound itself is right — it exists so an unbounded prompt cannot run up token cost. The **failure
mode** is not. Assistant replies are capped at `maxOutputTokens: 2000` (~8,000 characters,
`src/lib/chat/pipeline.ts`) and are stored and resent as conversation history, so a thread of
substantive answers — exactly what this bot produces for fee, admission and eligibility questions —
crosses 32,000 characters after roughly **four exchanges**.

From that point the thread is **permanently unusable**: every subsequent message 413s, the user is told
only "Request body too large", and nothing indicates that the thread is the problem or that starting a
new one would fix it. It cannot self-heal, because the history that broke it is resent every time.

### 21.2 Fix

`trimHistoryToBudget` keeps the newest turns that fit and drops the oldest, rather than failing. A 413
is still returned when the newest message *alone* exceeds the budget, which is a genuinely oversized
request.

The cost bound the original code protected is unchanged — the prompt still stays under 32,000
characters, asserted directly in the tests. And dropping old turns is what the rest of the pipeline
already assumes: `pipeline.ts:92` passes only `history.slice(-6)` to retrieval, so the dropped turns
were contributing nothing to the answer while consuming the budget that broke the request.

6 tests in `tests/unit/history-budget.test.ts`, including the ~4-exchange thread that used to 413, that
the asked question always survives, that the oldest go first, and that the cost bound still holds.

### 21.3 A test bug worth recording

The "drops the oldest turns" test initially failed — and the *test* was wrong, not the code. Its fixture
summed to 28,050 characters, under the 32,000 budget, so keeping all three turns was correct behaviour.
Corrected to 38,050. Noted because a failing test is not automatically evidence of a broken
implementation, and this one nearly prompted a "fix" to code that was right.


---

## 22. F-14 (Medium) — near-empty stub chunks occupy answer-context slots

Measured over the 34 top-4 chunks whose text is resolvable (the other 6 are FAQ-channel or F-9 rows),
stripping the crawler's own `Document Title: … URL Path: …` prefix and `Source: <…>` line, which are
identical on every chunk of a page and carry no answer content:

| | |
|---|---|
| top-4 slots with **under 150 characters** of real content | **5 / 40** |
| chunks that are **≥50% boilerplate** | 3 / 34 |
| chunks that are **≥30% boilerplate** | 8 / 34 |
| median content length | 618 chars |
| smallest | **95 chars total, 54% boilerplate** |

The clearest case is `26e87704` "eligibility criteria", whose **rank 1** is
`/Admission_Eligibility.php` at **37 characters** of content — the heading "Eligibility Criteria by
Program" and nothing else. A context slot is spent on a heading while the answer sits at rank 4.

This is the same family as the audit's earlier observation that `ProcedureAndRequirements2.php`
candidates are "confirmed near-empty stubs (full text is just the title + source URL)", now quantified
across a real retrieved population rather than one query.

**Why it is only Medium.** `buildContext` is nowhere near its budget — §18's measurement showed the
largest rendered context at 5,212 of 12,000 characters — so a stub is not evicting a better chunk on
length. The cost is the top-K cut: `rerankSearchResults` keeps 4, so a stub in the top 4 is one of four
chances to include the answer, spent on nothing.

**Candidate fix, not implemented.** Drop candidates below a minimum real-content length before the
top-K cut. It is cheap and the data to size the threshold is in
`scripts/eval/rerank-position/chunks.json`. It is not implemented here for the same reason as §20.3's
Dice normalisation: it changes which chunks reach every answer, and the only metric available to
validate it cannot see FAQ-channel answers at all (§17) — so a recall delta would be measuring the
wrong thing. The FAQ ground-truth decision gates this too.

---

## 23. F-15 (Medium) — the "adaptive" fusion weights are inert, and the rewrite pushes them the wrong way

`convex/embeddings/idf.ts:estimateIdf` sets the weights `hybridRank` fuses the dense and lexical
channels with. Despite the file name it never consults the corpus: `rareTermRatio` is
`uniqueRatio * 0.6 + min(1, avgWordLength/8) * 0.4`, i.e. **non-repetition and word length**, not term
rarity. True IDF needs document frequencies; this is a proxy for them.

### 23.1 It carries almost no information

Measured over the 10 golden queries, each in both phrasings (raw question and the rewrite production
actually searches with) — 20 measurements:

| | |
|---|---|
| `rareTermRatio` observed range | **0.85 – 1.00** (theoretical 0–1) |
| saturated at exactly 1.00 | **6 / 20** |

The compression is structural, not a sampling accident. Any query whose content words do not repeat has
`uniqueRatio = 1`, so `rareTermRatio ≥ 0.6` before word length is considered. The consequences:

* **The `{vector: 1.5, text: 0.5}` setting for short queries is unreachable.** It applies only when
  `rareTermRatio ≤ 0.7`, which with non-repeating words needs average content-word length **≤ 2
  characters**. Every short query in the sample got the `{1.2, 0.8}` override instead.
* In the 5–15 word band, `rareTermRatio ≈ 0.9–1.0` collapses the formula to `vector ≈ 1.0–1.05`,
  `text ≈ 0.95–1.0` — i.e. **`{1.0, 1.0}`, no adaptation at all**.
* The `> 15 words` branch never fired; production rewrites are capped at 12 words by
  `rewriteQueryAction`'s own prompt.

So the adaptive weighting resolves, in practice, to exactly two fixed settings: `{1.2, 0.8}` for short
queries and ≈`{1.0, 1.0}` for everything else.

**This is the third mechanism in this pipeline measured to be inert**, after the Tier-1 reranker score
(§14: every weighting ranks identically) and the freshness label (§18: 40/40 slots read "fresh").
Each is computed, consumed by a downstream gate, and carries no information. That pattern is worth more
than any one of the three findings.

### 23.2 And the rewrite moves it the wrong way

`rareTermRatio` rises with average word length, and `rewriteQueryAction` expands "UET" to "University of
Engineering and Technology" — long words that `convex/reranking/cascade.ts` separately documents as
carrying no topic signal ("these words reach the reranker on nearly every query no matter the topic").

Measured: the rewrite shifts weight **toward the lexical channel on 6 of 10 queries**. The lexical
channel then matches those same uninformative expansion words site-wide. This is a plausible
contributor to the pool misses of §14.7 — `8fe9e8f2`'s pool is entirely Software Engineering
*department* pages, which is exactly what a lexical match on "Software Engineering" returns.

### 23.3 Not fixed — and this one genuinely cannot be measured here

Unlike §20.3 and §22, the blocker is not just the broken metric. `searchDocumentsAction` exposes no way
to override the fusion weights, so comparing pool composition under different weights needs new Convex
code **and** a deploy, neither of which is available. The finding is recorded with its evidence and the
arithmetic that makes the dead branch provable; the fix is not attempted.

---

## 24. F-16 (High) — CRAG's `confidence` has no defined meaning, and two live gates read it oppositely

### 24.1 The one signal that is NOT inert

Unlike the reranker score (§14), the freshness label (§18) and the fusion weights (§23), CRAG's judge
genuinely discriminates. Measured by calling the **real deployed** `rag/crag:evaluateChunks` on the real
production top-4 of each golden query (`scripts/eval/rerank-position/cragConfidence.ts`, 10 calls):

| | |
|---|---|
| per-chunk verdicts | 40 (25 relevant, 15 rejected) |
| distinct confidence values emitted | **14** — 0.05, 0.1, 0.15, 0.2, 0.4, 0.8, 0.85, 0.9, 0.92, 0.93, 0.95, 0.98, 0.99, 1 |
| range | 0.05 – 1.00 |
| queries where `allIrrelevant` would fire | **0 / 10** |

That is a real distribution, not a constant. Worth stating plainly after three findings in the other
direction: **the CRAG judge works.**

### 24.2 But the scale is undefined, and the model uses it two ways at once

`convex/rag/crag.ts:buildCragPrompt` says only *"determine if it is relevant"* and asks for
`{relevant, confidence}`. Nothing states what `confidence` measures. The model answers accordingly —
within the same run:

```
21ce9642   n@0.90  n@0.85  n@0.80     <- reads as "certain it is irrelevant"
8fe9e8f2   n@0.20  n@0.15  n@0.10     <- reads as "its relevance is low"
```

Under a single consistent reading one of those is incoherent. `8fe9e8f2`'s chunks 2–4 are postgraduate
fee tables and a PhD scholar biography against a **BS fee** query — the model cannot be *unsure* they
are irrelevant, so those low numbers are a relevance score, not a confidence.

**9 of the 15 rejections fall below the 0.7 gate.**

### 24.3 Two consumers, opposite interpretations

| consumer | what it assumes |
|---|---|
| `retrieval.ts:454` `allIrrelevant` | `!relevant && confidence > 0.7` — high means *certainly* irrelevant |
| `retrieval.ts:381` `pickLeastRejectedIndex` | takes the **minimum** confidence as "least confidently rejected" |

Under the relevance-score reading, `pickLeastRejectedIndex` selects the **least relevant** chunk — the
exact opposite of its documented intent, and it is live at `retrieval.ts:407`. On `8fe9e8f2` it would
pick the `n@0.10` chunk out of 0.20/0.15/0.10.

### 24.4 Candidate fix, measured only as far as the quota allowed

Define the scale in the prompt: *"confidence is how certain you are of your own verdict… a chunk you are
sure is irrelevant has HIGH confidence, not low."* The A/B harness is written
(`scripts/eval/crag-confidence-ab/run.ts`) with the prediction stated up front — `8fe9e8f2`'s clearly
irrelevant chunks should move from ~0.15 to high confidence.

**It was not run to completion.** The first attempt hit Groq's 8,000 tokens-per-minute ceiling partway
through: each call carries four full chunks (~2,400 tokens), and that budget is shared with the live
bot, which Groq rate-limited for ~24h on 2026-09-15. Spending more of it on an exploratory measurement
was not worth the risk to live traffic. Calls are now paced 22s apart; the harness is committed unrun.

So F-16's **defect** is measured and its **fix** is not. Do not ship the prompt change on the strength of
the reasoning alone — that is exactly the mistake §14, §17.4, §18.4 and §18.5 record.

---

## 25. F-17 — root cause of the stub chunks: `isQualityChunk` counts markdown syntax as content

§22 measured that 5 of 40 answer-context slots carry under 150 characters of real content, the worst
being `/Admission_Eligibility.php` at **37 characters** — a bare heading — sitting at **rank 1** for
"eligibility criteria". This is why.

### 25.1 The bug

`convex/crawl/chunking.ts:isQualityChunk` is the ingestion gate, applied at `chunking.ts:217`. It
required ≥5 tokens longer than one character. The chunk that reached production tokenizes as:

```
"##### Eligibility Criteria by Program"
  -> ["#####", "Eligibility", "Criteria", "by", "Program"]      5 tokens  -> KEPT
"Eligibility Criteria by Program"                               (identical content, no marker)
  -> ["Eligibility", "Criteria", "by", "Program"]               4 tokens  -> dropped
```

**The markdown heading marker was counted as a word.** `#####` is five characters, so it passed the
`length > 1` test and supplied the fifth "word" that carried a four-word heading past the gate.

`#` alone never did this — one character, already excluded — so the defect admitted **h2–h6 headings**
only, along with table separator rows (`---`) and bold markers (`**`).

Two things were checked and are *not* the cause: the crawler's `Document Title: … URL Path: …` prefix is
added at `chunking.ts:437`, **after** filtering, so the gate does see raw content; and the filter is
genuinely wired in, not dead code.

### 25.2 Fix

A token must now contain at least one alphanumeric character. That excludes `#####`, `---` and `**`
together without regex gymnastics, and every pre-existing assertion still passes — including
`"returns true for markdown tables (dense content)"`, whose `|` cells were already excluded by the
length test and whose `---` separators are now excluded too, leaving six real tokens.

57 tests pass in `tests/convex/crawl/webhook.test.ts`, including four new assertions; `tsc` clean.

### 25.3 Limitation — this does not clean up what is already stored

`isQualityChunk` governs **ingestion**. Chunks already in the corpus stay until their document is
re-crawled, so the stubs §22 measured are still being served. This stops the population growing; it does
not shrink it. Removing the existing ones is a corpus operation and belongs with the F-9 decision.

**Not deployed** — `npx convex deploy` remains refused by the auto-mode classifier. Joins the queue.

---

## 26. F-18 (High) — the contextualized-text retrieval channel is empty, and cannot fill at its configured rate

### 26.1 Measured

Probing the **real** `contextualizedText` field of every chunk retrieved across the §14 capture
(`scripts/eval/rerank-position/contextCoverage.ts`, Convex queries only — no LLM calls):

| | |
|---|---|
| retrieved chunks probed | 79 |
| resolved in `crawledChunks` | 70 (the other 9 are FAQ-channel or F-9 rows) |
| **`contextualizedText` present** | **0 / 70 (0%)** |

Two things follow directly:

* `search_contextualized_text` is one of production's retrieval channels
  (`embeddings/chunkTextSearch:runContextualized`, wired at `search.ts:490`). A document only matches
  that index once `contextualizedText` is set, so **the channel returns nothing, for every query**.
* The Anthropic Contextual Retrieval pattern is implemented — `search.ts:213` "Prepend contextualized
  summary to the detailed text" — and **never fires**, so no chunk carries the surrounding context that
  technique exists to supply.

### 26.2 Why

`convex/embeddings/contextualizeCron.ts` says so in its own header:

> "Track B restores the Gemini contextualization path that **has been failing since 2026-06-01**."

The cron is not disabled: `AUTO_BACKFILL_AFTER_MODEL_RECOVERY` is opt-**out** (anything but the literal
`"false"` allows it) and is **not set** on the production deployment, so the gate passes. What limits it
is the rate — `DEFAULT_DAILY_LIMIT = 10`, described in `crons.ts` as "up to 10 chunks/day (reduced from
50 to save bandwidth & respect 250 RPD free tier)".

**At 10 chunks/day, every 1,000 chunks takes 100 days.** Against a corpus of 1,891 documents — which is
several thousand chunks — this channel cannot become useful on any horizon that matters, even with the
Gemini path fully restored.

### 26.3 What this cannot distinguish

0/70 is consistent with *"still failing"* and with *"running, but has covered a fraction too small to
appear in a 70-chunk sample"*. Separating them needs a corpus-wide count of chunks with
`contextualizedText` set — a full-table scan, which the Convex Free-plan I/O budget does not justify
spending on a diagnostic here. Either way the operational conclusion is the same: **the channel is empty
now and the configured rate cannot fill it.**

### 26.4 Not actioned

Raising the daily limit is a bandwidth and free-tier-quota decision with an explicit paper trail
(`crons.ts` records the 50 → 10 reduction as deliberate), and re-running the path at volume is exactly
the class of operation this session is not authorized to start. Recorded for the owner.

The cheap first step is not a code change: confirm whether the Gemini contextualization path still fails
before touching the rate, since raising the limit on a broken path changes nothing.

---

## 27. Audited and found sound — what was checked and had no defect

Recorded so these are not re-audited. Every component on the accuracy path has now been read, not just
measured around.

| component | checked | verdict |
|---|---|---|
| `rag/routing.ts` `condenseQuestionAction` | follow-up resolution for multi-turn | **sound.** Fences the transcript, forbids following instructions inside it, temperature 0, returns the message unchanged when already standalone, keeps the user's language |
| `rag/retrieval.ts` `resolveStandaloneQuestion` | how history reaches the condenser | **sound.** Caps at 6 messages × 1,000 chars, skips when no user turn is present, re-validates the model's output against the same `MAX_QUERY_LEN` and `INJECTION_RE` as the original question, falls back to the original on any failure |
| `rag/context.ts` `buildContext` | context assembly and budget | **sound.** Greedy pack in rank order with `continue` (not `break`), so a later smaller chunk still fits; sandwich ordering for lost-in-the-middle; measured at 43% of budget worst case (§18) |
| `embeddings/hybridRank.ts` | channel fusion | **sound.** Textbook RRF, `1/(k+rank)`, k=60. The defect is in the *weights* it is handed (§23), not in the fusion |
| HyDE wiring | whether the channel is live | **live and measured.** `search.ts` embeds both the HyDE paragraph and the raw question as separate dense channels, with its own recorded recall — 70% question-only vs 83% with both |
| `chat/csrf.ts` + `middleware.ts` | request gating | **sound**, and strict enough that unauthenticated verification of the API is impossible (§ status index) |
| `chat/cache.ts` `encodeSourcesHeader` | citation transport | **sound.** Caps sources, truncates excerpts, drops excerpts, then empties — a graceful ladder. Production sends 4 sources ≈ 2.9 KB against a 6,000-byte limit, so no rung past the first is reached |

| `embeddings/generate.ts` + `cloudflareEmbed.ts` | the embedding foundation of dense retrieval | **sound.** Two spaces, correctly separated and enforced |
| `shared/invariants.ts` | dimension/finiteness assertions | **sound.** Both call sites pass the dimension explicitly; the 768 default is never relied on |

**On the embedding architecture specifically**, since a mismatch there would silently degrade every
query and is the classic failure in this design:

* Gemini `gemini-embedding-2` at **768d** serves the semantic cache and the Convex vector path.
* Cloudflare `@cf/qwen/qwen3-embedding-0.6b` at **1024d** serves the Pinecone path — and its header
  records that this is "the SAME model, endpoint, and request shape used to build the index".
* The 768d vector is **never** used against Pinecone. `search.ts:380` guards it in as many words:
  *"Deliberately NOT args.queryEmbedding here"*.
* `assertEmbeddingDimension` is invoked on both paths with its dimension passed explicitly
  (`DENSE_DIM` 1024, `EMBEDDING_DIMENSION` 768), so its 768 default cannot mask a mismatch.
* The usual query-vs-document `taskType` error does not apply: the code records that "taskType
  parameter has no effect on gemini-embedding-2 (confirmed bug)".

Two things were *suspected* and disproved by reading rather than assuming, both recorded because the
suspicion was reasonable:

* **The crawler prefix does not defeat `isQualityChunk`.** It is added at `chunking.ts:437`, after the
  filter at `:217`. The real cause was markdown syntax counted as words (§25).
* **`estimateIdf` does not receive the HyDE paragraph.** It reads `args.queryText` at `search.ts:339`,
  before `finalQueryText` is reassigned at `:344`, so §23's arithmetic — computed against the 12-word
  rewrite — holds.
