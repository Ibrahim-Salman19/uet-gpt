# UET Robots.txt Audit

**Source:** https://web.uettaxila.edu.pk/robots.txt

**Date:** 2026-05-21

## Findings

The UET website returns a modern Content Signals Protocol (CCI) robots.txt with no traditional `Allow`/`Disallow` rules:

- Uses `search`, `ai-input`, `ai-train` content-signal directives
- No explicit disallow rules for any paths
- All signals are permissive (no `no` values specified)

## Implications

| Concern | Status |
|---|---|
| Search indexing | Not restricted |
| RAG context retrieval (ai-input) | Not restricted |
| Model training (ai-train) | Not restricted |
| Path-level blocks | None declared |

## Decisions

- Respect all content signals as-is
- No path-level restrictions required
- Conservative crawl defaults apply (rate limiting, user-agent identification)

## Notes

- If robots.txt becomes unreachable in future, apply conservative crawl defaults
- Monitor for future robots.txt changes that may restrict `ai-input` access
- No additional crawling restrictions needed beyond standard politeness
