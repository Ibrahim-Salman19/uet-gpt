#!/usr/bin/env node
/**
 * Post-deploy check for the retrieval accuracy fixes on branch accuracy-io-lifecycle
 * (bb533d1 content-word reranking, d543fb9 "technology" expansion, 7041ea1 rewriter
 * sanitizer + HyDE English pin).
 *
 *   node scripts/eval/verify_retrieval_fixes.cjs
 *
 * Costs roughly 2 MB of Database I/O (5 searches). The LLM calls are the expensive
 * part and they are GROQ-PRIMARY: roughly 17 before, plus one CRAG judge per
 * high-impact question now that rag/retrieval.ts forces the judge on those. Groq's
 * free daily budget for the answer model was exhausted once (2026-09-15) and
 * rate-limited the live chatbot for ~24h, so do not run this in a loop. Reads
 * credentials from .env.vercel-production.local and never prints them.
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

// Each question paired with the evidence that the right passage reached the answer:
// a RegExp is tested against the chunk's text, a function against the whole chunk.
//
// This gate asserts RETRIEVAL, not a fact. It used to assert /104,?800/ on the fee
// question and passed *because* retrieval surfaced that figure - but the figure is
// UNCONFIRMED: it matches none of the five official First-Semester totals in the three
// real Prospectus editions (2023: 97,000/251,000, 2024: 94,000/249,000, 2025:
// 101,800/256,800), and FAQS.php hedges it with "Exact fee is mentioned in the
// prospectus". Correcting the corpus would have turned this check red. Assert that an
// UNDERGRADUATE fee source was retrieved instead, and let the number be whatever the
// source says.
const isUndergradFeeSource = (c) =>
  /FAQS\.php|prospectus|fee[-_ ]?structure/i.test(c.url) && !/PG-fee|phd|m\.?sc/i.test(c.url);

const SEARCHES = [
  ["What is the fee structure for BS Software Engineering at UET Taxila?", isUndergradFeeSource],
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

// rag/retrieval.ts forces the CRAG judge whenever classifyQueryRisk() returns "high",
// i.e. when the question contains a HIGH_IMPACT_KEYWORDS term. This gate has to take
// the same branch production does, so the list is READ FROM THE SOURCE rather than
// copied - a hand-maintained duplicate had already drifted by 5 keywords. If the
// declaration is ever reshaped this throws loudly, which is the correct failure mode
// for a gate whose whole job is to mirror production.
function loadHighImpactKeywords() {
  const src = fs.readFileSync("convex/shared/freshnessPolicy.ts", "utf8");
  const decl = src.indexOf("export const HIGH_IMPACT_KEYWORDS");
  if (decl < 0) throw new Error("HIGH_IMPACT_KEYWORDS not found in convex/shared/freshnessPolicy.ts");
  const open = src.indexOf("= [", decl);
  const close = src.indexOf("];", open);
  const keywords = [...src.slice(open, close).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (keywords.length === 0) throw new Error("HIGH_IMPACT_KEYWORDS parsed as empty - check its shape");
  return keywords;
}
const HIGH_IMPACT = loadHighImpactKeywords();
const isHighImpact = (q) => HIGH_IMPACT.some((k) => q.toLowerCase().includes(k));

const short = (u) => u.replace(/^https?:\/\/[^/]+/, "").slice(0, 54);
let failures = 0;

async function checkSearches() {
  console.log("== retrieval: does the answering passage reach the final 4? ==");
  console.log("   live shape: retrieval and reranking run on the REWRITTEN query, which is");
  console.log("   what rag/retrieval.ts passes (searchVectorDB queryText, rerankSearchResults");
  console.log("   query) - measuring with the raw question tests a path production never takes.");
  for (const [question, evidence] of SEARCHES) {
    const rewritten =
      (await convex.action(makeFunctionReference("rag/routing:rewriteQueryAction"), {
        query: question,
      })) || question;
    const hydeQuery = await convex.action(makeFunctionReference("rag/routing:hydeQueryAction"), {
      query: question,
    });
    const candidates = await convex.action(
      makeFunctionReference("embeddings/search:searchDocumentsAction"),
      { queryText: rewritten, hydeQuery, questionText: question, limit: 8 },
    );
    const ranked = await convex.action(makeFunctionReference("reranking/cascade:cascadeRerank"), {
      query: rewritten,
      documents: candidates.map((c) => ({ id: c.entryId, text: c.content })),
      topK: 4,
    });
    const final = ranked.map((r) => candidates[r.index]).filter(Boolean);
    const hit = final.findIndex((c) =>
      typeof evidence === "function" ? evidence(c) : evidence.test(c.content),
    );
    // F-1: postgraduate fee tables outranking the undergraduate answer is a real
    // defect even when the answer still reaches the final 4. Surfaced, not failed -
    // the ordering fix is CRAG-side and this gate measures retrieval reach.
    const pgAbove = final.findIndex((c) => /PG-fee|phd|m\.?sc/i.test(c.url));
    if (pgAbove >= 0 && hit >= 0 && pgAbove < hit) {
      console.log("      WARN postgraduate fee source outranks the undergraduate answer");
    }
    // Under CRAG_CONFIG.skipThreshold the CRAG judge runs and can override the tier
    // to "refuse", which makes the bot emit the fixed "no verified information" line
    // even when the answering passage did reach the final 4.
    const topScore = ranked.length > 0 ? ranked[0].score : 0;
    // Mirror rag/retrieval.ts exactly. CRAG runs when the top score is below
    // CRAG_CONFIG.skipThreshold OR the query is high-impact (fees, deadlines, merit),
    // where it is forced regardless of score so a confidently-wrong top hit still gets
    // judged. CRAG *running* is not a failure: the Tier-1 word-overlap scale is not
    // calibrated to the 0.6 threshold, so a correct answer routinely sits below it
    // (measured 0.550 with 4/4 relevant). Only an actual refusal fails.
    const forced = isHighImpact(question);
    let verdict = "CRAG skipped (>= 0.6, not high-impact)";
    let refuses = false;
    if ((topScore < 0.6 || forced) && final.length > 0) {
      const ev = await convex.action(makeFunctionReference("rag/crag:evaluateChunks"), {
        query: question,
        chunks: final.map((c, i) => ({ text: c.content, index: i })),
      });
      const survivors = final.filter((_, i) => {
        const f = ev.find((x) => x.index === i);
        return f ? f.relevant : true;
      });
      const allIrrelevant = ev.length > 0 && ev.every((x) => !x.relevant && x.confidence > 0.7);
      // allIrrelevant always refuses. No survivors WITHOUT allIrrelevant refuses only
      // when the run was not forced: a forced run hedges on the least-rejected chunk
      // (demoteInsteadOfRefuse) rather than emitting the refusal string.
      refuses = allIrrelevant || (survivors.length === 0 && !forced);
      verdict =
        `CRAG ${forced ? "forced" : "ran"}, ${survivors.length}/${final.length} survived` +
        (survivors.length === 0 && !allIrrelevant && forced ? " -> hedged on least-rejected" : "");
    }
    if (hit < 0 || refuses) failures++;
    const label = refuses
      ? "FAIL (bot refuses)"
      : hit >= 0
        ? `PASS (rank ${hit + 1})`
        : "FAIL (answer passage absent)";
    console.log(`\n  ${label}  ${question}`);
    console.log(`      rewritten: ${rewritten.slice(0, 130)}`);
    console.log(`      topScore ${topScore.toFixed(3)} - ${verdict}`);
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
