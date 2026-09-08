import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Headers, Request, Response, fetch as undiciFetch } from "undici";
import { describe } from "vitest";
import { createTursoKnowledgeStore } from "../../convex/knowledgeStore/tursoAdapter";
import { runKnowledgeStoreContractTests } from "./knowledgeStoreContract";

// Same contract suite as knowledgeStore-turso.test.ts, but against the real
// Turso Cloud database (TURSO_DATABASE_URL/TURSO_AUTH_TOKEN) instead of a
// local file  -  exercises the actual HTTP/Cloud transport, not just the
// engine. Skips itself entirely (not a failure) when Cloud credentials
// aren't configured, so `pnpm test` stays runnable without them.
//
// tests/setup.ts globally mocks `global.fetch = vi.fn()` for every test file
// (needed elsewhere to stub external LLM API calls) and re-applies that mock
// after every single test via an afterEach hook. @libsql/client's Cloud/HTTP
// transport (@libsql/hrana-client's HttpStream) genuinely calls the global
// fetch per-request rather than capturing a reference at import time, so it
// silently gets the no-op mock instead of the network - confirmed by an
// actual run: every test failed with "Cannot read properties of undefined
// (reading 'then')" inside hrana-client's HttpStream#flush, the exact
// signature of `fetch()` returning `undefined` (vi.fn()'s default) instead
// of a real Promise.
//
// Restoring only `fetch` (from undici, the same engine Node's own global
// fetch is built on) surfaced a second bug: hrana-client constructs `new
// Request(...)` against whatever `globalThis.Request` currently is (Node's
// untouched native one) and hands it to the freshly-restored undici fetch,
// which does its own internal branding check and doesn't recognize a
// Request from a different undici realm - it stringifies it to
// "[object Request]" and tries to parse THAT as a URL. Overriding
// Request/Headers/Response from the SAME undici import as fetch keeps
// everything in one consistent realm. Done inside createStore - called
// fresh before every test by runKnowledgeStoreContractTests - so it survives
// setup.ts's per-test afterEach reset of `global.fetch`.

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
const hasCloudCredentials = Boolean(url && url.startsWith("libsql://"));

const schemaSql = readFileSync(
  join(__dirname, "../../convex/knowledgeStore/tursoSchema.sql"),
  "utf-8",
);

describe.skipIf(!hasCloudCredentials)("turso cloud contract suite", () => {
  runKnowledgeStoreContractTests("turso (real Cloud)", async () => {
    globalThis.fetch = undiciFetch as unknown as typeof globalThis.fetch;
    globalThis.Request = Request as unknown as typeof globalThis.Request;
    globalThis.Headers = Headers as unknown as typeof globalThis.Headers;
    globalThis.Response = Response as unknown as typeof globalThis.Response;
    const client = createClient({ url: url!, authToken });
    await client.executeMultiple(schemaSql);
    // Cloud DB persists across tests (no "delete the file" reset available) -
    // truncate before each test so it starts from a clean slate.
    for (const table of ["chunks_fts", "chunks", "chunk_parents", "documents"]) {
      await client.execute(`DELETE FROM ${table}`);
    }

    return {
      store: createTursoKnowledgeStore(client),
      ctx: undefined,
      cleanup: async () => {
        for (const table of ["chunks_fts", "chunks", "chunk_parents", "documents"]) {
          await client.execute(`DELETE FROM ${table}`);
        }
        client.close();
      },
    };
  });
});
