/**
 * Does removing the position term from the Tier-1 reranker change the answer for the better?
 *
 * Production's cascadeRerank never reaches a cross-encoder (no RERANKER_URL, no COHERE_API_KEY
 * on the prod deployment - checked by name via `npx convex env list`), so it always returns
 *
 *     score = overlapWeight x wordOverlap + positionWeight x (1 - i / poolSize)
 *
 * which re-injects the retrieval ordering the reranker exists to second-guess and floors the
 * rank-1 candidate at positionWeight (0.4). Audit F-1/F-4 are both consequences.
 *
 * The candidate change ("b") is: score = wordOverlap, with the incoming retrieval order kept
 * only as a tie-break.
 *
 * KEY POINT - this harness never recomputes wordOverlap, it INVERTS it:
 *
 *     overlap = (score - positionWeight x (1 - i / poolSize)) / overlapWeight
 *
 * `i` comes from matching each post-rerank candidate back to its pre-rerank position by
 * entryId, and poolSize is the pre-rerank pool. That matters because the only full-fidelity
 * chunk text available here is evalRetrieveDocuments' `contentExcerpt`, truncated to 500
 * chars; recomputing an overlap over truncated text would silently measure the wrong thing.
 * Inversion is exact and needs no text at all.
 *
 * Fidelity and its limits:
 *  - Reranks on the REWRITE, as production does, regenerated with production's CURRENT
 *    rewriteQueryAction system prompt and run through the real sanitizeRewrittenQuery.
 *    (scripts/eval/retrieval-ab/run.ts carries an older copy of that prompt - do not reuse it.)
 *  - evalRetrieveDocuments issues ONE search with that text; production fuses three channels
 *    (rewrite dense, HyDE dense, lexical). The candidate POOL therefore differs from a live
 *    request. What is being measured is the rerank of a production-shaped pool of 8, not
 *    end-to-end recall.
 *  - Rewrites are cached in rewrites.json so reruns cost no Gemini calls. Gemini, not Groq:
 *    Groq's free daily budget serves live traffic.
 *
 * Production reads: one searchDocumentsAction per query (~0.4 MB each per the 2026-09-18
 * audit's own accounting), so 10 queries is ~7% of the Convex Free plan I/O budget - the same
 * size of run the audit already budgeted for. Read-only: no mutations.
 *
 *   npx tsx scripts/eval/rerank-position/run.ts            # measure (hits production)
 *   npx tsx scripts/eval/rerank-position/run.ts --replay   # re-analyse frozen.json offline
 *   npx tsx scripts/eval/rerank-position/run.ts --faithful # production-faithful capture -> frozen.faithful.json
 *
 * --faithful also forwards `questionText` (the raw question, which gates the FAQ channel) and a
 * `hydeQuery` (which feeds the second dense channel), as retrieval.ts does. The default capture
 * omits both and so understates production, most of all for FAQ-answered queries. Combine with
 * --replay to re-analyse the faithful file. HyDE is generated on Gemini, never Groq.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { CASCADE_CONFIG, CRAG_CONFIG } from "../../../convex/rag/constants";
import { sanitizeRewrittenQuery } from "../../../convex/rag/routing";

const HERE = resolve(__dirname);
const ROOT = resolve(__dirname, "../../..");
const FAITHFUL = process.argv.includes("--faithful");
const OUT_AT = process.argv.indexOf("--out");
// --out <file> keeps a control capture from overwriting the committed baseline.
const FROZEN = resolve(
  HERE,
  OUT_AT !== -1 ? process.argv[OUT_AT + 1]! : FAITHFUL ? "frozen.faithful.json" : "frozen.json",
);
const REWRITES = resolve(HERE, "rewrites.json");
const HYDES = resolve(HERE, "hydes.json");
const REPLAY = process.argv.includes("--replay");

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.replace(/^"|"$/g, "");
  }
  return out;
}

// Verbatim from convex/rag/routing.ts:304 (rewriteQueryAction). Kept in sync by hand; the
// sanitizer below is imported from the real module rather than copied.
const REWRITE_SYSTEM =
  "You are a search expert. Rewrite the user's query into a short search query of at most 12 words. " +
  "If the query is written in Roman Urdu (Urdu language written using Latin/English characters, e.g., 'fees kitni hai', 'daakhila kab hoga', 'hostel kahan hai', 'documents kya chahiye'), detect it, translate it to English first, and then rewrite it into short English search terms. " +
  "Expand abbreviations like 'UET' to 'University of Engineering and Technology'. " +
  "Never add a year, date, or figure that the user did not write: the corpus spans many years and an invented year retrieves the wrong edition. " +
  "Output ONLY the rewritten query itself, in English: one short phrase, with no label, " +
  "no 'keywords:' prefix and no comma-separated list of synonyms. " +
  "Padding the query with synonyms makes the retrieval scoring worse, not better.";

// Verbatim from convex/rag/routing.ts (hydeQueryAction). Production feeds it the RAW question,
// in parallel with the rewrite (retrieval.ts:123). Not the production text-model chain, which
// leads with Groq: this runs on Gemini so an eval cannot spend the live bot's free-tier budget.
const HYDE_SYSTEM =
  "You are an expert on UET Taxila. Write a hypothetical, 3-5 sentence factual paragraph that directly answers the user's query. Pretend you are writing an official website excerpt. " +
  "Always write in English, whatever language the query uses: this paragraph is embedded and matched against an English-only corpus, and a Roman Urdu query was answered in Urdu and in Devanagari script (observed 2026-09-18).";

// The ten stratified queries of audit §3.2, so the numbers here sit beside a published table.
const QUERY_IDS = [
  "8fe9e8f2",
  "28c28a29",
  "0a5abd0e",
  "21ce9642",
  "9a07498d",
  "a670a78c",
  "26e87704",
  "f3d60458",
  "a694cc1c",
  "2dfb5097",
];

type Golden = {
  queryId: string;
  query: string;
  relevantChunkKeys: string[];
  groundTruth?: string;
  excludeFromScoring?: boolean;
};

function loadGolden(): Golden[] {
  const all = readFileSync(resolve(ROOT, "scripts/eval/golden_set_verified.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Golden);
  return QUERY_IDS.map((id) => {
    const g = all.find((r) => r.queryId.startsWith(id));
    if (!g) throw new Error(`golden query ${id} not found`);
    return g;
  });
}

// Label snippets, matched the way retrieval-ab does it: normalized 60-char containment
// against the labelled chunk text. Text truncation is fine HERE (snippets are taken from the
// head of the chunk); it is only overlap recomputation that truncation would corrupt.
function norm(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/[*_`#>|]/g, "")
    .trim()
    .toLowerCase();
}

function loadLabelSnippets(): Map<string, string> {
  const snippets = new Map<string, string>();
  for (const f of ["scripts/eval/label_review.md", "scripts/eval/delta_label_review.md"]) {
    const md = readFileSync(resolve(ROOT, f), "utf8");
    const re = /url: (\S+)\n(?:.*\n)*?\s*chunkKey: `([0-9a-f]+)`\n\s*text: (.+)/g;
    for (const m of md.matchAll(re)) {
      const body = m[3]!
        .replace(/^Document Title: .*? URL Path: \S+\s*/, "")
        .replace(/\.\.\.$/, "");
      const snip = norm(body).slice(0, 60);
      if (snip.length >= 25) snippets.set(m[2]!, snip);
    }
  }
  return snippets;
}

