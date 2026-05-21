# UET Robots.txt Audit

Source: https://web.uettaxila.edu.pk/robots.txt

## Findings

- **Standard robot exclusion rules:** None found. No `User-agent`, `Disallow`, or `Allow` directives exist.
- **Content signals present:** The file exclusively contains content-signal directives (search, ai-input, ai-train), each defaulting to no explicit permission (neither grants nor restricts).
  - `search:` — not explicitly set (neither yes nor no)
  - `ai-input:` — not explicitly set
  - `ai-train:` — not explicitly set
- **Format:** Uses the emerging content-signal standard for AI/data collection permissions.
- The absence of `Disallow` directives means standard crawlers (Googlebot, Bingbot, etc.) are implicitly allowed to crawl the entire domain under standard protocol.

## Decisions

- **Respect disallow rules:** No standard rules to respect. The absence of blocking directives means all paths are crawlable.
- **Conservative crawl defaults:** Apply rate limiting and respect `Crawl-delay` if specified (none present). Honor any future robots.txt updates.
- **Content-signal compliance:** Since ai-input and ai-train signals default to neither granted nor restricted, our RAG pipeline should treat crawled content as available for search indexing but exercise caution regarding AI training use of the data.
- **Crawl scope:** Full site crawl is permitted. No paths are explicitly blocked.

## Notes

- The robots.txt uses content-signal format rather than traditional robots exclusion protocol. This is a modern approach for AI-era crawling permissions.
- If robots.txt becomes unreachable in future crawls, conservative defaults (rate-limited, respectful crawling) will apply.
- Re-audit on schedule or when the source robots.txt changes.
