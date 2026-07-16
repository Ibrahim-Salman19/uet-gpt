// No-op stub for the `server-only` package under Vitest.
//
// The real `server-only` package throws on import unless resolved via the
// "react-server" export condition (which Next.js sets but Vitest's node
// environment does not). Server-only modules (e.g. src/lib/llm-models.ts,
// src/lib/rate-limit.ts) are still safe to unit-test in node - aliasing the
// import here to an empty module lets those tests run without weakening the
// production guard that keeps server-only code out of the client bundle.
export {};
