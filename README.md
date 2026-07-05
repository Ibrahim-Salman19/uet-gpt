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
- Python 3.x (for the async BFS crawler and PDF ingest scripts in `scripts/`)
- A Convex account, a Clerk application, and API keys for Groq / Gemini / Cerebras

## Environment Variables

Set these in `.env.local` (Next.js) and in the Convex dashboard as appropriate.
See `.env.local.example` for the full list with comments, and `architecture.md` §8.2 for the authoritative descriptions.

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
- [`testing.md`](./testing.md) — testing strategy (trimmed, agent-optimized)
- [`THREAT_MODEL.md`](./THREAT_MODEL.md) — security threat model
- [`CRONJOB.md`](./CRONJOB.md) — autonomous maintenance protocol
- [`DESIGN.md`](./DESIGN.md) — design system (Neo Kinpaku)
- [`PRODUCT.md`](./PRODUCT.md) — product definition
- [`CHANGELOG.md`](./CHANGELOG.md) — engineering work log
- [`docs/`](./docs) — focused reference docs:
  - `docs/reference/` — API signatures, env vars, auth matrix, component inventory
  - `docs/security.md` — security controls summary
  - `docs/embedding-strategy.md` — embedding model + vector store
  - `docs/agent-coordination.md` — frontend/backend agent boundary rules
  - `docs/frontend_backend_boundaries.md` — ownership rules between src/ and convex/
  - `docs/deployment.md` — deployment architecture
  - `docs/crawl-robots-audit.md` — robots.txt compliance decisions
