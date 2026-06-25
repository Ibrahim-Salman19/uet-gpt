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
- **Content-signal compliance (explicit, conservative decision):** The `ai-input` and `ai-train` signals are unset (neither granted nor restricted). We deliberately resolve this ambiguity conservatively:
  - **Permitted:** use crawled content solely to build a retrieval/search index that links back to and quotes the original UET pages (the same access a standard search engine has under the absent `Disallow`).
  - **Not permitted from this signal alone:** using the crawled corpus to train or fine-tune any model. `ai-train` being unset is treated as "no consent" for training, not as a grant.
  - **Caveat:** an unset content-signal is not affirmative permission. If UET later publishes explicit `ai-input`/`ai-train` directives, honor them on the next re-audit.
- **Crawl scope:** No paths are explicitly blocked by a `Disallow` rule, so a rate-limited, search-indexing crawl of the public site is permitted. Scope is still bounded by the crawler's own `includePaths`/`excludePaths` (see `src/lib/constants.ts` / `scripts/crawl_config.json`), not by robots.txt.
- **Tooling limitation:** the Python crawler enforces robots via `urllib.robotparser` (standard REP only); it does **not** parse the content-signal directives above. Compliance with `ai-input`/`ai-train` is therefore a manual policy decision recorded here, re-checked on each re-audit, rather than something enforced in code.

## Notes

- The robots.txt uses content-signal format rather than traditional robots exclusion protocol. This is a modern approach for AI-era crawling permissions.
- If robots.txt becomes unreachable in future crawls, conservative defaults (rate-limited, respectful crawling) will apply.
- Re-audit on schedule or when the source robots.txt changes.
