/**
 * Set documents.lifecycleStatus on one PRODUCTION document. Search skips documents whose
 * lifecycleStatus is set and not "active", so "superseded" retires an old edition without deleting
 * its chunks or Pinecone vectors, and "active" restores it.
 *
 *   node scripts/set_document_lifecycle.cjs --document-id <id> --expect-url-suffix <path> --status superseded
 *
 * The mutation refuses to patch unless the document URL ends with --expect-url-suffix.
 * Credentials: CONVEX_DEPLOY_KEY / NEXT_PUBLIC_CONVEX_URL from .env.vercel-production.local.
 */
const fs = require("node:fs");
const { ConvexHttpClient } = require("convex/browser");
const { makeFunctionReference } = require("convex/server");

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

async function main() {
  const documentId = arg("--document-id");
  const expectUrlSuffix = arg("--expect-url-suffix");
  const lifecycleStatus = arg("--status");
  if (!documentId || !expectUrlSuffix || !lifecycleStatus) {
    throw new Error("need --document-id, --expect-url-suffix and --status");
  }
  const prod = loadEnv(".env.vercel-production.local");
  if (!prod.CONVEX_DEPLOY_KEY || !prod.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error("missing CONVEX_DEPLOY_KEY or NEXT_PUBLIC_CONVEX_URL");
  }
  const convex = new ConvexHttpClient(prod.NEXT_PUBLIC_CONVEX_URL);
  convex.setAdminAuth(prod.CONVEX_DEPLOY_KEY);
  const r = await convex.mutation(makeFunctionReference("crawl/staleness:setDocumentLifecycleStatus"), {
    documentId,
    lifecycleStatus,
    expectUrlSuffix,
  });
  console.log(`${r.url}: lifecycleStatus ${r.previous ?? "(unset)"} -> ${lifecycleStatus}`);
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
