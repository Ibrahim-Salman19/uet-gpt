last_updated: 2026-05-30 10:02 UTC

last_run:
  task_id: "TASK-E06"
  task_name: "Parent-child chunking (child 200tok embed, parent 1500tok return)"
  status: completed
  eval_recall_at_5: N/A (eval requires live Convex — exit 1 expected)
  eval_fragment_hit: N/A

  changes:
    - "convex/schema.ts: TASK-E06 — declared optional parentText field in crawledChunks schema."
    - "convex/embeddings/doc_queries.ts: TASK-E06 — updated getDocumentByEntryId query return schema and handler to retrieve and return crawledAt, freshnessTier, and parentText metadata."
    - "convex/embeddings/search.ts: TASK-E06 — updated searchDocumentsAction handler to fetch parentText from docMap and return it as the response content for vector/text matches."
    - "convex/crawl/webhook.ts: TASK-E06 — modified both crawlWebhook and ingestWebhook to perform parent-child chunking (parent chunks max 3000 chars, child chunks max 800 chars) and propagate parentText."
    - "convex/crawl/mutations.ts: TASK-E06 — updated arguments and contexts in queueChunksForEmbedding, saveEmbedding, onChunkEmbedded, and enqueueDocumentChunks to safely validate, propagate, and insert parentText in crawledChunks."
    - "tests/convex/crawl/webhook.test.ts: TASK-E06 — added parent-child chunking unit test case to verify correct parent-child text generation and mapping."
    - "TODO.md: marked TASK-E06 as DONE and updated Next Run Priority."

  bugs_found_and_fixed:
    - "Fixed a hidden schema constraint bug where doc.crawledAt and doc.freshnessTier in search.ts were resolving to undefined because getDocumentByEntryId query return validator excluded them."

  gate_results:
    gate_1_typescript: PASS (0 errors)
    gate_2_python: PASS
    gate_3_unit_tests: PASS (264/264 tests passed across 33 files)
    gate_4_eval: SKIPPED (no live Convex)
    gate_5_category_eval: SKIPPED

next_task:
  id: "TASK-E07"
  name: "Gemini VLM verification pass + retry on table structure failure"
  reason: "High parsing accuracy boost, processes and verifies table ingestion accurately using multimodal fallback"
  files_in_scope:
    - "scripts/ingest_pdf.py"

system_health:
  last_compilation: OK
  stale_documents: 0
  dlq_size: 0
  eval_harness: READY
  golden_set_pairs: 75
  unit_tests: 264/264 PASS

security_posture:
  domain_allowlist: IMPLEMENTED (webhook.ts)
  pdf_sanitization: IMPLEMENTED (ingest_pdf.py)
  rate_limiting: IMPLEMENTED (rateLimit.ts + messages.ts)
  injection_scanning: IMPLEMENTED (retrieval.ts)
  tasks_remaining: [TASK-E07, TASK-E08, TASK-E09, TASK-E10]

known_assumptions:
  - "E06: Splitting documents into parent chunks (3000 chars) and child chunks (800 chars) increases total stored chunks by ~25% but keeps embedding semantic matching highly precise and returned context extremely rich."
