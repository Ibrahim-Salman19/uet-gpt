# UET Taxila GPT

An autonomous RAG (Retrieval-Augmented Generation) chatbot for UET Taxila. It
answers questions about admissions, departments, fees, exams, faculty, and
campus life using a hybrid search + LLM generation pipeline over a corpus of
crawled university web pages and ingested PDFs.

## Stack

- **Frontend:** Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, Radix UI
- **Backend:** Convex (real-time DB + serverless functions, native vector index)
- **Auth:** Clerk (RBAC: user / admin / superadmin)
- **LLM:** Vercel AI SDK with a Groq → Cerebras → Gemini fallback chain
- **Crawler:** Python async BFS crawler (`curl_cffi`, `trafilatura`)

See [`architecture.md`](./architecture.md) — the single source of truth — for the
full system design.

## Prerequisites

- [pnpm](https://pnpm.io/) (this repo is pnpm-locked; do not mix npm/yarn — see `architecture.md` §17)
- Node.js (version per `package.json` / `.nvmrc`)
- A Convex account, a Clerk application, and API keys for Groq / Gemini / Cerebras

## Environment Variables

Set these in `.env.local` (Next.js) and in the Convex dashboard as appropriate.
See `architecture.md` §8.2 for the authoritative list.

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

## Getting Started

```bash
pnpm install

# Run the Convex backend (in one terminal)
npx convex dev

# Run the Next.js dev server (in another terminal)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

## Testing

```bash
pnpm test        # Vitest unit + integration tests
pnpm lint        # Biome lint
pnpm test:e2e    # Playwright end-to-end tests
```

## Documentation

- [`architecture.md`](./architecture.md) — single source of truth for system design
- [`AGENTS.md`](./AGENTS.md) — agent / contributor instructions
- [`testing.md`](./testing.md) — testing strategy and plan
- [`THREAT_MODEL.md`](./THREAT_MODEL.md) — security threat model
- [`docs/`](./docs) — focused design notes (RAG pipeline, chunking, embedding, crawling, security)
