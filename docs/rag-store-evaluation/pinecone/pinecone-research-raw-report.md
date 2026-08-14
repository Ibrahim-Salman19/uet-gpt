# Pinecone Starter Plan — Research Report (retrieved August 2026)

Raw output of background Agent "Research current Pinecone Starter facts" (id a039a4ef1bdfa1da1),
persisted verbatim immediately on receipt for durability. To be shaped into
docs/rag-store-evaluation/pinecone/research-findings.json as part of task #34.

---

**NO DISQUALIFYING IDLE-LIFECYCLE BEHAVIOR FOUND** — based on: (a) the official cost-behavior doc stating serverless "Idle indexes cost nothing" (https://docs.pinecone.io/guides/manage-cost/understanding-cost), (b) the official data-deletion doc, whose only automatic-deletion triggers are non-payment account deactivation and account/service termination — not mere inactivity (https://docs.pinecone.io/guides/production/data-deletion), and (c) the absence of any inactivity/pause/suspend/archive clause across every current Starter-plan limits and pricing page checked. Full reasoning and the historical policy Pinecone explicitly *removed* in 2023 are below — read it, because the picture has real nuance and I could not find a page that affirmatively guarantees "never expires," only an absence of any current policy that would expire it.

---

## 1. Starter plan — current limits

All figures below are cross-confirmed from at least two of: `docs.pinecone.io/reference/quotas-and-limits`, `docs.pinecone.io/reference/api/database-limits`, and `pinecone.io/pricing` (fetched directly today).

| Item | Value | Source |
|---|---|---|
| Cost | "$0/month" — free | pinecone.io/pricing |
| Serverless storage | "Up to 2 GB" | pinecone.io/pricing; docs.pinecone.io/reference/quotas-and-limits |
| Read units (RU) | "1,000,000" / mo ("Up to 1M/mo") | same two |
| Write units (WU) | "2,000,000" / mo ("Up to 2M/mo") | same two |
| Egress | **"Up to 1GB/mo"**. Exceeding it: "in-scope reads are blocked with a `RESOURCE_EXHAUSTED` (429) error and an upgrade prompt" | pinecone.io/pricing; docs.pinecone.io/guides/manage-cost/understanding-cost |
| Max serverless indexes | "5" per project | docs.pinecone.io/reference/quotas-and-limits |
| Namespaces per index | "100" (Builder tier gets 1,000; Standard/Enterprise get 100,000) | docs.pinecone.io/reference/api/database-limits |
| Supported region(s) | "all serverless indexes must be in the `us-east-1` region of AWS" — Starter is single-region only (general serverless availability is us-east-1/us-west-2/eu-west-1, but Starter is restricted to us-east-1) | docs.pinecone.io/reference/quotas-and-limits |
| Filterable metadata per record | "40 KB" (excludes full-text-search fields) | docs.pinecone.io/reference/api/database-limits (fixed across all plans) |
| Record ID max length | "512 characters" | same |
| Dense vector dimensionality | up to "20,000" | same |
| Sparse vector | up to "2,048 non-zero values"; dimensionality up to "4.2 billion" | same |
| Individual document max size | "2 MB" | same |
| Upsert batch | "2 MB or 1000 records with vectors" / "96 records with text" (integrated-embedding path); max "1000" documents per request | same |
| Delete | max "1,000" record IDs per request; throughput "5,000" deletes/sec (namespace- or index-scoped) | same |
| Query | max `top_k` = "10,000"; max result size "4MB"; max values per `$in`/`$nin` filter = "10,000" | same |
| Current API version | **`2026-04`** — the versioning doc's own curl example labels it "the latest stable version" | docs.pinecone.io/reference/api/versioning (retrieved today) |
| Node SDK package/version | `@pinecone-database/pinecone`, latest published **`8.2.0`** (npm registry, confirmed live via `npm view`). Official SDK↔API mapping table: Node SDK v8.x ↔ API `2026-04`, v7.x↔`2025-10`, v6.x↔`2025-04`, v5.x↔`2025-01`, v4.x↔`2024-10`, v3.x↔`2024-07`, v2.x↔`2024-04` | docs.pinecone.io/reference/pinecone-sdks; npm registry |
| Credit card to sign up | **Not confirmed from a primary source.** Official quickstart says only: "sign up at app.pinecone.io and choose a plan" with "Free access to most features" — no payment-method language either way. Multiple secondary/review sites assert no card is required, but I found no official page stating this explicitly, and a Pinecone Community thread ("AWS Marketplace Asking for Credit Card") suggests the *AWS Marketplace* signup path may differ from direct app.pinecone.io signup — I did not resolve that discrepancy. Report this item as unconfirmed rather than verified. | docs.pinecone.io/guides/get-started/quickstart; community.pinecone.io/t/aws-marketplace-asking-for-credit-card/1162 |

Note: there is now also a paid "Builder" tier ($20/mo, 10GB storage/5M WU/2M RU/10GB egress/1000 namespaces) sitting between Starter and Standard — mentioned only for context since it appeared repeatedly in the pricing table; not asked for.

---

## 2. THE hard-gate question — idle/inactivity lifecycle

**What I found on current (2026) official pages:** nothing. I fetched every plausible current lifecycle-relevant doc — `reference/quotas-and-limits`, `reference/api/database-limits`, `reference/quotas-and-rate-limits`, `guides/manage-cost/understanding-cost`, `guides/manage-data/manage-indexes`, `guides/organizations/manage-billing/manage-your-billing-plan`, `guides/production/data-deletion`, and `pinecone.io/pricing` — and **none contains any clause about pausing, suspending, archiving, or deleting an index due to inactivity.**

Two positive, current, official statements are directly relevant:

- `docs.pinecone.io/guides/manage-cost/understanding-cost`: **"Idle indexes cost nothing."** (serverless usage-based billing — you pay for storage + operations + egress, not for an index merely existing/sitting idle).
- `docs.pinecone.io/guides/production/data-deletion`: describes exactly three triggers for automatic data deletion, and inactivity is not one of them:
  1. User-initiated deletion (via API/console) → soft-deleted, "marked for deletion" but inaccessible, retained up to "90 days" before permanent removal.
  2. Non-payment: "If your account is deactivated for continued non-payment, account data is retained for 30 days before permanent deletion."
  3. Full account/service closure: data is deleted "when you end your relationship with Pinecone."

**Historical context (important — this is likely the source of confusion with old blog posts/forum threads):** Pinecone's old **pod-based** free tier *did* have an inactivity policy:
- April 26, 2023 official blog ("Opening up our free plan," pinecone.io/blog/updated-free-plan): "inactive indexes on the free plan will be archived after 7 days of inactivity" (ephemeral/Auto-GPT-style indexes: 1 day). Archived indexes became collections, "recreate indexes from a collection within a few minutes."
- July 12, 2023 official blog ("Start now, then take your time: Removing the Pinecone waitlist and inactivity policy," pinecone.io/blog/gcp-starter): Pinecone **removed** this — "No more auto-archiving of inactive indexes," allowing "new users to keep their free indexes indefinitely."
- I found no evidence this policy was ever reinstated. The old free tier itself (`gcp-starter`, pod-based) is now legacy — there is a dedicated migration doc, "Convert a gcp-starter index to serverless" (docs.pinecone.io/guides/indexes/convert-a-gcp-starter-index-to-serverless), confirming today's Starter plan is serverless-only, an architecture where (per the cost doc above) idle compute isn't billed/reclaimed the way pod-based always-on compute was — which is also the architectural reason the old policy existed in the first place and plausibly why it doesn't carry over.

**On the "3 weeks" and "7 days" figures you may see elsewhere:** Several SEO/review sites (layer3labs.io, costbench.com, ranksquire.com, pecollective.com) and this session's own search-engine result synthesis repeatedly asserted "Indexes on the Starter plan are paused after 3 weeks of inactivity" as if factual. **I could not trace this to any primary source.** I directly fetched the specific review pages the search engine cited as the origin (layer3labs.io/guides/is-pinecone-worth-it, costbench.com/software/vector-databases/pinecone) and **neither page actually contains that claim** when read directly — it appears to be an artifact of the search tool's own synthesis, not a real citation. Separately, a 2022 Pinecone Community thread has a staff reply ("Roei," May 12, 2022) saying indexes were "deleted after 7 days of inactivity" — but that predates serverless entirely (pod-based only) and predates even the 2023 policy history above, so it's obsolete. Flagging both explicitly since you asked me not to let stale/low-quality sources pass as current fact.

**"OnDemand" / scale-to-zero / cold start:** "OnDemand" in current Pinecone docs is a **read-capacity billing mode** for serverless indexes — the default, pay-per-read-unit mode — contrasted with "Dedicated" (Dedicated Read Nodes, a paid always-warm option). It is not a cluster-suspend/resume mechanism. There is no "index goes to sleep, then a control-plane resume operation takes N minutes" pattern documented anywhere I found — that Zilliz-style behavior does not appear to exist on Pinecone Starter. What *does* exist, per Pinecone's own marketing language, is a **per-namespace** warm/cold cache effect: "warm namespaces (those that receive queries regularly and are cached locally)" get lower latency, while "cold-start queries" to an infrequently-accessed namespace "will have higher latency" — this is namespace-level query-path caching, not whole-index suspension, and I found **no documented numeric cold-start duration** (no "X seconds" or "X minutes" figure published) for this. Pinecone's Dedicated Read Nodes product page frames itself as eliminating "cold start latency regressions" that OnDemand can exhibit for cold namespaces — which is the closest official acknowledgment that OnDemand has *some* latency variability, but it is a per-query-path effect, not an outage/resume event, and nothing suggests multi-minute magnitude.

---

## 3. API maturity

| API / feature | Version | Status | Notes |
|---|---|---|---|
| **Dense vector API** (index create/upsert/query) | `2026-04` (current stable channel; quarterly cadence, each stable version supported "for a minimum of 12 months," first stable was `2024-04` per the July 18, 2024 versioning announcement blog) | **GA/Stable by strong inference** — no preview/alpha badge found anywhere on `guides/index-data/create-an-index` or core data-plane docs; it's the default, flagship, years-old capability. I did not find a page containing the literal sentence "the dense vector API is GA" — the conclusion rests on total absence of any preview/alpha marker plus its presence in the standard quarterly-stable versioning channel. | docs.pinecone.io/reference/api/versioning; docs.pinecone.io/guides/index-data/create-an-index |
| **Sparse vector API** (sparse/sparse-dense indexes) | n/a (covered by main API version) | **Ambiguous — reported honestly rather than asserted.** Original launch ("Don't be dense: Launching sparse indexes in Pinecone," pinecone.io/learn/sparse-retrieval, dated Aug 15, 2025) explicitly called it "public preview." The *current* (today's) `create-an-index` guide shows **no** preview badge on the sparse option — only the document-schema option carries an explicit preview tag on that same page. I found no explicit GA-graduation announcement either way, so I cannot confirm whether it has graduated. | pinecone.io/learn/sparse-retrieval; docs.pinecone.io/guides/index-data/create-an-index |
| **`pinecone-sparse-english-v0`** (hosted sparse embedding model) | n/a | **No explicit status badge found** on its dedicated model page (docs.pinecone.io/models/pinecone-sparse-english-v0) or in the models gallery — listed alongside dense models (llama-text-embed-v2, multilingual-e5-large) in the standard pricing table with no preview caveat, unlike full-text search which is explicitly tagged. **Starter-plan availability: YES — "5M tokens/mo incl."** (confirmed independently via direct pricing-page fetch and web search cross-check). Max sequence length: "512" tokens default, configurable up to "2048" via `max_tokens_per_sequence`. Overage price: "$0.08 / 1M Tokens." Batch-size limit (records per inference request): **not found/not documented** in any page I could access. | pinecone.io/pricing; docs.pinecone.io/models/pinecone-sparse-english-v0 |
| **Document-schema / integrated full-text BM25 API** | **`2026-01.alpha`** — unchanged from your last check | **Public Preview** — confirmed verbatim: *"Full-text search is in [public preview]. APIs may continue to evolve before general availability."* Also: *"Indexes with document schemas are in public preview and use API version `2026-01.alpha`."* **Has not reached GA.** Requires explicit header `X-Pinecone-Api-Version: 2026-01.alpha`. | docs.pinecone.io/guides/search/full-text-search |
| **Node.js SDK coverage** | `@pinecone-database/pinecone` v8.2.0 (npm, live) covers dense + sparse vector operations (API `2026-04`). | For document-schema/BM25 specifically: **no Node/TypeScript SDK support exists yet.** Quoted directly: *"Full-text search is available in the standard `pinecone` Python SDK under the `pc.preview.*` namespace"* (`pip install --upgrade pinecone`); Node/TS users are directed to raw REST calls with the alpha header instead. | docs.pinecone.io/guides/search/full-text-search |

---

### Sources referenced (official, fetched directly today unless noted as historical)
- https://docs.pinecone.io/reference/quotas-and-limits
- https://docs.pinecone.io/reference/api/database-limits
- https://docs.pinecone.io/reference/quotas-and-rate-limits
- https://www.pinecone.io/pricing/
- https://docs.pinecone.io/guides/manage-cost/understanding-cost
- https://docs.pinecone.io/guides/production/data-deletion
- https://docs.pinecone.io/guides/manage-data/manage-indexes
- https://docs.pinecone.io/guides/organizations/manage-billing/manage-your-billing-plan
- https://docs.pinecone.io/reference/api/versioning
- https://docs.pinecone.io/reference/pinecone-sdks
- https://docs.pinecone.io/guides/get-started/quickstart
- https://docs.pinecone.io/guides/index-data/create-an-index
- https://docs.pinecone.io/guides/search/full-text-search
- https://docs.pinecone.io/guides/data/upsert-sparse-dense-vectors
- https://docs.pinecone.io/models/pinecone-sparse-english-v0 and https://docs.pinecone.io/models (gallery)
- https://www.pinecone.io/blog/gcp-starter/ (Jul 12 2023, historical)
- https://www.pinecone.io/blog/updated-free-plan/ (Apr 26 2023, historical)
- https://www.pinecone.io/blog/introducing-pinecone-api-versioning/ (Jul 18 2024)
- https://www.pinecone.io/learn/sparse-retrieval/ (Aug 15 2025)
- npm registry: `@pinecone-database/pinecone`
- Community threads (labeled as such, non-authoritative, used only for historical corroboration/dating): community.pinecone.io/t/do-indices-expire-with-starter-plan/373 (2022); community.pinecone.io/t/did-anyone-else-just-have-their-index-deleted-due-to-inactivity/704 (Mar 2023); community.pinecone.io/t/will-my-data-be-deleted-on-free-plan/2329 (Jun 2023); community.pinecone.io/t/my-pinecone-index-is-removed-how-can-i-find-them-and-project-is-deleted/6977 (Nov 2024, resolved as UI cache bug, not deletion)
