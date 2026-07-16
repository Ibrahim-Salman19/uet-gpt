# Phase 0–1 Verify & Align Implementation Plan

> **⚠️ HISTORICAL / SUPERSEDED (2026-05-21).** This implementation plan is a
> point-in-time artifact and is **not** current guidance. Its core architectural
> step - "replace manual `documents/chunks/threads/messages` schema definitions
> with component-managed tables" - was only partially carried out: `documents` and
> `crawledChunks` remain **manually defined** in `convex/schema.ts`. Do **not**
> delete those tables. See `architecture.md` §4 for the authoritative schema. Kept
> for historical context only.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify and fill all Phase 0 scaffolding gaps and align the Convex schema to component-managed tables for Phase 1, strictly following `todo.md` (Path A free tier).

**Architecture:** Keep current app structure, replace manual `documents/chunks/threads/messages` schema definitions with component-managed tables, and fill missing Phase 0 assets (Tailwind config, Next config, docs, scripts, workflows, robots audit, Clerk webhook). All vector search remains in actions.

**Tech Stack:** Next.js 16.2, TypeScript 5.7, Convex, @convex-dev/rag, @convex-dev/agent, Clerk, Tailwind v4, shadcn/ui, AI SDK v6.

---

## File Structure (Planned Changes)

**Create**
- `uet-gpt/tailwind.config.ts` - Tailwind v4 config and theme tokens
- `uet-gpt/docs/crawl-robots-audit.md` - robots.txt audit
- `uet-gpt/docs/architecture.md`
- `uet-gpt/docs/crawling-strategy.md`
- `uet-gpt/docs/chunking-strategy.md`
- `uet-gpt/docs/embedding-strategy.md`
- `uet-gpt/docs/rag-pipeline.md`
- `uet-gpt/docs/evaluation.md`
- `uet-gpt/docs/security.md`
- `uet-gpt/docs/deployment.md`
- `uet-gpt/scripts/seed.ts`
- `uet-gpt/scripts/validate-urls.ts`
- `uet-gpt/scripts/migrate-schema.ts`
- `uet-gpt/.github/workflows/ci.yml`
- `uet-gpt/.github/workflows/deploy.yml`
- `uet-gpt/src/app/api/webhooks/clerk/route.ts`

**Modify**
- `uet-gpt/next.config.ts`
- `uet-gpt/package.json`
- `uet-gpt/convex/schema.ts`
- `uet-gpt/convex/threads.ts`
- `uet-gpt/convex/messages.ts`
- `uet-gpt/convex/doc/*.ts` (if needed for component alignment)
- `uet-gpt/convex/embeddings/search.ts` (ensure action-only vector search remains intact)

**Tests**
- `uet-gpt/tests/unit/*` (new tests only if required by the step, otherwise defer to Phase 6)

---

### Task 1: Add Tailwind v4 Config

**Files:**
- Create: `uet-gpt/tailwind.config.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/tailwind-config.test.ts
import { describe, it, expect } from "vitest";
import config from "../../tailwind.config";

describe("tailwind config", () => {
  it("defines UET brand colors and darkMode class", () => {
    expect(config).toHaveProperty("darkMode");
    expect(config.darkMode).toBe("class");
    const theme = (config as any).theme;
    expect(theme?.extend?.colors?.uetPrimary).toBeDefined();
    expect(theme?.extend?.colors?.uetGold).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest --run tests/unit/tailwind-config.test.ts`
Expected: FAIL with module not found or missing config values.

- [ ] **Step 3: Write minimal implementation**

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        uetPrimary: "#003366",
        uetGold: "#D4A843",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest --run tests/unit/tailwind-config.test.ts`
Expected: PASS

- [ ] **Step 5: Verify full gate**

Run: `pnpm run typecheck && pnpm run lint && pnpm vitest --run && npx next build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.ts tests/unit/tailwind-config.test.ts
git commit -m "chore: add tailwind config"
```

---

### Task 2: Update Next.js Config (redirects/headers/standalone)

**Files:**
- Modify: `uet-gpt/next.config.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/next-config.test.ts
import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";

