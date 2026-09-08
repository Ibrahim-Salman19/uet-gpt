# Admin manual content upload — design notes (not yet built)

**Status: documented for later, not implemented.** Recorded 2026-09-04 at
the user's request, after this session's evaluation work repeatedly
surfaced real, unresolved data-quality gaps in the live corpus (e.g. the
fee-structure figure that doesn't match any Prospectus edition — see
`docs/rag-store-evaluation/hybrid-retrieval-2026-08/report.md` §9). The
user's stated need: whenever they (or another admin) obtain a corrected
piece of information — a photo of an official notice, a corrected fee
table, pasted text — there should be an easy, non-technical way to get it
into the live corpus from the admin panel, instead of the current
CLI-only path.

## The problem today

Getting new content into the corpus currently requires running a script
from a terminal:

- `scripts/crawler.py` — scheduled/bulk web crawling.
- `scripts/ingest_pdf.py` — one-off PDF ingestion (`python ingest_pdf.py
  <URL-or-path> "Title"`), with OCR and a Gemini Vision fallback for
  scanned pages.

Both are effective but require shell access and Python environment setup
— not something a non-technical admin can do when they get a corrected
fee table on their phone. The existing admin panel
(`src/app/admin/(admin-shell)/documents/page.tsx`) only **lists, filters,
and deletes** already-ingested documents (via `api.doc.list.list` and
`api.admin.stats.deleteDocument`) — it has no upload/add-content
capability at all today.

## Reuse the existing ingestion pipeline — don't build a new one

The good news: there's already a single, well-tested integration point
that both the crawler and `ingest_pdf.py` push into, so a browser-based
upload feature does not need its own chunking/embedding logic. It needs
to produce **plain markdown/text** and hand it to the same endpoint.

- `scripts/ingest_pdf.py`'s `push_to_convex()` (line ~1756) POSTs to
  `{CONVEX_SITE_URL}/ingest` with a JSON body:
  `{ url, markdown, contentHash, crawlSessionId, title, sourceType,
  freshnessTier }`, an `Idempotency-Key` header set to the content hash,
  and a Bearer `Authorization` header.
- That route is registered in `convex/http.ts` (`path: "/ingest"`,
  `handler: ingestWebhook`) and implemented in
  `convex/crawl/webhook.ts` (`ingestWebhook`, line ~566), which validates
  the required fields (`url, markdown, contentHash, crawlSessionId,
  sourceType` — `title`/`freshnessTier` optional) and checks the
  `Authorization` header before chunking/embedding the document into the
  `documents`/chunks tables (`convex/schema.ts` line ~171).

So: any upload path (text, image, PDF) just needs to end up as markdown
text handed to this same `/ingest` endpoint with a distinct `sourceType`
(e.g. `"manual_text"`, `"manual_image_ocr"`, `"manual_pdf"`) so ingested-
via-admin-upload documents stay distinguishable from crawled ones in the
`documents` table and in any future audit.

## Proposed UI

Add an "Add content" panel to the existing admin Documents page
(`src/app/admin/(admin-shell)/documents/page.tsx`), reusing whatever
admin-only auth already gates the `/admin` shell (`src/app/admin/layout.tsx`).
Three input modes, one panel:

1. **Paste text** — a textarea plus a title and category field (reusing
   the same category enum already used for filtering:
   admissions/academics/departments/programs/campus/general). Fastest
   path for something like a corrected fee table typed or copy-pasted in.
2. **Upload an image** (photo of a notice, a printed table, a screenshot)
   — needs OCR before it's usable text. `ingest_pdf.py` already has a
   Gemini Vision fallback for exactly this case (its VLM path for
   low-confidence PDF pages); that OCR call is the piece to reuse rather
   than re-implement.
3. **Upload a PDF** — reuse `ingest_pdf.py`'s existing extraction pipeline
   (PyMuPDF4LLM + hybrid OCR + Gemini Vision fallback + markdown cleaning
   + quality gate) rather than duplicating it. That logic currently lives
   in a CLI script; making it usable from the web means either (a)
   refactoring its core extraction function into something an admin-only
   Convex action can call directly, or (b) running it as a small
   background service the Convex action invokes. Needs a decision at
   build time, not now.

All three modes end at the same place: markdown text + title + category
+ `sourceType`, pushed through the same `/ingest` flow.

## Concrete pieces that would need building

- **File upload from the browser**: Convex file storage
  (`generateUploadUrl` + `storage.store`) for the image/PDF bytes, since
  there's currently no file-upload path in the admin UI at all.
- **A `manual://` virtual-URL scheme** (or similar) for text/image
  uploads that don't have a real source URL — `documents.url` has a
  `by_url` index and the ingest webhook treats `url` as a required,
  presumably-identifying field, so manual uploads need a stable synthetic
  identifier instead of a scraped URL.
- **An admin-triggered Convex action** wrapping the OCR/extraction step
  and then calling the same ingest path as `push_to_convex()`, gated to
  admin users only (do not expose an unauthenticated version of this).
- **Rate/cost limiting on the OCR calls**: Gemini Vision calls cost API
  quota — this project runs on free-tier keys with round-robin rotation
  (3 keys currently) and a standing "no paid APIs, no heavy compute"
  constraint. An admin-facing upload button should not be able to trigger
  unbounded Vision calls; needs an explicit per-upload or per-day cap,
  consistent with `docs/runbooks/resource-safety-incident-response.md`'s
  existing kill-switch/rate-limit patterns for the crawler.

## Open questions to resolve when this is actually built

These are flagged, not decided — each is a real product/design choice
for whoever picks this up:

1. **Auto-publish vs. review-first.** Should an admin's upload go
   straight to `status: "indexed"` (immediately used in RAG answers), or
   land in a pending/review state first? Given this session's own
   findings (a live fee-figure discrepancy across the corpus, the live
   site, and every Prospectus edition — none of which agree), a
   lightweight review step before a manual upload can override or
   supplement existing corpus facts seems safer than instant publish, but
   that's a product call, not a technical one.
2. **Superseding old/conflicting content.** If an admin uploads a
   corrected fee structure, should it just be *added* alongside the old,
   possibly-wrong chunks (both now retrievable, possibly contradicting
   each other in an answer), or should it explicitly mark the old ones
   `stale` (the `documents` schema already has an `isStale`/`status:
   "stale"` concept — see `convex/schema.ts` line ~190, ~262)? This
   connects directly to the already-recorded, separately-deferred
   backlog item about keeping only the latest edition of yearly-reissued
   documents like the Prospectus (see
   `docs/rag-store-evaluation/evidence-manifest.json`'s
   `known_gaps_not_yet_covered_by_this_manifest` array) — the same
   "which version wins" question shows up in both places.
3. **Multi-admin conflict handling.** If two admins upload conflicting
   corrections for the same fact, how is that surfaced? (Not urgent for
   a first version — worth a one-line flag for later.)

## Suggested build order (for whenever this is picked up)

1. Text-paste mode only, going straight through the existing `/ingest`
   endpoint with `sourceType: "manual_text"` — smallest possible slice,
   proves the integration, no OCR/file-storage work needed yet.
2. Image upload + OCR, reusing `ingest_pdf.py`'s Vision-fallback call.
3. PDF upload, reusing `ingest_pdf.py`'s full extraction pipeline.
4. Review-before-publish state, once real usage shows whether instant
   publish is actually a problem in practice.

Not started. No code changed for this feature in this session — this
file is the only artifact, so a future session has the grounding needed
to build it without re-deriving the architecture from scratch.
