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

## Database Schema (ER Diagram)

```mermaid
erDiagram
    users {
        string clerkId PK
        string name
        string email
        string imageUrl
        string role
        boolean isActive
        number lastLoginAt
        object preferences
        object metadata
    }

    feedback {
        Id messages messageId FK
        Id users userId FK
        string rating
        string comment
        string category
        number createdAt
    }

    crawlJobs {
        string trigger
        Id users startedBy FK
        string status
        object config
        object stats
        string error
        number startedAt
        number completedAt
        number duration
    }

    semanticCache {
        string queryText
        float64[] queryEmbedding
        string response
        object[] sources
        string model
        object tokenCount
        number hits
        number expiresAt
        number createdAt
    }

    adminAuditLog {
        Id users userId FK
        string action
        string target
        object details
        string ipAddress
        number createdAt
    }

    notifications {
        Id users userId FK
        string title
        string body
        string type
        boolean isRead
        string link
        number createdAt
    }

    documents {
        string url PK
        string title
        string entryId
        string contentHash
        string source
        string category
        string subcategory
        object metadata
        string status
        number chunkCount
        number crawledAt
        number updatedAt
        string error
    }

    threads {
        Id users userId FK
        string title
        boolean isArchived
        number createdAt
        number updatedAt
    }

    messages {
        Id threads threadId FK
        string role
        string content
        object[] sources
        object tokenCount
        number createdAt
    }

    users ||--o{ feedback : "receives"
    users ||--o{ crawlJobs : "starts"
    users ||--o{ adminAuditLog : "generates"
    users ||--o{ notifications : "receives"
    users ||--o{ threads : "owns"
    threads ||--o{ messages : "contains"
    messages ||--o{ feedback : "receives"
```

## Component-Managed Tables

| Component | Tables | Notes |
|-----------|--------|-------|
| `@convex-dev/rag` | `entries`, `chunks` | Internal RAG storage; accessed via `rag.add()`, `rag.search()` |
| `@convex-dev/agent` | `threads`, `messages` | Agent conversation storage; accessed via `agent:createThread`, `agent:continueThread` |

**Important**: The `documents` table in our schema is a **metadata tracker** for crawled pages. It stores URLs, titles, categories, and RAG `entryId` references. The actual chunked content and embeddings are managed internally by the RAG component.

## Index Strategy

| Table | Index | Fields | Purpose |
|-------|-------|--------|---------|
| `users` | `by_clerkId` | clerkId | Auth lookup |
| `users` | `by_email` | email | User sync |
| `users` | `by_role` | role | Admin filtering |
| `documents` | `by_url` | url | Deduplication |
| `documents` | `by_category` | category | Filtering |
| `documents` | `by_status` | status | Crawl status |
| `documents` | `by_crawledAt` | crawledAt | Time-based queries |
| `documents` | `search_title` | title | Full-text search |
| `semanticCache` | `by_expiresAt` | expiresAt | TTL cleanup |
| `semanticCache` | `by_queryEmbedding` | queryEmbedding (768d) | Vector similarity |

## TODO

- [ ] Document auth flow (Clerk → Convex → sessions)
- [ ] Document deployment architecture (Vercel + Convex)
- [ ] Add RAG pipeline sequence diagram
