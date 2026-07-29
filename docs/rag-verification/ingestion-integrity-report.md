# Ingestion Pipeline Integrity Report

**Date:** July 29, 2026  

---

## 1. URL & Discovery Safety
- **Canonicalization:** Trailing slashes, query parameters, and fragments normalized.
- **SSRF Protection:** Host allowlist strictly enforced (`uettaxila.edu.pk`, `uet.edu.pk`). Private IP ranges (`127.0.0.1`, `169.254.169.254`, `::1`) rejected.
- **Fetch Limits:** Redirect count capped to 3, maximum response bytes bounded, non-HTML/PDF mime types rejected.

---

## 2. Parent-Child Chunking & Normalized Storage
- Storage normalization implemented via `chunkParents` table.
- Parent chunk text stored once per document; child chunks reference parent via `parentId`.
- Heading paths preserved in `crawledChunks.headingPath`.

---

## 3. Ingestion Invariant Enforcement
- Atomic publication enforced via `assertIngestionPublishable`.
- Partial chunk or embedding persists rejected before active state switch.
