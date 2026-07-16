# UET GPT - Your AI Guide to UET Taxila

> An intelligent AI chatbot that answers any question about the University of Engineering and Technology (UET) Taxila - admissions, fee structure, academic programs, departments, faculty, campus life, transport, hostels, scholarships, and more. Powered by RAG over official UET Taxila data.

**One-line description (SEO):** UET GPT is an AI chatbot that gives instant, cited answers about UET Taxila - admissions, fees, programs, faculty, and campus life - using RAG over the university's official data. Licensed under [AGPL-3.0](./LICENSE).

UET GPT is an autonomous RAG (Retrieval-Augmented Generation) chatbot for UET Taxila. It
answers questions about admissions, departments, fees, exams, faculty, and
campus life using a hybrid search + LLM generation pipeline over a corpus of
crawled university web pages and ingested PDFs.

Live app: [https://uet-gpt.vercel.app](https://uet-gpt.vercel.app) · Source: [github.com/devhms/uet_gpt](https://github.com/devhms/uet_gpt) · [Press kit](https://uet-gpt.vercel.app/press-kit.md)

## What is UET GPT?

UET GPT is a specialized AI assistant for the University of Engineering and Technology (UET), Taxila - one of Pakistan's premier engineering institutions, founded as a UET Lahore campus in 1975 and granted its independent charter in 1993, now serving 5,000+ students across 30+ programs. Instead of digging through scattered university web pages and PDFs, students, applicants, parents, and faculty ask UET GPT in plain language and get fast, accurate answers backed by citations from official UET Taxila sources.

Key things to know:

- **Built for UET Taxila** - every answer is grounded in UET Taxila's official website (`web.uettaxila.edu.pk`), admissions portal (`admissions.uettaxila.edu.pk`), and ingested documents.
- **Retrieval-Augmented Generation (RAG)** - answers are retrieved from a continuously crawled, indexed knowledge base, not hallucinated from generic model memory.
- **Cited and verifiable** - responses link back to the official university material they came from.
- **Open source** - the full stack is public on [GitHub](https://github.com/devhms/uet_gpt) under [AGPL-3.0](./LICENSE), and is free to use.

UET GPT is currently free to use at [https://uet-gpt.vercel.app](https://uet-gpt.vercel.app).

## Stack

- **Frontend:** Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, Radix UI
- **Backend:** Convex (real-time DB + serverless functions, native vector index)
- **Auth:** Clerk (RBAC: user / admin / superadmin)
- **LLM:** Vercel AI SDK with a Groq → Cerebras → Gemini fallback chain
- **Crawler:** Python async BFS crawler (`curl_cffi`, `trafilatura`)

See [`architecture.md`](./architecture.md) - the single source of truth - for the
full system design.

## Prerequisites

- [pnpm](https://pnpm.io/) (this repo is pnpm-locked; do not mix npm/yarn - see `architecture.md` §17)
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

- [`architecture.md`](./architecture.md) - single source of truth for system design
- [`AGENTS.md`](./AGENTS.md) - agent / contributor instructions
- [`testing.md`](./testing.md) - testing strategy (trimmed, agent-optimized)
- [`THREAT_MODEL.md`](./THREAT_MODEL.md) - security threat model
- [`CRONJOB.md`](./CRONJOB.md) - autonomous maintenance protocol
- [`DESIGN.md`](./DESIGN.md) - design system (Neo Kinpaku)
- [`PRODUCT.md`](./PRODUCT.md) - product definition
- [`CHANGELOG.md`](./CHANGELOG.md) - engineering work log
- [`docs/`](./docs) - focused reference docs:
  - `docs/reference/` - API signatures, env vars, auth matrix, component inventory
  - `docs/security.md` - security controls summary
  - `docs/embedding-strategy.md` - embedding model + vector store
  - `docs/agent-coordination.md` - frontend/backend agent boundary rules
  - `docs/frontend_backend_boundaries.md` - ownership rules between src/ and convex/
  - `docs/deployment.md` - deployment architecture
  - `docs/crawl-robots-audit.md` - robots.txt compliance decisions