type Candidate = { entryId: string; url: string; relevanceScore: number; contentExcerpt: string };
type Frozen = {
  capturedAt: string;
  rows: Array<{
    queryId: string;
    query: string;
    rewrite: string;
    pre: Candidate[];
    post: Candidate[];
  }>;
};

async function capture(): Promise<Frozen> {
  const prodEnv = loadEnvFile(resolve(ROOT, ".env.vercel-production.local"));
  const client = new ConvexHttpClient(prodEnv.NEXT_PUBLIC_CONVEX_URL!);
  // setAdminAuth is not in ConvexHttpClient's public typings but is what the other prod-read
  // eval scripts in this repo use to authenticate with CONVEX_DEPLOY_KEY.
  (client as unknown as { setAdminAuth(key: string): void }).setAdminAuth(
    prodEnv.CONVEX_DEPLOY_KEY!,
  );
  const evalRetrieve = makeFunctionReference<"action">("rag/evalRetrieval:evalRetrieveDocuments");

  const gemini = createGoogleGenerativeAI({
    apiKey:
      process.env.GEMINI_API_KEY_2 ||
      process.env.GEMINI_API_KEY ||
      prodEnv.GEMINI_API_KEY_2 ||
      prodEnv.GEMINI_API_KEY,
  })("gemini-3.5-flash-lite");

  const cachedRewrites: Record<string, string> = existsSync(REWRITES)
    ? JSON.parse(readFileSync(REWRITES, "utf8"))
    : {};

  const cachedHydes: Record<string, string> = existsSync(HYDES)
    ? JSON.parse(readFileSync(HYDES, "utf8"))
    : {};

  const rows: Frozen["rows"] = [];
  for (const g of loadGolden()) {
    let rewrite = cachedRewrites[g.queryId];
    if (!rewrite) {
      await new Promise((r) => setTimeout(r, 4500)); // free tier: 15 req/min
      const { text } = await generateText({
        model: gemini,
        system: REWRITE_SYSTEM,
        prompt: g.query,
        temperature: 0.3,
        maxOutputTokens: 100,
        maxRetries: 2,
      });
      rewrite = sanitizeRewrittenQuery(text.trim(), g.query) || g.query;
      cachedRewrites[g.queryId] = rewrite;
      writeFileSync(REWRITES, JSON.stringify(cachedRewrites, null, 2));
    }

    let hyde: string | undefined;
    if (FAITHFUL) {
      hyde = cachedHydes[g.queryId];
      if (!hyde) {
        await new Promise((r) => setTimeout(r, 4500)); // free tier: 15 req/min
        const { text } = await generateText({
          model: gemini,
          system: HYDE_SYSTEM,
          prompt: g.query,
          temperature: 0.5,
          maxOutputTokens: 200,
          maxRetries: 2,
        });
        hyde = text.trim() || g.query;
        cachedHydes[g.queryId] = hyde;
        writeFileSync(HYDES, JSON.stringify(cachedHydes, null, 2));
      }
    }

    // rerankTopK 8 (not production's 4): we need every candidate's score to recover the
    // full distribution. The rerank itself is unchanged by asking for more of its output.
    const res = (await client.action(evalRetrieve, {
      queryText: rewrite,
      ...(FAITHFUL ? { questionText: g.query, hydeQuery: hyde } : {}),
      limit: 8,
      rerankTopK: 8,
    })) as { baselineAPreRerank: Candidate[]; baselineBPostRerank: Candidate[] };

    rows.push({
      queryId: g.queryId,
      query: g.query,
      rewrite,
      pre: res.baselineAPreRerank,
      post: res.baselineBPostRerank,
    });
    console.log(
      `  captured ${g.queryId.slice(0, 8)}  pool=${res.baselineAPreRerank.length}  "${rewrite}"`,
    );
  }
  return { capturedAt: new Date().toISOString(), rows };
}

