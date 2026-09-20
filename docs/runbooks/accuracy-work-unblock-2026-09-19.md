# Unblocking the queued accuracy work (2026-09-19)

Eight accuracy fixes were live before 2026-09-19, and the queued Convex commits were deployed that
day (§2). The cache secret is now set in both places (§1) and F-9 was withdrawn after measurement (§3). What
remains is the FAQ ground-truth decision; W4 is done in a narrower form (§6). This is the
order to do them in and what each one costs.

Full evidence for everything below: `audit/chatbot-accuracy-audit-2026-09-18.md` (status index at the
top; F-9 §15, F-10 §16, F-11 §18, F-12 §20, F-13 §21).

---

## 1. Turn the semantic cache on — ~2 minutes, biggest single win

`INTERNAL_API_SECRET` is absent from **both** Vercel and Convex, so the cache has never written an
entry and every question runs the full pipeline. That is maximum LLM call volume, and the most
plausible contributor to the ~24h Groq rate-limit on 2026-09-15 (audit §16).

**Status 2026-09-20: done.** `INTERNAL_API_SECRET` is set in Convex and in Vercel production (one value,
generated once) and the Vercel build was redeployed so it takes effect. **Not yet observed working:** the
write is fire-and-forget and no traffic has arrived since, so the verification below is still open.

Generate one value and set it in **both** places — `setFromServer` constant-time-compares the caller's
secret against Convex's own copy, so one side alone still fails, silently, because the write is
fire-and-forget:

```bash
npx convex env set INTERNAL_API_SECRET '<value>' --env-file .env.vercel-production.local
# then the SAME value in Vercel → Settings → Environment Variables → Production, and redeploy
```

**Verify:** no new `semantic_cache_write_skipped` rows in `traceSpans`, and `semanticCache` stops being
empty.

**Expect:** `[CACHE] Ignoring stored refusal` lines may now appear. That is the W1 guard working for the
first time — it has been protecting a path that never executed.

## 2. Deploy the four queued Convex commits - DONE 2026-09-19

Deployed with the command below, together with the Vercel build of the same commit (`e3269c6`).
Verified against production, not just the CLI's success message: `npx convex function-spec` lists
`crawl/lexicalProofAudit:scopeLexicalProofRows`. The working tree held no uncommitted `convex/` edits
when this ran - checked afterwards by confirming that two mutations added by unrelated uncommitted work
(`deleteUserAccountData`, `exportUserData`) are absent from production. Note that `npx convex deploy`
ships the working directory's `convex/`, not the commit, so run it from a clean tree.

```bash
npx convex deploy -y --env-file .env.vercel-production.local
```

| commit | what it fixes |
|---|---|
| `d3c1726` | **Roman Urdu questions can reach a verified FAQ.** User-facing; the most valuable of the four (§20) |
| `ee55d3c` | a duplicate `ragId` can no longer crash a chunk lookup (§15.3) |
| `b4976c6` | the eval harness gates FAQs the way production does (§19) |
| `3c2b722` | a bounded, read-only scoping query for the F-9 rows (§15.4) |

## 3. F-9 - scoped, and WITHDRAWN as framed

Done 2026-09-20 with the bounded scoping query (30 documents, 40-chunk cap). The premise was wrong:
`lexical-proof:` rows are not stray proof-of-concept data, they are the production corpus. 30 of 30 sampled
documents hold only those rows, and 74 of the 79 candidates in the §14 capture carry that id scheme.

**Do not add a read-side guard excluding `lexical-proof:` ragIds** - it would hide nearly all retrieval.
Evidence, and the narrow defect that survives (duplicate ragIds, citation-only impact): audit §15.5.

## 4. Re-capture the retrieval baseline (after step 2)

`b4976c6` fixes a harness fidelity gap: it never forwarded `questionText`, so captures gated FAQs
against the rewrite rather than the raw question, making it weaker than production at retrieving FAQs.

```bash
npx tsx scripts/eval/rerank-position/run.ts        # re-capture
npx tsx scripts/eval/rerank-position/run.ts --replay   # free re-analysis thereafter
```

This replaces several caveated numbers in §14/§15 with real ones — in particular whether `8fe9e8f2` and
`21ce9642` are genuine retrieval misses or were harness artefacts.

## 5. The FAQ ground-truth decision — gates all future retrieval work

The golden set's `relevantChunkKeys` are `crawledChunks` chunk keys, and FAQ-channel answers carry
`faqs` ids, so **a correct FAQ answer can never match a label** (§17). 10% of context slots are
invisible to scoring, and the metric penalises retrieval exactly when it returns the best source.

A page-level scoring axis was tried and **does not** recover it — the FAQ lives on a different page from
the label (§17.3). This needs a human decision per affected query that a given FAQ also answers it,
recorded with its own provenance tier. Until then, **a recall delta cannot justify a retrieval change.**

## 6. W4 - done in a narrower form (2026-09-20)

Not a 1,891-row backfill: an unset `lifecycleStatus` already counts as eligible, so only superseded rows
need a value. Eleven documents that a newer one *replaces* (Prospectus 2024, two CPD calendars, a CPED
timetable, five 2013 semester pages, two old hostel policies) are now `superseded`; verified by read-back
and by a retrieval positive control. Undo one with `node scripts/set_document_lifecycle.cjs --document-id
<id> --expect-url-suffix <suffix> --status active`. Detail and the table: audit §28.

**Your call, not mine:** (a) the boys-only 2024-25 hostel policy vs the general 2023-24 one - superseding the
older could remove the only girls' rules, so both stay active; (b) 23 annual-report / per-session /
batch-specific documents that are records rather than replacements, left as editions under the runtime filter.
---

## Optional: close the verification gap

Every live fix is deployed and unit-tested but **never observed handling a real request** — production
served no real traffic during the session. Unauthenticated probing is structurally impossible (Clerk
middleware intercepts `/(api|trpc)(.*)` before the route handler), so the only check that exercises the
true path is:

```bash
PLAYWRIGHT_TEST_BASE_URL=https://uet-gpt.vercel.app npx playwright test tests/e2e/chat-flow.spec.ts
```

Not run during the session because `tests/e2e/global.setup.ts` signs in as a real person's account, so
against production it writes real threads under that identity and spends Groq quota. Worth adding while
you are there: ask the fee question, assert the reply is not the refusal string.

`playwright.config.ts`'s `webServer` block still points at `localhost:3001`; skip it or run the local
server alongside.

---

## Do not rebuild these — measured and rejected, with evidence

The F-4 reranker formula (§14) · nav-chunk demotion (§17.4) · page-level label scoring (§17.3) ·
a `Source year` context header (§18.4) · edition-aware freshness (§18.5) · the Dice FAQ normalisation
(§20.3, promising but evidence too thin) · and an unauthenticated verification probe (§ status index).

Each was built or probed and did nothing, or would have caused harm. The evidence is in the audit so
none is retried on the strength of sounding right.
