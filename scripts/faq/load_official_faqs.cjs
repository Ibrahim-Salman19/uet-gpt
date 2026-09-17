/**
 * Load the official UET FAQ pages' question/answer pairs (scripts/faq/official-faqs.json)
 * into the PRODUCTION faqs table, which embeddings/search.ts merges into retrieval when a
 * FAQ's question matches what the user asked. Re-running replaces the entries of each
 * source page instead of duplicating them.
 *
 *   node scripts/faq/load_official_faqs.cjs [--dry-run]
 *
 * Credentials: CONVEX_DEPLOY_KEY / NEXT_PUBLIC_CONVEX_URL from .env.vercel-production.local.
 */
const fs = require("node:fs");
const { ConvexHttpClient } = require("convex/browser");
const { makeFunctionReference } = require("convex/server");

function loadEnv(path) {
  const out = {};
  for (const line of fs.readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  return out;
}

async function main() {
  const faqs = JSON.parse(fs.readFileSync("scripts/faq/official-faqs.json", "utf8"));
  const bySource = new Map();
  for (const faq of faqs) {
    if (!bySource.has(faq.sourceUrl)) bySource.set(faq.sourceUrl, []);
    bySource.get(faq.sourceUrl).push({ question: faq.question, answer: faq.answer });
  }
  for (const [sourceUrl, entries] of bySource) {
    console.log(`${sourceUrl}: ${entries.length} entries`);
  }
  if (process.argv.includes("--dry-run")) {
    console.log("dry run: nothing written");
    return;
  }

  const prod = loadEnv(".env.vercel-production.local");
  if (!prod.CONVEX_DEPLOY_KEY || !prod.NEXT_PUBLIC_CONVEX_URL) {
    throw new Error("missing CONVEX_DEPLOY_KEY or NEXT_PUBLIC_CONVEX_URL");
  }
  const convex = new ConvexHttpClient(prod.NEXT_PUBLIC_CONVEX_URL);
  convex.setAdminAuth(prod.CONVEX_DEPLOY_KEY);
  for (const [sourceUrl, entries] of bySource) {
    const r = await convex.mutation(makeFunctionReference("faq:replaceFaqsForSource"), {
      sourceUrl,
      entries,
    });
    console.log(`${sourceUrl}: removed ${r.removed}, inserted ${r.inserted}`);
  }
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