function tierOf(topScore: number | null): string {
  if (topScore === null) return "refuse";
  if (topScore < 0.2) return "hedge(<0.2)";
  if (topScore < 0.4) return "hedge(<0.4)";
  if (topScore < 0.6) return "cite";
  return "normal";
}

function analyse(frozen: Frozen) {
  const snippets = loadLabelSnippets();
  const golden = loadGolden();
  const { overlapWeight, positionWeight } = CASCADE_CONFIG as unknown as {
    overlapWeight?: number;
    positionWeight?: number;
  };
  if (overlapWeight === undefined || positionWeight === undefined) {
    throw new Error(
      "CASCADE_CONFIG no longer carries overlapWeight/positionWeight, so frozen.json (captured " +
        `against the deployed formula on ${frozen.capturedAt}) can no longer be inverted. ` +
        "Re-capture against the deployed build, or read the committed analysis instead.",
    );
  }

  let tierChanged = 0;
  let top1Changed = 0;
  let recallOld = 0;
  let recallNew = 0;
  let scored = 0;
  const served: ServedRow[] = [];

  console.log(
    "\nquery            | old top | tier     | new top | tier     | top1 | recall@4 old->new",
  );
  console.log("-".repeat(96));

  for (const row of frozen.rows) {
    const g = golden.find((x) => x.queryId === row.queryId)!;
    const n = row.pre.length;
    const indexOf = new Map(row.pre.map((c, i) => [c.entryId, i]));

    const inverted = row.post.map((c) => {
      const i = indexOf.get(c.entryId);
      if (i === undefined) throw new Error(`post candidate ${c.entryId} absent from pre pool`);
      // Round: wordOverlap is shared/|queryWords|, a ratio of small integers, so genuine
      // gaps are at least 1/12 on these rewrites. Inverting in floating point leaves
      // ~1e-16 dust, and an unrounded comparison turns that dust into a ranking decision -
      // it made an early version of this harness report a spurious 7/10 -> 5/10 recall
      // drop that vanished entirely once the dust was removed.
      const raw = (c.relevanceScore - positionWeight * (1 - i / n)) / overlapWeight;
      return { ...c, i, overlap: Math.round(raw * 1e6) / 1e6 };
    });

    const oldOrder = [...inverted].sort((a, b) => b.relevanceScore - a.relevanceScore);
    // The candidate change: overlap alone, retrieval order only as a tie-break.
    const newOrder = [...inverted].sort((a, b) => b.overlap - a.overlap || a.i - b.i);

    const oldTop = oldOrder[0]?.relevanceScore ?? null;
    const newTop = newOrder[0]?.overlap ?? null;
    const oldTier = tierOf(oldTop);
    const newTier = tierOf(newTop);
    if (oldTier !== newTier) tierChanged++;
    const sameTop1 = oldOrder[0]?.entryId === newOrder[0]?.entryId;
    if (!sameTop1) top1Changed++;

    // recall@4 - only over queries with usable labels.
    const wanted = g.relevantChunkKeys.map((k) => snippets.get(k)).filter((s): s is string => !!s);
    let rOld = "-";
    let rNew = "-";
    if (wanted.length > 0 && !g.excludeFromScoring) {
      const hit = (list: typeof inverted) =>
        list.slice(0, 4).some((c) => wanted.some((w) => norm(c.contentExcerpt).includes(w)));
      const ho = hit(oldOrder);
      const hn = hit(newOrder);
      scored++;
      if (ho) recallOld++;
      if (hn) recallNew++;
      rOld = ho ? "HIT" : "miss";
      rNew = hn ? "HIT" : "miss";
    }

    // What production actually served: the deployed formula's order, top 4.
    served.push({
      queryId: row.queryId,
      top4: oldOrder.slice(0, 4),
      chunkHit: rOld === "HIT" ? true : rOld === "miss" ? false : null,
    });

    console.log(
      `${row.queryId.slice(0, 8)}${g.groundTruth === "contested" ? "*" : " "}        | ` +
        `${(oldTop ?? 0).toFixed(3)}   | ${oldTier.padEnd(8)} | ` +
        `${(newTop ?? 0).toFixed(3)}   | ${newTier.padEnd(8)} | ` +
        `${sameTop1 ? "same" : "MOVED"} | ${rOld} -> ${rNew}`,
    );
  }

  console.log("-".repeat(96));
  console.log(`* = golden label marked "contested"; its recall column is indicative only.`);

  sweep(frozen, snippets, golden, overlapWeight, positionWeight);
  console.log(`\ntier changed on        : ${tierChanged}/${frozen.rows.length} queries`);
  console.log(`top-1 chunk changed on : ${top1Changed}/${frozen.rows.length} queries`);
  console.log(
    `recall@4               : ${recallOld}/${scored} -> ${recallNew}/${scored} (labelled queries only)`,
  );
  faqCreditReport(served);
  console.log(
    `\nskipThreshold ${CRAG_CONFIG.skipThreshold}: a tier of "normal" also means CRAG is skipped ` +
      `(unless the query is high-impact, which forces it regardless).`,
  );
}

