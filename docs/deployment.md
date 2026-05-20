# Deployment

## Architecture

- **Frontend:** Vercel (Next.js standalone output)
- **Backend:** Convex (cloud-hosted)
- **Crawler:** Crawl4AI local instance (Flask)
- **AI Providers:** Groq, Google Gemini, Cerebras (third-party APIs)

## Environment Variables

```
CONVEX_DEPLOYMENT=
CLERK_SECRET_KEY=
CLERK_SIGNING_SECRET=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
CEREBRAS_API_KEY=
```

## Deployment Steps

1. Push to GitHub → Vercel auto-deploys (or manual via `vercel deploy`)
2. Convex auto-deploys on push (if configured) or via `npx convex deploy`
3. Run seed script: `npx tsx scripts/seed.ts`
4. Verify webhook endpoint accessible externally

## TODO

- [ ] Add Vercel configuration in `.vercel/project.json`
- [ ] Configure Convex CI/CD deployment
- [ ] Add health check endpoint
- [ ] Set up monitoring (errors, latency, costs)
- [ ] Document rollback procedure
