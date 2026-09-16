/**
 * Delete one superseded document from PRODUCTION: its Pinecone vectors, its crawledChunks rows,
 * and the documents row. Dry run by default; pass --execute to delete.
 *
 *   node scripts/delete_superseded_document.cjs --document-id <id> --expect-path <URL path> [--execute]
 *
 * Why not admin/stats.deleteDocument or doc/remove.remove: both delete Convex rows only and leave
 * the Pinecone vectors, which denseSearch keeps returning. Pinecone is deleted first, by explicit
 * id, and verified empty before any Convex row is touched, so a failure never leaves vectors
 * pointing at deleted rows.
 *
 * Safety: refuses to run unless the chunks' "URL Path:" header matches --expect-path.
 * Credentials: CONVEX_DEPLOY_KEY / NEXT_PUBLIC_CONVEX_URL from .env.vercel-production.local,
 * PINECONE_API_KEY from .env.local. Database I/O: about 2x the chunk rows' size (list + delete).
 */
const fs = require("node:fs");
const { ConvexHttpClient } = require("convex/browser");
const { makeFunctionReference } = require("convex/server");

const INDEX_NAME = "uetgpt-corpus-v1-qwen1024"; // convex/knowledgeStore/denseSearchAction.ts
const NAMESPACE = "corpus-v1-full";
const MAX_CHUNK_ROWS = 4000; // one deleteDocumentRowAndChunks mutation

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}
function loadEnv(path) {
  const out = {};
  for (const line of fs.readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  return out;
}

async function pinecone(apiKey, url, body) {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Api-Key": apiKey, "Content-Type": "application/json", "X-Pinecone-API-Version": "2025-04" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Pinecone ${url} -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function vectorIds(apiKey, host, documentId) {
  const r = await pinecone(apiKey, `https://${host}/query`, {
    namespace: NAMESPACE,
    vector: new Array(1024).fill(0),
    topK: 10000,
    filter: { documentId: { $eq: documentId } },
    includeMetadata: false,
    includeValues: false,
  });
  const ids = (r.matches ?? []).map((m) => m.id);
  if (ids.length >= 10000) throw new Error("10,000 matches: result may be truncated; aborting");
  return ids;
}

async function main() {
  const documentId = arg("--document-id");
  const expectPath = arg("--expect-path");
  const execute = process.argv.includes("--execute");
  if (!documentId || !expectPath) throw new Error("need --document-id and --expect-path");

  const prod = loadEnv(".env.vercel-production.local");
  const pineconeKey = loadEnv(".env.local").PINECONE_API_KEY;
  if (!prod.CONVEX_DEPLOY_KEY || !prod.NEXT_PUBLIC_CONVEX_URL || !pineconeKey) {
    throw new Error("missing CONVEX_DEPLOY_KEY, NEXT_PUBLIC_CONVEX_URL or PINECONE_API_KEY");
  }
  const convex = new ConvexHttpClient(prod.NEXT_PUBLIC_CONVEX_URL);
  convex.setAdminAuth(prod.CONVEX_DEPLOY_KEY);

  const rows = await convex.query(
    makeFunctionReference("knowledgeStore/convexMutations:listAllChunksForDocument"),
    { documentId },
  );
  if (rows.length > MAX_CHUNK_ROWS) throw new Error(`${rows.length} chunk rows exceeds ${MAX_CHUNK_ROWS}`);
  if (rows.length > 0) {
    const sample = await convex.query(
      makeFunctionReference("knowledgeStore/convexQueries:getChunkHitsByRagIds"),
      { ragIds: rows.slice(0, 3).map((r) => r.ragId) },
    );
    for (const hit of sample) {
      const path = hit?.text.match(/^URL Path: (\S+)/m)?.[1];
      if (path !== expectPath) throw new Error(`chunk URL Path ${path} does not match ${expectPath}; aborting`);
    }
  }

  const host = (await pinecone(pineconeKey, `https://api.pinecone.io/indexes/${INDEX_NAME}`)).host;
  const ids = await vectorIds(pineconeKey, host, documentId);
  console.log(`document ${documentId} (${expectPath}): ${rows.length} Convex chunk rows, ${ids.length} Pinecone vectors`);
  if (!execute) {
    console.log("dry run: nothing deleted (pass --execute to delete)");
    return;
  }

  for (let i = 0; i < ids.length; i += 1000) {
    await pinecone(pineconeKey, `https://${host}/vectors/delete`, { ids: ids.slice(i, i + 1000), namespace: NAMESPACE });
  }
  const deadline = Date.now() + 60_000;
  let remaining = await vectorIds(pineconeKey, host, documentId);
  while (remaining.length > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    remaining = await vectorIds(pineconeKey, host, documentId);
  }
  if (remaining.length > 0) throw new Error(`${remaining.length} vectors still present after 60s; Convex rows NOT deleted`);
  console.log(`Pinecone: deleted ${ids.length} vectors`);

  const deleted = await convex.mutation(
    makeFunctionReference("knowledgeStore/convexMutations:deleteDocumentRowAndChunks"),
    { documentId, chunkRowIds: rows.map((r) => r._id) },
  );
  const left = await convex.query(
    makeFunctionReference("knowledgeStore/convexMutations:listAllChunksForDocument"),
    { documentId },
  );
  console.log(`Convex: deleted ${deleted} chunk rows and the document row; ${left.length} chunk rows remain`);
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