type ServedRow = {
  queryId: string;
  top4: Array<{ contentExcerpt: string }>;
  chunkHit: boolean | null;
};

/**
 * The chunk-label metric above cannot see the FAQ channel: an FAQ candidate carries a `faqs` id and
 * its own "FAQ: ... Answer: ..." rendering, so a correct FAQ answer never matches a chunk-text label
 * (audit section 17). This adds credit from scripts/eval/faq_labels_assistant_judged.json.
 *
 * Those labels are tier ASSISTANT_JUDGED_UNREVIEWED - not owner-verified - so treat the result as
 * provisional, prefer the clear-only line, and do not use it alone to justify a retrieval change.
 */
function faqCreditReport(served: ServedRow[]) {
  const file = JSON.parse(
    readFileSync(resolve(ROOT, "scripts/eval/faq_labels_assistant_judged.json"), "utf8"),
  ) as { labels: Array<{ queryId: string; faq: string; strength: "clear" | "partial" }> };
  const shows = (row: ServedRow, faq: string) =>
    row.top4.some((c) => norm(c.contentExcerpt).startsWith(norm(`FAQ: ${faq}`)));

  let denom = 0;
  let chunkOnly = 0;
  let withClear = 0;
  let withAny = 0;
  for (const row of served) {
    const mine = file.labels.filter((l) => l.queryId === row.queryId);
    if (row.chunkHit === null && mine.length === 0) continue; // nothing to score this query against
    denom++;
    const chunk = row.chunkHit === true;
    if (chunk) chunkOnly++;
    if (chunk || mine.some((l) => l.strength === "clear" && shows(row, l.faq))) withClear++;
    if (chunk || mine.some((l) => shows(row, l.faq))) withAny++;
  }
  console.log(
    "\nFAQ credit (audit section 17; labels are ASSISTANT_JUDGED_UNREVIEWED, so provisional):",
  );
  console.log(`  queries with a chunk label or an FAQ label : ${denom}`);
  console.log(`  recall@4, chunk labels only                : ${chunkOnly}/${denom}`);
  console.log(`  + FAQ credit, clear labels                 : ${withClear}/${denom}`);
  console.log(`  + FAQ credit, clear + partial labels       : ${withAny}/${denom}`);
}

