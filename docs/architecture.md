# Architecture

## System Overview

- **Frontend:** Next.js 16 (App Router) + Tailwind v4 + shadcn/ui
- **Backend:** Convex (reactive serverless)
- **Auth:** Clerk (Next.js SDK)
- **AI:** Vercel AI SDK v6, Groq (primary), Gemini (fallback), Cerebras (fallback)
- **Crawling:** Crawl4AI (local instance, Flask-based)
- **Vector Search:** Convex vector search (actions only)
- **Components:** `@convex-dev/rag` (documents/chunks), `@convex-dev/agent` (threads/messages)

## Data Flow

1. User asks question via chat UI
2. Clerk authenticates → Convex mutation stores user message
3. HTTP action (`/api/chat`) triggers context retrieval:
   - Intent classification → query rewriting → HyDE
   - Embedding generation (Gemini API) → vector search
   - Semantic cache lookup → hybrid search (vector + full-text)
   - Context assembly (sandwich strategy)
4. LLM streaming response → stored in DB → semantic cache
5. Frontend renders via `useChat` (AI SDK)

## Directory Structure

```
src/          — Next.js app (routes, components, hooks, providers)
convex/       — Convex functions (actions, mutations, queries, schema)
scripts/      — Standalone Node.js scripts (seed, validate, migrate)
docs/         — Design docs, strategies, audit reports
tests/        — Vitest unit tests
```

## TODO

- [ ] Add component architecture diagram (Mermaid)
- [ ] Document auth flow (Clerk → Convex → sessions)
- [ ] Document deployment architecture (Vercel + Convex)
