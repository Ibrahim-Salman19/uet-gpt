# Deployment

> Authoritative detail in `architecture.md` §8 (Environment / Config) and §17
> (build/tooling). Keep env var names in sync with the code.

## Architecture

- **Frontend:** Vercel (Next.js standalone output)
- **Backend:** Convex (cloud-hosted)
- **Crawler:** Python async BFS crawler (`scripts/crawler.py`), run out-of-band
  (Crawl4AI is secondary and currently disabled — see `docs/crawling-strategy.md`)
- **AI Providers:** Groq, Google Gemini, Cerebras (third-party APIs)

## Environment Variables

See `architecture.md` §8.2 for the authoritative list. At minimum:

```
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
CRAWL_WEBHOOK_SECRET=
INTERNAL_API_SECRET=
GROQ_API_KEY=
GEMINI_API_KEY=
CEREBRAS_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Deployment Steps

1. Push to GitHub → Vercel auto-deploys (or manual via `vercel deploy`).
2. Deploy Convex: `npx convex deploy` (or auto-deploy on push if configured).
3. Set all required env vars in Vercel and the Convex dashboard.
4. Verify the webhook endpoints are reachable externally (Clerk + crawl/ingest).

> Note: the corpus is populated by the crawl/ingest pipeline, not by a seed
> script. There is no functional `scripts/seed.ts` deploy step.

## Open Items

- [ ] Add Vercel configuration in `.vercel/project.json`
- [ ] Configure Convex CI/CD deployment
- [ ] Add a health check endpoint to the deploy verification
- [ ] Set up monitoring (errors, latency, costs) — Sentry is wired (architecture.md §2)
- [ ] Document rollback procedure