/**
 * Does ANY weighting of (overlap, position) rank better than the retrieval order it is given?
 *
 * Free: pure re-analysis of the frozen capture, no further production reads. The "no rerank"
 * row is the one that matters - it is the null hypothesis the reranker has to beat.
 */
function sweep(
  frozen: Frozen,
  snippets: Map<string, string>,
  golden: Golden[],
  overlapWeight: number,
  positionWeight: number,
) {
  type Scored = { entryId: string; contentExcerpt: string; i: number; overlap: number };
  const rows = frozen.rows.map((row) => {
    const n = row.pre.length;
    const indexOf = new Map(row.pre.map((c, i) => [c.entryId, i]));
    const cands: Scored[] = row.post.map((c) => {
      const i = indexOf.get(c.entryId)!;
      const raw = (c.relevanceScore - positionWeight * (1 - i / n)) / overlapWeight;
      return {
        entryId: c.entryId,
        contentExcerpt: c.contentExcerpt,
        i,
        overlap: Math.round(raw * 1e6) / 1e6,
      };
    });
    const g = golden.find((x) => x.queryId === row.queryId)!;
    const wanted = g.relevantChunkKeys.map((k) => snippets.get(k)).filter((s): s is string => !!s);
    return {
      id: row.queryId.slice(0, 8),
      n,
      cands,
      wanted,
      scoreable: wanted.length > 0 && !g.excludeFromScoring,
    };
  });

  const variants: Array<[string, (c: Scored, n: number) => number]> = [
    ["no rerank at all (fused order)", (c) => -c.i],
    ["DEPLOYED 0.6*ov + 0.4*pos", (c, n) => 0.6 * c.overlap + 0.4 * (1 - c.i / n)],
    ["pure overlap, pos as tie-break", (c) => c.overlap],
    ["0.2*ov + 0.8*pos", (c, n) => 0.2 * c.overlap + 0.8 * (1 - c.i / n)],
    ["0.5*ov + 0.5*pos", (c, n) => 0.5 * c.overlap + 0.5 * (1 - c.i / n)],
    ["0.8*ov + 0.2*pos", (c, n) => 0.8 * c.overlap + 0.2 * (1 - c.i / n)],
    ["RRF position 60/(60+i)", (c) => 0.6 * c.overlap + 0.4 * (60 / (60 + c.i))],
  ];

  const recallAt = (k: number, rank: (c: Scored, n: number) => number) => {
    let hit = 0;
    let tot = 0;
    const per: string[] = [];
    for (const r of rows) {
      if (!r.scoreable) continue;
      tot++;
      const ordered = [...r.cands].sort((a, b) => rank(b, r.n) - rank(a, r.n) || a.i - b.i);
      const h = ordered
        .slice(0, k)
        .some((c) => r.wanted.some((w) => norm(c.contentExcerpt).includes(w)));
      if (h) hit++;
      per.push(h ? "H" : ".");
    }
    return { hit, tot, per: per.join("") };
  };

  // The TRUE null hypothesis: the fused retrieval order with NO rerank and NO
  // minWordOverlap filter. `post` is already filtered, so scoring over it would quietly
  // compare the reranker against itself. `pre` is the only untouched baseline here.
  const preRecallAt = (k: number) => {
    let hit = 0;
    let tot = 0;
    for (const row of frozen.rows) {
      const g = golden.find((x) => x.queryId === row.queryId)!;
      const wanted = g.relevantChunkKeys
        .map((key) => snippets.get(key))
        .filter((x): x is string => !!x);
      if (wanted.length === 0 || g.excludeFromScoring) continue;
      tot++;
      if (row.pre.slice(0, k).some((c) => wanted.some((w) => norm(c.contentExcerpt).includes(w)))) {
        hit++;
      }
    }
    return { hit, tot };
  };

  console.log("\n--- Does any (overlap, position) weighting beat the order it was handed? ---");
  console.log("variant                        | recall@3 | recall@4 | pattern@4");
  console.log("-".repeat(70));
  const preNull3 = preRecallAt(3);
  const preNull4 = preRecallAt(4);
  console.log(
    `${"NULL: unfiltered fused order".padEnd(30)} | ${preNull3.hit}/${preNull3.tot}     | ${preNull4.hit}/${preNull4.tot}     | (no rerank, no filter)`,
  );
  for (const [name, fn] of variants) {
    const r3 = recallAt(3, fn);
    const r4 = recallAt(4, fn);
    console.log(
      `${name.padEnd(30)} | ${r3.hit}/${r3.tot}     | ${r4.hit}/${r4.tot}     | ${r4.per}`,
    );
  }

  // Headroom: if the answer is in the pool at all, is it already inside the top 4? Where
  // this is zero, no reranking formula whatsoever can raise recall@4 - it can only lower it.
  const inPool = preRecallAt(8);
  console.log(
    `\nHeadroom for ANY reranker = recall@8(${inPool.hit}/${inPool.tot}) - recall@4(${preNull4.hit}/${preNull4.tot}) = ` +
      `${inPool.hit - preNull4.hit}/${inPool.tot}`,
  );
  if (inPool.hit === preNull4.hit) {
    console.log(
      "  => ZERO headroom on this query set. Every relevant chunk that reaches the pool is\n" +
        "     already in the top 4 before reranking. The misses are RETRIEVAL misses: the\n" +
        "     answer never entered the candidate pool. Reranking is not the accuracy lever here.",
    );
  }

  console.log("\nInverted overlap per candidate, in fused-retrieval order:");
  for (const r of rows) {
    const distinct = new Set(r.cands.map((c) => c.overlap)).size;
    const os = [...r.cands]
      .sort((a, b) => a.i - b.i)
      .map((c) => c.overlap.toFixed(2))
      .join(" ");
    console.log(`  ${r.id}  ${String(distinct).padStart(2)} distinct of ${r.cands.length}: ${os}`);
  }
}

async function main() {
  let frozen: Frozen;
  if (REPLAY) {
    if (!existsSync(FROZEN)) throw new Error(`--replay needs ${FROZEN}; run without it first.`);
    frozen = JSON.parse(readFileSync(FROZEN, "utf8"));
    console.log(`Replaying frozen capture from ${frozen.capturedAt}`);
  } else {
    console.log("Capturing from PRODUCTION (read-only, ~10 searchDocumentsAction calls)...");
    frozen = await capture();
    writeFileSync(FROZEN, JSON.stringify(frozen, null, 2));
    console.log(`\nFroze ${frozen.rows.length} rows to ${FROZEN}`);
  }
  analyse(frozen);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
