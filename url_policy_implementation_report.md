# url_policy.py — Implementation Report

**Deliverable:** `scripts/uet_crawler/url_policy.py` (single-file patch)
**SHA-256:** `59a8f10607985e68cf0885efc5edb13f2b560c1fd5f47f5e0b6be5f268cb3772`
**Archive:** `url_policy_single_file_patch.zip` (SHA-256 `9aa3c57d8d4c7b9b6abdf23c0ae4e3469b20cd3d6a9f97a99edaf60e72c7bdbf`)
**Scope:** only `scripts/uet_crawler/url_policy.py` created; no other file modified.

## Standards applied

- RFC 3986 — percent-encoding normalization (unreserved decoded, reserved kept encoded, hex uppercased), dot-segment removal, budgets.
- WHATWG URL — pre-validation rejects what `urlsplit` tolerates: C0 controls, DEL, embedded whitespace, backslashes, credentials, malformed/zero ports, malformed escapes, encoded controls, legacy numeric hosts (`127.1`, octal/hex/integer).
- UTS #46 / IDNA2008 via `idna` package; releases < 3.14 (CVE-2026-45409) treated as unavailable → Unicode hosts fail closed; ASCII LDH hosts never need the dependency. RFC 1123 label grammar enforced (no underscores, no empty labels, no edge hyphens).
- Query semantics: not form-encoded (`+`/`%20`/`%2B` distinct, `?flag` ≠ `?flag=`); sorted by (key, value, had-equals) by default; duplicates preserved; opt-in `dedupe_query_params`; budgets enforced on raw input before stripping/sorting.

## Behavior highlights

- HTTPS upgrade only for https-seed hosts, `https_upgrade_hosts`, or `upgrade_allowed_suffixes_to_https=True`; non-default ports never moved between schemes.
- Tracking defaults {utm_*, fbclid, gclid, msclkid}; ambiguous keys (`ref`, `source`, `sid`) preserved unless configured; `drop_session_params` always merged.
- Mutation detection: bounded nested decode (`_MAX_DECODE_DEPTH=5`, fails closed), token-aware segment/query matching, state-changing query keys; informational `update`/`drop` allowed.
- PDF detection: path suffixes (encoded + matrix-param aware) and filename-bearing query keys {file, download, filename, name, doc, document}; bare word `pdf` not a signal.
- `is_crawl_candidate` excludes robots/sitemap basenames, front-end assets, skip_extensions, include/exclude patterns, mutation URLs.
- IPv6 literals valid as origin keys (compressed + bracketed) but excluded from the fetch boundary; all public methods fail closed, never raise.

## Verification

| Suite | Result |
|---|---|
| `unittest scripts/test_url_policy_adversarial.py` (repo contract) | 8/8 OK |
| `pytest scripts/test_crawler_security.py` | 25/25 passed |
| Adversarial matrix (~200 checks, 22 idempotence URLs) | ALL PASS |
| Seeded fuzz (30,000 mutations → 14,836 unique URLs; determinism, idempotence, never-raise) | OK |
| `-W error` integration imports (crawler, audit_extraction, browser_renderer, html_extractor, gemini_response, robots_rules, image_normalization, crawl_ledger) | OK |

## Deployment requirement

`pip install "idna>=3.18,<4"` (already satisfied; ASCII-only deployments run without it, Unicode hosts fail closed).
