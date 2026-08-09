# Gate 1 Baseline — Known Failures on e7136c0

**Captured:** 2026-07-28 on detached HEAD `e7136c0cab4c3e6f44dd3f530648e624e8755216`
**Result:** 30 failed | 397 passed (427 total), 15 failed test files, 29 passed test files (44 total)
**Source:** `pnpm vitest run --reporter=json` → `.zcode/baseline/e7136c0.json`

Gate 1 PASS criterion for the staleness-MVP branch: the post-change failing set must be **identical to or a strict subset of** the list below, AND all new staleness tests must pass. A new failure not in this list = Gate 1 FAIL.

## Known failures (exact file :: test-name)

1. tests/integration/chat-api.test.ts :: Chat API Integration model selection returns models in priority order when API keys are set
2. tests/integration/webhook-integration.test.ts :: Crawl Webhook Integration & Load Testing processes large legitimate payloads and queues chunks idempotently
3. tests/unit/admin-crawls.test.tsx :: AdminCrawlsPage renders Refresh button
4. tests/unit/admin-documents.test.tsx :: AdminDocumentsPage shows 'No documents match your filters' when filters are active
5. tests/unit/admin-documents.test.tsx :: AdminDocumentsPage filters documents by search query
6. tests/unit/admin-layout.test.tsx :: AdminLayout displays the current page name in the header
7. tests/unit/admin-layout.test.tsx :: AdminLayout defaults header to 'Admin' when pathname does not match a nav item
8. tests/unit/admin-settings.test.tsx :: AdminSettingsPage Save and Reset persists settings via the Convex mutation when Save Changes is clicked
9. tests/unit/convex-ready-gate.test.tsx :: ConvexReadyGate renders children on happy path (clerk loaded, convex loaded)
10. tests/unit/convex-ready-gate.test.tsx :: ConvexReadyGate renders connecting state when loading
11. tests/unit/convex-ready-gate.test.tsx :: ConvexReadyGate renders retry UI after timeout (10s)
12. tests/unit/document-validator.test.ts :: documentValidator field count has exactly 19 fields
13. tests/unit/document-validator.test.ts :: documentValidator field count contains all expected field names in order
14. tests/unit/document-validator.test.ts :: documentValidator JSON schema introspection has all 19 fields in the serialized value
15. tests/unit/document-validator.test.ts :: documentValidator validator methods omit() with no fields returns identical validator
16. tests/unit/document-validator.test.ts :: documentValidator validator methods partial() marks all fields as optional
17. tests/unit/document-validator.test.ts :: documentValidator validator methods extend() adds new fields to the validator
18. tests/unit/document-validator.test.ts :: documentValidator validator methods extend() does not mutate the original validator
19. tests/unit/feedback-submit.test.ts :: feedback:submit should not insert empty string for comment if comment is undefined
20. tests/unit/llm-models.test.ts :: LLM Fallback Chain exports a static array with all 4 models in priority order
21. tests/unit/llm-models.test.ts :: LLM Fallback Chain getModelPriorities includes models whose env vars are set
22. tests/unit/messages-api.test.ts :: messages api - authorization & ownership list rejects when the caller does not own the thread
23. tests/unit/messages-api.test.ts :: messages api - authorization & ownership list rejects unauthenticated callers
24. tests/unit/next-config.test.ts :: next config defines redirects and headers
25. tests/unit/rate-limit.test.ts :: rate-limit denies when UPSTASH_REDIS_REST_URL is missing
26. tests/unit/rate-limit.test.ts :: rate-limit denies when UPSTASH_REDIS_REST_TOKEN is missing
27. tests/unit/rate-limit.test.ts :: rate-limit denies for unconfigured rate limiter (fail-closed)
28. tests/unit/retry.test.ts :: retryWithBackoff retries on failure up to maxRetries, then throws
29. tests/unit/retry.test.ts :: retryWithBackoff resolves if a retry succeeds
30. tests/unit/sidebar-history.test.tsx :: SidebarHistory should highlight the active chat based on the clean pathname, without route groups

## Notes for the staleness-MVP branch

- **#12-18 (document-validator):** these assert `convex/doc/validator` has "exactly 19 fields." The staleness-MVP touches `convex/embeddings/doc_queries.ts` (the *query handlers* that read fields), NOT `convex/doc/validator` (the *schema-derived validator*) and NOT `convex/schema.ts`. So these should remain failing identically — neither fixed nor newly broken.
- **#1, #20, #21 (llm-models, chat-api):** env-var-dependent (require API keys set). Will remain failing in CI without env. Not touched by staleness-MVP.
- **#25-27 (rate-limit):** require Upstash env. Not touched.
- **#2 (webhook-integration):** large-payload idempotency. The staleness-MVP touches `convex/crawl/mutations.ts` upsert sites (adding `isStale: false`). MUST verify this test is not newly affected — it's the closest existing test to the stale-clear hook.
- The remaining failures (#3-11, #19, #22-24, #28-30) are UI/Next-config/retry logic unrelated to Convex retrieval/staleness.
