import { createClient } from "@libsql/client";
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import { convexKnowledgeStore } from "./convexAdapter";
import { createTursoKnowledgeStore } from "./tursoAdapter";
import type { KnowledgeStore } from "./types";
import { createZillizKnowledgeStore } from "./zillizAdapter";

// Server-only backend selection (migration brief §8). Convex action code
// never ships to the browser bundle, so plain process.env reads here are
// already server-only by construction — no separate secrecy mechanism
// needed. Nothing in the app calls getKnowledgeStore() yet: production
// retrieval/ingestion still goes through the existing direct
// rag.search()/rag.add() call sites unchanged (migration brief §2, §40).
// This factory exists for the benchmark tooling and the eventual, separate,
// deliberate cutover of those call sites - not wired into them by this pass.

let tursoStoreSingleton: KnowledgeStore | null = null;

function getTursoStore(): KnowledgeStore {
  if (!tursoStoreSingleton) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) {
      throw new Error(
        "KNOWLEDGE_STORE_BACKEND=turso requires TURSO_DATABASE_URL to be set.",
      );
    }
    tursoStoreSingleton = createTursoKnowledgeStore(createClient({ url, authToken }));
  }
  return tursoStoreSingleton;
}

let zillizStoreSingleton: KnowledgeStore | null = null;

function getZillizStore(): KnowledgeStore {
  if (!zillizStoreSingleton) {
    const address = process.env.ZILLIZ_ENDPOINT;
    const token = process.env.ZILLIZ_API_KEY;
    if (!address || !token) {
      throw new Error(
        "KNOWLEDGE_STORE_BACKEND=zilliz requires ZILLIZ_ENDPOINT and ZILLIZ_API_KEY to be set.",
      );
    }
    zillizStoreSingleton = createZillizKnowledgeStore(new MilvusClient({ address, token }));
  }
  return zillizStoreSingleton;
}

export function getKnowledgeStore(): KnowledgeStore {
  // Unset defaults to "convex" (the current, unchanged, production backend)
  // rather than throwing, so this factory is safe to introduce before every
  // deployment target has the var configured. An explicitly-set but
  // unrecognized value fails loudly instead of silently falling back to
  // convex - migration brief §8: "unknown backend values must fail safely."
  const backend = process.env.KNOWLEDGE_STORE_BACKEND ?? "convex";
  switch (backend) {
    case "convex":
      return convexKnowledgeStore;
    case "turso":
      return getTursoStore();
    case "zilliz":
      return getZillizStore();
    default:
      throw new Error(
        `Unknown KNOWLEDGE_STORE_BACKEND: "${backend}" (expected "convex", "turso", or "zilliz").`,
      );
  }
}

export type { KnowledgeStore } from "./types";
