#!/usr/bin/env node
/**
 * Post-deploy check for the retrieval accuracy fixes on branch accuracy-io-lifecycle
 * (bb533d1 content-word reranking, d543fb9 "technology" expansion, 7041ea1 rewriter
 * sanitizer + HyDE English pin).
 *
 *   node scripts/eval/verify_retrieval_fixes.cjs
 *
 * Costs roughly 2 MB of Database I/O (5 searches); the rewriter and HyDE checks
 * are LLM calls only and cost none. Reads credentials from
 * .env.vercel-production.local and never prints them.
 */
const fs = require("node:fs");
const { ConvexHttpClient } = require("convex/browser");
const { makeFunctionReference } = require("convex/server");

const env = {};
for (const line of fs.readFileSync(".env.vercel-production.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL, { logger: false });
convex.setAdminAuth(env.CONVEX_DEPLOY_KEY);

// Each question paired with the text that proves the right passage reached the answer.
const SEARCHES = [
  ["What is the fee structure for BS Software Engineering at UET Taxila?", /104,?800/],
  ["What are the eligibility criteria for admission to BS Computer Science at UET Taxila?", /50%/],
  ["Can I freeze my semester at UET Taxila and what is the procedure?", /freez/i],
  ["Is there a fine for late fee submission at UET Taxila?", /100\/-\s*per day|fine/i],
  ["Who is the Vice Chancellor of UET Taxila?", /vice[\s-]?chancellor/i],
];
// Rewrites that used to come back carrying a year nobody asked for.
const YEAR_QUERIES = [
  "When is the last date to apply for admission at UET Taxila?",
  "When will the merit list be announced at UET Taxila?",
  "When does the semester start at UET Taxila?",
  "What is the entry test date for UET Taxila?",
  "What is the hostel fee at UET Taxila?",
];
// HyDE answered these in Urdu and Devanagari script before the English pin.
const URDU_QUERIES = [
  "chuttiyan kab hongi UET Taxila mein?",
  "daakhila ki akhri tarikh kab hai UET Taxila mein?",
];

const short = (u) => u.replace(/^https?:\/\/[^/]+/, "").slice(0, 54);
let failures = 0;

async function checkSearches() {
  console.log("== retrieval: does the answering passage reach the final 4? ==");
  for (const [question, evidence] of SEARCHES) {
    const candidates = await convex.action(
      makeFunctionReference("embeddings/search:searchDocumentsAction"),
      { queryText: question, questionText: question, limit: 8 },
    );
    const ranked = await convex.action(makeFunctionReference("reranking/cascade:cascadeRerank"), {
      query: question,
      documents: candidates.map((c) => ({ id: c.entryId, text: c.content })),
      topK: 4,
    });
    const final = ranked.map((r) => candidates[r.index]).filter(Boolean);
    const hit = final.findIndex((c) => evidence.test(c.content));
    if (hit < 0) failures++;
    console.log(`\n  ${hit >= 0 ? `PASS (rank ${hit + 1})` : "FAIL"}  ${question}`);
    for (const c of final) {
      console.log(`      ${c.content.startsWith("FAQ: ") ? "[FAQ]" : "     "} ${short(c.url)}`);
    }
  }
}

async function checkRewriter() {
  console.log("\n== rewriter: no year the user never wrote ==");
  for (const q of YEAR_QUERIES) {
    const out = await convex.action(makeFunctionReference("rag/routing:rewriteQueryAction"), {
      query: q,
    });
    const invented = (out.match(/\b(?:19|20)\d{2}\b/g) ?? []).filter((y) => !q.includes(y));
    const leaked = /<\|/.test(out);
    if (invented.length || leaked) failures++;
    console.log(
      `  ${invented.length || leaked ? `FAIL (${invented.join(" ")}${leaked ? " <|token|>" : ""})` : "PASS"}  ${out}`,
    );
  }
}

async function checkHyde() {
  console.log("\n== HyDE: written in English ==");
  for (const q of URDU_QUERIES) {
    const out = await convex.action(makeFunctionReference("rag/routing:hydeQueryAction"), {
      query: q,
    });
    // Urdu/Arabic and Devanagari blocks; the corpus is English only.
    const nonLatin = /[؀-ۿऀ-ॿ]/.test(out);
    if (nonLatin) failures++;
    console.log(`  ${nonLatin ? "FAIL (non-Latin script)" : "PASS"}  ${out.slice(0, 90)}`);
  }
}

(async () => {
  await checkSearches();
  await checkRewriter();
  await checkHyde();
  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error(String(err.message || err).slice(0, 400));
  process.exit(1);
});