describe("next config", () => {
  it("defines redirects and standalone output", () => {
    expect((nextConfig as any).output).toBe("standalone");
    expect(typeof (nextConfig as any).redirects).toBe("function");
    expect(typeof (nextConfig as any).headers).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest --run tests/unit/next-config.test.ts`
Expected: FAIL with missing output/redirects/headers.

- [ ] **Step 3: Write minimal implementation**

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.convex.cloud" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
  async redirects() {
    return [{ source: "/", destination: "/chat", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest --run tests/unit/next-config.test.ts`
Expected: PASS

- [ ] **Step 5: Verify full gate**

Run: `pnpm run typecheck && pnpm run lint && pnpm vitest --run && npx next build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add next.config.ts tests/unit/next-config.test.ts
git commit -m "chore: update next config"
```

---

### Task 3: Add robots.txt audit document

**Files:**
- Create: `uet-gpt/docs/crawl-robots-audit.md`

- [ ] **Step 1: Fetch robots.txt**

Run: `curl -s https://web.uettaxila.edu.pk/robots.txt`
Expected: content or empty response logged.

- [ ] **Step 2: Write audit doc**

```md
# UET Robots.txt Audit

Source: https://web.uettaxila.edu.pk/robots.txt

## Findings
- [list allow/disallow rules]

## Decisions
- Respect disallow rules for blocked paths.
- Flag critical blocked paths for manual review.

## Notes
- If robots.txt is unreachable, conservative defaults apply.
```

- [ ] **Step 3: Verify full gate**

Run: `pnpm run typecheck && pnpm run lint && pnpm vitest --run && npx next build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/crawl-robots-audit.md
git commit -m "docs: add robots audit"
```

---

### Task 4: Add required docs and scripts scaffolding

**Files:**
- Create: `uet-gpt/docs/architecture.md`
- Create: `uet-gpt/docs/crawling-strategy.md`
- Create: `uet-gpt/docs/chunking-strategy.md`
- Create: `uet-gpt/docs/embedding-strategy.md`
- Create: `uet-gpt/docs/rag-pipeline.md`
- Create: `uet-gpt/docs/evaluation.md`
- Create: `uet-gpt/docs/security.md`
- Create: `uet-gpt/docs/deployment.md`
- Create: `uet-gpt/scripts/seed.ts`
- Create: `uet-gpt/scripts/validate-urls.ts`
- Create: `uet-gpt/scripts/migrate-schema.ts`

- [ ] **Step 1: Write docs scaffolding**

Each doc should contain a short outline and TODO markers for later phases.

- [ ] **Step 2: Write script stubs**

```ts
// scripts/seed.ts
export async function main() {
  console.log("Seed placeholder");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify full gate**

Run: `pnpm run typecheck && pnpm run lint && pnpm vitest --run && npx next build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs scripts
git commit -m "docs: add scaffolding"
```

---

### Task 5: Add Clerk webhook route

**Files:**
- Create: `uet-gpt/src/app/api/webhooks/clerk/route.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/clerk-webhook.test.ts
import { describe, it, expect } from "vitest";
import { POST } from "../../src/app/api/webhooks/clerk/route";

describe("clerk webhook", () => {
  it("exports POST handler", () => {
    expect(typeof POST).toBe("function");
  });
});
```

- [ ] **Step 2: Implement minimal handler**

```ts
// src/app/api/webhooks/clerk/route.ts
import { Webhook } from "svix";
import { headers } from "next/headers";

export async function POST(req: Request) {
  const secret = process.env.CLERK_SIGNING_SECRET;
  if (!secret) {
    return new Response("Missing CLERK_SIGNING_SECRET", { status: 500 });
  }

  const payload = await req.text();
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  const wh = new Webhook(secret);
  try {
    wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  return new Response("ok", { status: 200 });
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `pnpm vitest --run tests/unit/clerk-webhook.test.ts`
Expected: PASS

- [ ] **Step 4: Verify full gate**

Run: `pnpm run typecheck && pnpm run lint && pnpm vitest --run && npx next build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/clerk/route.ts tests/unit/clerk-webhook.test.ts
 git commit -m "feat: add clerk webhook"
```

---

### Task 6: Align schema to Convex components

**Files:**
- Modify: `uet-gpt/convex/schema.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/schema-components.test.ts
import { describe, it, expect } from "vitest";
import schema from "../../convex/schema";

describe("schema alignment", () => {
  it("does not define threads/messages/documents/chunks manually", () => {
    const tables = (schema as any).tables;
    expect(tables?.threads).toBeUndefined();
    expect(tables?.messages).toBeUndefined();
    expect(tables?.documents).toBeUndefined();
    expect(tables?.chunks).toBeUndefined();
  });
});
```

- [ ] **Step 2: Update schema**

Remove manual `documents`, `chunks`, `threads`, `messages` from `convex/schema.ts`. Keep other tables unchanged.

- [ ] **Step 3: Run test to verify it passes**

Run: `pnpm vitest --run tests/unit/schema-components.test.ts`
Expected: PASS

- [ ] **Step 4: Verify full gate**

Run: `pnpm run typecheck && pnpm run lint && pnpm vitest --run && npx next build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts tests/unit/schema-components.test.ts
 git commit -m "chore: align schema with convex components"
```

---

### Task 7: Update threads/messages APIs to component usage

**Files:**
- Modify: `uet-gpt/convex/threads.ts`
- Modify: `uet-gpt/convex/messages.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/threads-api.test.ts
import { describe, it, expect } from "vitest";
import * as threads from "../../convex/threads";

describe("threads api", () => {
  it("exports create and list", () => {
    expect(typeof threads.create).toBe("function");
    expect(typeof threads.list).toBe("function");
  });
});
```

```ts
// tests/unit/messages-api.test.ts
import { describe, it, expect } from "vitest";
import * as messages from "../../convex/messages";

describe("messages api", () => {
  it("exports list and insert", () => {
    expect(typeof messages.list).toBe("function");
    expect(typeof messages.insert).toBe("function");
  });
});
```

- [ ] **Step 2: Update implementations**

Use `@convex-dev/agent` helpers (e.g., `listUIMessages` / `listMessages`) and component APIs. Ensure `threadId` usage and no direct `ctx.db` for component tables.

- [ ] **Step 3: Verify full gate**

Run: `pnpm run typecheck && pnpm run lint && pnpm vitest --run && npx next build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add convex/threads.ts convex/messages.ts tests/unit/threads-api.test.ts tests/unit/messages-api.test.ts
 git commit -m "feat: migrate threads/messages to agent component"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-21-phase-0-1-verify-align.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
