/**
 * Retrieval A/B over the verified golden set, against the live production corpus (read-only).
 *
 * Calls each production retrieval channel directly (Pinecone dense via Cloudflare query
 * embedding, BM25 over crawledChunks.search_text, BM25 over contextualizedText) with admin
 * auth, then fuses locally with the real hybridRank/estimateIdf to compare which query text
 * each channel should receive. Doc-status/freshness filtering, FAQ merge, rerank, and CRAG
 * are NOT applied: the metric is whether a labelled-relevant chunk reaches the 8 fused
 * candidates that retrieval.ts hands to the reranker.
 *
 * Rewrites and HyDE paragraphs are generated once with the production prompts on Gemini
 * (gemini-3.5-flash-lite; production uses Groq gpt-oss-20b, whose quota serves live traffic)
 * and cached in the scratch file, so reruns make no LLM calls.
 *
 * WARNING: authenticates as ADMIN against PRODUCTION (CONVEX_DEPLOY_KEY from
 * .env.vercel-production.local). It only calls read queries and the dense-search/embedding
 * actions, but admin auth can call any internal function - review changes before running.
 * Each query costs 3 Cloudflare embeddings + 3 Pinecone queries on the production accounts.
 *
 * Golden-label pool bias: label_review.md candidates were dense (cosine) neighbours of the raw
 * question, so recall for "dense on the raw question" is inflated relative to other variants.
 * Recall here is an upper bound: live retrieval also applies rerank (top 4), CRAG, and
 * freshness filtering, and its rewrite/HyDE text is sampled per request.
 *
 *   npx tsx scripts/eval/retrieval-ab/run.ts --cache <queries.json> --out <results.json> [--inspect]
 *     [--rerank]  (also recall@4 after the production word-overlap cascade vs Cloudflare bge-reranker-base)
 *     [--budget]  (recall after the topK cut + buildContext char budget, for k 4/5/6/8 and maxTokens
 *                  3000/4500/6000; base vs nav-chunk demotion vs near-duplicate removal) [--dump-text]
 *     [--answers]  (end-to-end answers for queries in answerRubrics.ts: pre-8cf42e2 retrieval vs current,
 *                   answered and rubric-graded by Gemini; ~4 Gemini calls per query)
 *                 newestEdition row: older-year copies of the same URL family dropped before the cut to 8;
 *                 dedupeNav row: deployed order with bare-navigation-link chunks moved behind the rest;
 *                 lexQ/lexQchunk rows (with --lex-question): extra lexical channel on the raw question;
 *                 fusedOrder row: no rerank; tier1Local8/cosine8/cosine24: local Tier 1, raw vs length-normalised; pool16/pool24 rows: the reranker gets 16/24 deduplicated candidates instead of 8
 *     [--answers-newest]  (with --answers: current retrieval vs older editions dropped)
 *     [--answers-k6]  (with --answers: current retrieval, reranker keeps 4 vs 6 chunks)
 *     [--rerank-rows cohere_q24,cf_rw24,...]  (with --budget: Cohere rerank-v4.0-fast or Cloudflare bge-reranker-base
 *                  called directly on the deduplicated 8/24 pool with the raw question (q) or the rewrite (rw);
 *                  scores logged per query)
 *     [--answers-rerank cohere_q24]  (with --answers: current retrieval vs that row's top 4; ~1 reranker call per rubric query)
 *     [--cohere-cache <file>]  (Cohere responses by query+documents; trial keys: 10 calls/min, 1,000/month)
 *     [--temps 0,0]  (rewrite,HyDE temperatures; use a separate --cache file per setting/sample)
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { config as loadEnv } from "dotenv";
import { hybridRank } from "../../../convex/embeddings/hybridRank";
import { estimateIdf } from "../../../convex/embeddings/idf";
import { dropNearDuplicates } from "../../../convex/embeddings/nearDuplicates";
import { buildContext } from "../../../convex/rag/context";
import { buildSystemPrompt } from "../../../src/lib/prompt";
import { ANSWER_RUBRICS } from "./answerRubrics";
import { candidateLimit } from "../../../convex/shared/freshnessPolicy";

const ROOT = resolve(__dirname, "../../..");
loadEnv({ path: resolve(ROOT, ".env.local"), quiet: true });
const prodEnv = loadEnvFile(resolve(ROOT, ".env.vercel-production.local"));

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.replace(/^"|"$/g, "");
  }
  return out;
}

const RRF_K = 60;
const FINAL_K = 8;

// ---- Golden set: relevant chunk -> (url path, text snippet) ------------------------------

type Label = { path: string; snippet: string };

function norm(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/[*_`#>|]/g, "")
    .trim()
    .toLowerCase();
}

function loadLabels(): Map<string, Label> {
  const labels = new Map<string, Label>();
  for (const f of ["scripts/eval/label_review.md", "scripts/eval/delta_label_review.md"]) {
    const md = readFileSync(resolve(ROOT, f), "utf8");
    const re = /url: (\S+)\n(?:.*\n)*?\s*chunkKey: `([0-9a-f]+)`\n\s*text: (.+)/g;
    for (const m of md.matchAll(re)) {
      const [, path, key, text] = m;
      // Drop the "Document Title: ... URL Path: <path>" prefix the labelling pipeline added.
      const body = text!
        .replace(/^Document Title: .*? URL Path: \S+\s*/, "")
        .replace(/\.\.\.$/, "");
      const snippet = norm(body).slice(0, 60);
      if (snippet.length >= 25) labels.set(key!, { path: path!, snippet });
    }
  }
  return labels;
}

type Golden = {
  queryId: string;
  query: string;
  relevantChunkKeys: string[];
  /** "contested" = the labels rest on provenance the project has since downgraded. */
  groundTruth?: string;
  /** Labels known to be wrong; grading against them measures nothing. */
  excludeFromScoring?: boolean;
};

// ---- Query enrichment (production prompts) ----------------------------------------------

const REWRITE_SYSTEM =
  "You are a search expert. Rewrite the user's query to be a concise keyword-rich search query. " +
  "If the query is written in Roman Urdu (Urdu language written using Latin/English characters, e.g., 'fees kitni hai', 'daakhila kab hoga', 'hostel kahan hai', 'documents kya chahiye'), detect it, translate it to English first, and then rewrite it into keyword-rich English search terms. " +
  "Expand abbreviations like 'UET' to 'University of Engineering and Technology'. " +
  "Output ONLY the final rewritten keyword-rich search query in English, and absolutely nothing else.";
const HYDE_SYSTEM =
  "You are an expert on UET Taxila. Write a hypothetical, 3-5 sentence factual paragraph that directly answers the user's query. Pretend you are writing an official website excerpt.";

const gemini = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY,
})("gemini-3.5-flash-lite");

// --temps <rewrite>,<hyde> overrides the production sampling temperatures (0.3,0.5).
const argTemps = process.argv.includes("--temps")
  ? process.argv[process.argv.indexOf("--temps") + 1]!.split(",").map(Number)
  : [0.3, 0.5];

// Sequential, paced calls: the free Gemini tier allows 15 requests/minute per key.
async function generatePaced(system: string, prompt: string, temperature: number, max: number) {
  for (let attempt = 0; ; attempt++) {
    try {
      await new Promise((r) => setTimeout(r, 4500));
      const { text } = await generateText({
        model: gemini,
        system,
        prompt,
        temperature,
        maxOutputTokens: max,
        maxRetries: 0,
      });
      return text.trim() || prompt;
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, 60_000));
    }
  }
}

async function enrich(query: string) {
  const rewrite = await generatePaced(REWRITE_SYSTEM, query, argTemps[0]!, 100);
  const hyde = await generatePaced(HYDE_SYSTEM, query, argTemps[1]!, 200);
  return { rewrite, hyde };
}

// ---- Production channels ----------------------------------------------------------------

const client = new ConvexHttpClient(prodEnv.NEXT_PUBLIC_CONVEX_URL!);
(client as unknown as { setAdminAuth: (t: string) => void }).setAdminAuth(
  prodEnv.CONVEX_DEPLOY_KEY!,
);

const fullTextSearch = makeFunctionReference<"query">("crawl/queries:fullTextSearch");
const contextualized = makeFunctionReference<"query">(
  "embeddings/chunkTextSearch:runContextualized",
);
const cfEmbed = makeFunctionReference<"action">("embeddings/cloudflareEmbed:cloudflareEmbedQuery");
const denseSearch = makeFunctionReference<"action">("knowledgeStore/denseSearchAction:denseSearch");
const refsToRag = makeFunctionReference<"query">(
  "knowledgeStore/convexQueries:getRagIdAndTextByChunkRefs",
);

const cascadeRerank = makeFunctionReference<"action">("reranking/cascade:cascadeRerank");
const cloudflareRerank = makeFunctionReference<"action">(
  "reranking/cloudflareRerank:cloudflareRerank",
);

// hybridRank fuses by rank only; score is carried to satisfy its input type.
type Hit = { id: string; text: string; url: string; score: number };

// Approximate length of formatChunkHeader's Section/Source/Retrieved/Freshness lines.
const CONTEXT_HEADER_CHARS = 220;

// Convex internal; see scripts/eval/answer-accuracy/run.ts for the same unsupported access.
const buildContextHandler = (buildContext as unknown as { _handler: Function })._handler;

const NAV_LINK_SHARE = 0.6;
const LINK_LINE = /^\s*- \[.*\]\(<?https?:\/\//;

// Share of a chunk's non-empty lines that are bare markdown link list items.
function linkShare(text: string): number {
  const lines = text.split("\n").filter((l) => l.trim());
  return lines.length ? lines.filter((l) => LINK_LINE.test(l)).length / lines.length : 0;
}

// Bare navigation link: short anchor text, no crawler-appended " — description", nothing after the
// link but an optional (pdf)/(image)/(video) tag. Lines that carry facts after the link (staff
// "— Name, Email, Ph" image captions, dated notice titles) are not counted.
const NAV_LINE = /^\s*- \[[^\]—]{0,60}\]\(<?https?:\/\/[^)\s]*>?\)\s*(\((pdf|image|video)\))?\s*$/;
function navShare(text: string): number {
  const lines = text.split("\n").filter((l) => l.trim());
  return lines.length ? lines.filter((l) => NAV_LINE.test(l)).length / lines.length : 0;
}

// Superseded editions: among candidates whose URL paths differ only in a 4-digit year
// (UET-Prospectus-2024.pdf vs UET-Prospectus-2025.pdf), keep only the newest year.
const YEAR = /(?<!\d)(?:19|20)\d{2}(?!\d)/g;
function editionPath(h: Hit): string {
  const raw = h.text.match(/^URL Path: (\S+)/m)?.[1] ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
function dropOlderEditions(hits: Hit[]): Hit[] {
  const newest = new Map<string, number>();
  for (const h of hits) {
    const years = editionPath(h).match(YEAR);
    if (!years) continue;
    const family = editionPath(h).replace(YEAR, "YYYY");
    newest.set(family, Math.max(newest.get(family) ?? 0, Math.max(...years.map(Number))));
  }
  return hits.filter((h) => {
    const years = editionPath(h).match(YEAR);
    if (!years) return true;
    return Math.max(...years.map(Number)) >= newest.get(editionPath(h).replace(YEAR, "YYYY"))!;
  });
}

// Top-4 after reranking the fused top-8 (retrieval.ts passes topK 4 to the LLM context).
function rerankTop4(fn: typeof cascadeRerank, query: string, hits: Hit[]): Promise<Hit[]> {
  return rerankTopK(fn, query, hits, 4);
}

async function rerankTopK(
  fn: typeof cascadeRerank,
  query: string,
  hits: Hit[],
  topK: number,
): Promise<Hit[]> {
  if (hits.length === 0) return [];
  const out = (await retry(() =>
    client.action(fn, {
      query,
      documents: hits.map((h) => ({ id: h.id, text: h.text })),
      topK,
    }),
  )) as Array<{ index: number }>;
  return out.filter((r) => r.index >= 0 && r.index < hits.length).map((r) => hits[r.index]!);
}

async function retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
}

async function lexical(text: string, limit: number) {
  const [fts, ctxd] = await Promise.all([
    retry(() => client.query(fullTextSearch, { query: text, limit })) as Promise<
      Array<{ ragId: string; text: string; url: string }>
    >,
    retry(() =>
      client.query(contextualized, { query: text, limit: Math.min(20, limit) }),
    ) as Promise<Array<{ ragId: string; text: string; url: string }>>,
  ]);
  return {
    text: fts.map((r) => ({ id: r.ragId, text: r.text, url: r.url, score: 0 })),
    chunk: fts
      .slice(0, Math.min(20, limit))
      .map((r) => ({ id: r.ragId, text: r.text, url: r.url, score: 0 })),
    ctx: ctxd.map((r) => ({ id: r.ragId, text: r.text, url: r.url, score: 0 })),
  };
}

async function dense(text: string, limit: number): Promise<Hit[]> {
  // cloudflareEmbedQuery returns null on a timeout; retry so a transient failure doesn't
  // silently score a query with an empty dense channel.
  const emb = (await retry(async () => {
    const e = (await client.action(cfEmbed, { text })) as number[] | null;
    if (!e) throw new Error("cloudflareEmbedQuery returned null");
    return e;
  })) as number[];
  const hits = (await retry(() =>
    client.action(denseSearch, { queryEmbedding: emb, topK: limit }),
  )) as Array<{
    documentId: string;
    chunkKey: string;
  }>;
  const resolved = (await retry(() =>
    client.query(refsToRag, {
      refs: hits.map((h) => ({ documentId: h.documentId, chunkKey: h.chunkKey })),
    }),
  )) as Array<{ ragId: string | null; text: string | null }>;
  const seen = new Set<string>();
  const out: Hit[] = [];
  resolved.forEach((r) => {
    if (!r.ragId || r.text === null || seen.has(r.text)) return; // search.ts dedups by text
    seen.add(r.text);
    out.push({ id: r.ragId, text: r.text, url: "", score: 0 });
  });
  return out;
}

// Local copy of cascade.ts Tier 1 (word overlap 0.6 + position 0.4, overlap >= 0.1 filter).
// "cosine" divides the shared-word count by sqrt(|query words| * |chunk words|) instead of
// |query words| alone, so long link manifests stop accumulating overlap for free; scores are
// rescaled by the pool maximum to keep the 0.6/0.4 blend comparable.
function tier1Words(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean));
}
function tier1Local(query: string, hits: Hit[], k: number, cosine: boolean): Hit[] {
  const q = tier1Words(query);
  const scored = hits.map((h, i) => {
    const c = tier1Words(h.text);
    let shared = 0;
    for (const w of q) if (c.has(w)) shared++;
    const overlap = q.size && c.size ? shared / q.size : 0;
    const norm = q.size && c.size ? shared / Math.sqrt(q.size * c.size) : 0;
    return { h, i, overlap, norm };
  });
  const maxNorm = Math.max(1e-9, ...scored.map((d) => d.norm));
  const withScore = scored.map((d) => ({
    ...d,
    combined: 0.6 * (cosine ? d.norm / maxNorm : d.overlap) + 0.4 * (1 - d.i / hits.length),
  }));
  const filtered = withScore.filter((d) => d.overlap >= 0.1);
  if (filtered.length === 0) return withScore.slice(0, k).map((d) => d.h);
  return filtered.sort((a, b) => b.combined - a.combined).slice(0, k).map((d) => d.h);
}

// ---- Cohere rerank (direct v2 call, not the Convex cascade) ------------------------------
// cascade.ts gives Cohere only Tier-1's top 15 after its word-overlap filter, which is the
// heuristic under test, so the harness calls the endpoint itself. Calls are sequential,
// paced for the trial limit (10/min), and cached by (model, query, documents).
const COHERE_MODEL = "rerank-v4.0-fast";
const cohereCachePath = process.argv.includes("--cohere-cache")
  ? process.argv[process.argv.indexOf("--cohere-cache") + 1]!
  : null;
const cohereCache: Record<string, Array<{ index: number; relevance_score: number }>> =
  cohereCachePath && existsSync(cohereCachePath) ? JSON.parse(readFileSync(cohereCachePath, "utf8")) : {};
let lastCohereCall = 0;
let cohereCalls = 0;

async function cohereRerank(query: string, hits: Hit[]): Promise<Array<Hit & { rerankScore: number }>> {
  if (hits.length === 0) return [];
  const documents = hits.map((h) => h.text);
  const key = createHash("sha256").update(JSON.stringify([COHERE_MODEL, query, documents])).digest("hex");
  let results = cohereCache[key];
  for (let attempt = 0; !results; attempt++) {
    const wait = lastCohereCall + 6500 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCohereCall = Date.now();
    cohereCalls++;
    const res = await fetch("https://api.cohere.com/v2/rerank", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: COHERE_MODEL, query, documents, top_n: documents.length }),
    });
    if (res.ok) {
      results = ((await res.json()) as { results: Array<{ index: number; relevance_score: number }> }).results;
      cohereCache[key] = results;
      if (cohereCachePath) writeFileSync(cohereCachePath, JSON.stringify(cohereCache));
    } else if (attempt >= 4 || (res.status !== 429 && res.status < 500)) {
      throw new Error(`Cohere rerank ${res.status}: ${(await res.text()).slice(0, 200)}`);
    } else {
      await new Promise((r) => setTimeout(r, 60_000));
    }
  }
  return results
    .filter((r) => r.index >= 0 && r.index < hits.length)
    .map((r) => ({ ...hits[r.index]!, rerankScore: r.relevance_score }));
}

// cloudflareRerank swallows failures and returns input order scored 1 - i/topK; treat that as an error.
async function cfRerank(query: string, hits: Hit[]): Promise<Array<Hit & { rerankScore: number }>> {
  if (hits.length === 0) return [];
  const out = await retry(async () => {
    const r = (await client.action(cloudflareRerank, {
      query,
      documents: hits.map((h) => ({ id: h.id, text: h.text })),
      topK: hits.length,
    })) as Array<{ index: number; score: number }>;
    if (r.every((x, i) => x.index === i && x.score === 1 - i / hits.length))
      throw new Error("cloudflareRerank fell back to input order");
    return r;
  });
  return out
    .filter((r) => r.index >= 0 && r.index < hits.length)
    .map((r) => ({ ...hits[r.index]!, rerankScore: r.score }));
}

// Row spec "<cohere|cf>_<q|rw><8|24>": reranker, query text, deduplicated pool depth.
function parseRerankSpec(spec: string) {
  const m = spec.match(/^(cohere|cf)_(q|rw)(8|24)$/);
  if (!m) throw new Error(`bad rerank row ${spec}`);
  return { rank: m[1] === "cohere" ? cohereRerank : cfRerank, useQuestion: m[2] === "q", depth: Number(m[3]) };
}

// Chunks known (from probes) to answer a query better than its golden label.
const TARGET_SNIPPETS: Record<string, string[]> = {
  "What is the minimum percentage required in FSc for admission to UET Taxila?": [
    "60% unadjusted",
    "at least 60% marks for engineering",
  ],
  "fee structure": ["104,800"],
  "What is the fee structure for BS Software Engineering at UET Taxila?": ["104,800"],
};
function hasTarget(query: string, h: Hit): boolean {
  return (TARGET_SNIPPETS[query] ?? []).some((s) => norm(h.text).includes(s));
}

// ---- Scoring ----------------------------------------------------------------------------

function isRelevant(hit: Hit, labels: Label[]): boolean {
  const t = norm(hit.text);
  return labels.some((l) => t.includes(l.snippet));
}

async function main() {
  const args = process.argv.slice(2);
  const cachePath = args[args.indexOf("--cache") + 1]!;
  const outPath = args[args.indexOf("--out") + 1]!;
  const labels = loadLabels();
  const golden = readFileSync(resolve(ROOT, "scripts/eval/golden_set_verified.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Golden)
    .filter((g) => g.relevantChunkKeys.length > 0 && !g.excludeFromScoring);

  const cache: Record<string, { rewrite: string; hyde: string }> = existsSync(cachePath)
    ? JSON.parse(readFileSync(cachePath, "utf8"))
    : {};
  const limit = candidateLimit(FINAL_K);
  const variants = [
    "old_lexHyde_denseHyde",
    "new_lexRewrite_denseHyde",
    "lexRewrite_denseRewrite",
    "lexRewrite_denseQuestion",
    "lexRewrite_denseBoth",
  ] as const;
  const tally = Object.fromEntries(variants.map((v) => [v, { hit: 0, n: 0 }]));
  // Recall over the entries whose ground truth is NOT contested, kept alongside the
  // headline number. 9 of the 23 scoreable entries carry provenance the project has
  // downgraded to UNCONFIRMED - most visibly the fee queries, where the labelled chunk
  // holds a figure that matches no Prospectus edition. Averaging those together with
  // the clean entries produces one number that cannot be acted on; report both.
  const cleanTally = Object.fromEntries(variants.map((v) => [v, { hit: 0, n: 0 }]));
  const perQuery: unknown[] = [];
  const rerankTally: Record<string, { hit: number; n: number }> = {};
  const budgetTally: Record<string, { hit: number; n: number }> = {};
  const answerTally: Record<string, { pass: number; n: number }> = {};
  const rerankSpecs = args.includes("--rerank-rows")
    ? args[args.indexOf("--rerank-rows") + 1]!.split(",")
    : [];
  rerankSpecs.forEach(parseRerankSpec);

  for (const g of golden) {
    const rel = g.relevantChunkKeys.map((k) => labels.get(k)).filter((l): l is Label => !!l);
    if (rel.length === 0) continue;
    if (!cache[g.query]) {
      cache[g.query] = await enrich(g.query);
      writeFileSync(cachePath, JSON.stringify(cache, null, 2));
    }
    const { rewrite, hyde } = cache[g.query]!;
    const weights = estimateIdf(rewrite).weights;

    const [lexRw, lexHy, dHy, dRw, dQ] = await Promise.all([
      lexical(rewrite, limit),
      lexical(hyde, limit),
      dense(hyde, limit),
      dense(rewrite, limit),
      dense(g.query, limit),
    ]);
    // d2: optional second dense channel (e.g. HyDE and the raw question), same weight as d.
    // dedupe: apply search.ts's dropNearDuplicates to the whole fused pool before the cut to 8.
    const fuse = (d: Hit[], lx: typeof lexRw, d2?: Hit[], dedupe = false, poolSize = FINAL_K): Hit[] => {
      const byId = new Map<string, Hit>();
      for (const h of [...d, ...(d2 ?? []), ...lx.text, ...lx.ctx])
        if (!byId.has(h.id)) byId.set(h.id, h);
      const fused = hybridRank(d, lx.text, RRF_K, weights, "reciprocal", [
        { results: lx.chunk, weight: weights.text * 0.5 },
        { results: lx.ctx, weight: weights.text * 0.25 },
        ...(d2 ? [{ results: d2, weight: weights.vector }] : []),
      ]);
      const hits = fused.map((f) => byId.get(f.id)!).filter(Boolean);
      return dedupe
        ? dropNearDuplicates(
            hits.map((h) => ({ ...h, content: h.text })),
            poolSize,
          )
        : hits.slice(0, poolSize);
    };
    // Same fused pool as the deployed config, with older editions removed before the cut to 8.
    const fuseNewest = (): Hit[] => {
      const byId = new Map<string, Hit>();
      for (const h of [...dHy, ...dQ, ...lexRw.text, ...lexRw.ctx]) if (!byId.has(h.id)) byId.set(h.id, h);
      const fused = hybridRank(dHy, lexRw.text, RRF_K, weights, "reciprocal", [
        { results: lexRw.chunk, weight: weights.text * 0.5 },
        { results: lexRw.ctx, weight: weights.text * 0.25 },
        { results: dQ, weight: weights.vector },
      ]);
      const hits = dropOlderEditions(fused.map((f) => byId.get(f.id)!).filter(Boolean));
      return dropNearDuplicates(hits.map((h) => ({ ...h, content: h.text })), FINAL_K);
    };
    const results = {
      old_lexHyde_denseHyde: fuse(dHy, lexHy),
      new_lexRewrite_denseHyde: fuse(dHy, lexRw),
      lexRewrite_denseRewrite: fuse(dRw, lexRw),
      lexRewrite_denseQuestion: fuse(dQ, lexRw),
      lexRewrite_denseBoth: fuse(dHy, lexRw, dQ),
    };
    const row: Record<string, unknown> = { query: g.query, rewrite };
    for (const v of variants) {
      const hit = results[v].some((h) => isRelevant(h, rel));
      tally[v]!.n++;
      if (hit) tally[v]!.hit++;
      if (g.groundTruth !== "contested") {
        cleanTally[v]!.n++;
        if (hit) cleanTally[v]!.hit++;
      }
      row[v] = hit;
    }
    if (args.includes("--rerank")) {
      const at4: Record<string, boolean> = {};
      for (const v of [
        "new_lexRewrite_denseHyde",
        "lexRewrite_denseQuestion",
        "lexRewrite_denseBoth",
      ] as const) {
        const top8 = results[v];
        const [tier1, cfQuestion, cfRewrite] = await Promise.all([
          rerankTop4(cascadeRerank, rewrite, top8),
          rerankTop4(cloudflareRerank, g.query, top8),
          rerankTop4(cloudflareRerank, rewrite, top8),
        ]);
        const hit = (hs: Hit[]) => hs.some((h) => isRelevant(h, rel));
        at4[`${v}|fused`] = hit(top8.slice(0, 4));
        at4[`${v}|tier1`] = hit(tier1);
        at4[`${v}|cfQuestion`] = hit(cfQuestion);
        at4[`${v}|cfRewrite`] = hit(cfRewrite);
      }
      row.recallAt4 = at4;
      for (const [k, h] of Object.entries(at4)) {
        rerankTally[k] ??= { hit: 0, n: 0 };
        rerankTally[k]!.n++;
        if (h) rerankTally[k]!.hit++;
      }
    }
    if (args.includes("--budget")) {
      // Does a relevant chunk survive retrieval.ts's topK cut AND buildContext's char budget
      // (maxTokens*4, chunks packed greedily in score order, a chunk that doesn't fit is skipped)?
      const ordered = await rerankTopK(cascadeRerank, rewrite, results.lexRewrite_denseBoth, 8);
      const dedupedPool = fuse(dHy, lexRw, dQ, true);
      const orderedDeduped = await rerankTopK(cascadeRerank, rewrite, dedupedPool, 8);
      // pool16/pool24: hand the reranker a deeper deduplicated candidate list than production's 8.
      const pool16 = await rerankTopK(cascadeRerank, rewrite, fuse(dHy, lexRw, dQ, true, 16), 8);
      const deep24 = fuse(dHy, lexRw, dQ, true, 24);
      // --lex-question: an extra lexical channel on the raw question (the rewrite can drift,
      // e.g. "fee structure" -> "fee structure tuition fees payment schedule").
      let lexQPool: Hit[] | null = null;
      let lexQChunkPool: Hit[] | null = null;
      if (args.includes("--lex-question")) {
        const lexQ = await lexical(g.query, limit);
        const fuseLexQ = (withChunk: boolean): Hit[] => {
          const byId = new Map<string, Hit>();
          for (const h of [...dHy, ...dQ, ...lexRw.text, ...lexRw.ctx, ...lexQ.text]) if (!byId.has(h.id)) byId.set(h.id, h);
          const fused = hybridRank(dHy, lexRw.text, RRF_K, weights, "reciprocal", [
            { results: lexRw.chunk, weight: weights.text * 0.5 },
            { results: lexRw.ctx, weight: weights.text * 0.25 },
            { results: dQ, weight: weights.vector },
            { results: lexQ.text, weight: weights.text },
            ...(withChunk ? [{ results: lexQ.chunk, weight: weights.text * 0.5 }] : []),
          ]);
          const hits = fused.map((f) => byId.get(f.id)!).filter(Boolean);
          return dropNearDuplicates(hits.map((h) => ({ ...h, content: h.text })), FINAL_K);
        };
        lexQPool = fuseLexQ(false);
        lexQChunkPool = fuseLexQ(true);
      }
      const pool24 = await rerankTopK(cascadeRerank, rewrite, deep24, 8);
      row.relevantInPool24 = deep24.some((h) => isRelevant(h, rel));
      const rerankRows: Array<[string, Hit[]]> = [];
      const rerankLog: Record<string, unknown> = {};
      for (const spec of rerankSpecs) {
        const { rank, useQuestion, depth } = parseRerankSpec(spec);
        const ranked = await rank(useQuestion ? g.query : rewrite, depth === 8 ? dedupedPool : deep24);
        rerankRows.push([spec, ranked]);
        rerankLog[spec] = ranked.map((h) => ({
          score: +h.rerankScore.toPrecision(4),
          relevant: isRelevant(h, rel),
          target: hasTarget(g.query, h),
          path: editionPath(h),
        }));
      }
      if (rerankSpecs.length) row.rerank = rerankLog;
      if (TARGET_SNIPPETS[g.query]) {
        row.targets = {
          inPool24: deep24.some((h) => hasTarget(g.query, h)),
          dedupeTop4: orderedDeduped.slice(0, 4).some((h) => hasTarget(g.query, h)),
          ...Object.fromEntries(
            rerankRows.map(([name, list]) => [`${name}Top4`, list.slice(0, 4).some((h) => hasTarget(g.query, h))]),
          ),
        };
      }
      // "demote": chunks that are mostly markdown link lines (the crawler's nav/resource
      // manifest) are moved behind content chunks, keeping order otherwise.
      const demoted = [
        ...ordered.filter((h) => linkShare(h.text) < NAV_LINK_SHARE),
        ...ordered.filter((h) => linkShare(h.text) >= NAV_LINK_SHARE),
      ];
      const at: Record<string, boolean> = {};
      for (const [name, list] of [
        ["base", ordered],
        ["demote", demoted],
        ["dedupe", orderedDeduped],
        ["fusedOrder", dedupedPool], // no rerank: deduplicated fusion order
        ["newestEdition", await rerankTopK(cascadeRerank, rewrite, fuseNewest(), 8)],
        [
          "dedupeNav",
          [
            ...orderedDeduped.filter((h) => navShare(h.text) < NAV_LINK_SHARE),
            ...orderedDeduped.filter((h) => navShare(h.text) >= NAV_LINK_SHARE),
          ],
        ],
        ["lexQ", lexQPool ? await rerankTopK(cascadeRerank, rewrite, lexQPool, 8) : orderedDeduped],
        ["lexQchunk", lexQChunkPool ? await rerankTopK(cascadeRerank, rewrite, lexQChunkPool, 8) : orderedDeduped],
        ["tier1Local8", tier1Local(rewrite, dedupedPool, 8, false)], // parity check vs "dedupe"
        ["cosine8", tier1Local(rewrite, dedupedPool, 8, true)],
        ["cosine24", tier1Local(rewrite, deep24, 8, true)],
        ["pool16", pool16],
        ["pool24", pool24],
        ...rerankRows,
      ] as const) {
        for (const k of [4, 5, 6, 8]) {
          for (const maxTokens of [3000, 4500, 6000]) {
            let used = 0;
            const packed: Hit[] = [];
            for (const h of list.slice(0, k)) {
              const len = CONTEXT_HEADER_CHARS + h.text.length + 9;
              if (used + len > maxTokens * 4) continue;
              packed.push(h);
              used += len;
            }
            at[`${name}|k${k}|tok${maxTokens}`] = packed.some((h) => isRelevant(h, rel));
          }
        }
      }
      row.contextBudget = at;
      row.dedupedPoolSize = dedupedPool.length;
      row.navDemoted = orderedDeduped.filter((h) => navShare(h.text) >= NAV_LINK_SHARE).map((h) => ({
        relevant: isRelevant(h, rel),
        head: h.text.slice(0, 160),
      }));
      row.top8 = ordered.map((h) => ({
        chars: h.text.length,
        linkShare: +linkShare(h.text).toFixed(2),
        relevant: isRelevant(h, rel),
        ...(args.includes("--dump-text") ? { text: h.text } : {}),
      }));
      for (const [key, h] of Object.entries(at)) {
        budgetTally[key] ??= { hit: 0, n: 0 };
        budgetTally[key]!.n++;
        if (h) budgetTally[key]!.hit++;
      }
    }
    if (args.includes("--answers") && ANSWER_RUBRICS[g.query]) {
      // End-to-end: production cascade to top 4 -> real buildContext -> real buildSystemPrompt ->
      // answer (Gemini) -> rubric judge (Gemini). CRAG and the confidence directive are skipped
      // for both variants; freshness headers are "unknown" for both.
      // --answers-k6: current retrieval with the reranker keeping 4 vs 6 chunks (same 3000-token budget).
      const deployed = fuse(dHy, lexRw, dQ, true); // 8cf42e2 + near-duplicate removal
      const answersRerank = args.includes("--answers-rerank")
        ? args[args.indexOf("--answers-rerank") + 1]!
        : null;
      // reranked: an already-ordered list used as is (no cascade call).
      const rr = answersRerank ? parseRerankSpec(answersRerank) : null;
      const configs: Record<string, { pool: Hit[]; k: number; reranked?: boolean }> = rr
        ? {
            current: { pool: deployed, k: 4 },
            [answersRerank!]: {
              pool: await rr.rank(
                rr.useQuestion ? g.query : rewrite,
                rr.depth === 8 ? deployed : fuse(dHy, lexRw, dQ, true, 24),
              ),
              k: 4,
              reranked: true,
            },
          }
        : args.includes("--answers-k6")
        ? { current: { pool: deployed, k: 4 }, k6: { pool: deployed, k: 6 } }
        : args.includes("--answers-newest")
        ? { current: { pool: deployed, k: 4 }, newest: { pool: fuseNewest(), k: 4 } }
        : {
            morning: { pool: results.new_lexRewrite_denseHyde, k: 4 }, // deployed before 8cf42e2
            current: { pool: deployed, k: 4 },
          };
      const answers: Record<string, unknown> = {};
      for (const [name, { pool, k, reranked }] of Object.entries(configs)) {
        const top4 = reranked ? pool.slice(0, k) : await rerankTopK(cascadeRerank, rewrite, pool, k);
        const context: string = await buildContextHandler(
          {},
          {
            maxTokens: 3000,
            chunks: top4.map((h, i) => ({
              content: h.text,
              relevanceScore: 1 - i * 0.1,
              url: h.text.match(/^URL Path: (.*)$/m)?.[1] ?? "",
              title: h.text.match(/^Document Title: (.*)$/m)?.[1] ?? "",
            })),
          },
        );
        const response = await generatePaced(
          buildSystemPrompt(context || null, "general"),
          g.query,
          0.3,
          1500,
        );
        const verdictText = await generatePaced(
          "You grade a university chatbot answer against a rubric. Reply with PASS or FAIL on the first line, then one sentence of reason.",
          `QUESTION: ${g.query}\n\nRUBRIC (authoritative ground truth): ${ANSWER_RUBRICS[g.query]}\n\nCHATBOT ANSWER:\n${response}`,
          0,
          300,
        );
        const pass = /^\W*PASS/i.test(verdictText);
        answerTally[name] ??= { pass: 0, n: 0 };
        answerTally[name]!.n++;
        if (pass) answerTally[name]!.pass++;
        answers[name] = { top4Paths: top4.map(editionPath), targetInContext: top4.some((h) => hasTarget(g.query, h)), pass, verdict: verdictText, response, relevantInContext: top4.some((h) => isRelevant(h, rel)) };
      }
      row.answers = answers;
      console.log(
        "  answers:",
        Object.entries(answers)
          .map(([n, a]) => `${n}=${(a as { pass: boolean }).pass ? "PASS" : "FAIL"}`)
          .join(" "),
      );
    }
    row.channelHits = {
      lexRewrite: lexRw.text.slice(0, FINAL_K).some((h) => isRelevant(h, rel)),
      lexHyde: lexHy.text.slice(0, FINAL_K).some((h) => isRelevant(h, rel)),
      denseHyde: dHy.slice(0, FINAL_K).some((h) => isRelevant(h, rel)),
      denseRewrite: dRw.slice(0, FINAL_K).some((h) => isRelevant(h, rel)),
      denseQuestion: dQ.slice(0, FINAL_K).some((h) => isRelevant(h, rel)),
      anyChannelTop30: [...lexRw.text, ...lexHy.text, ...dHy, ...dRw, ...dQ].some((h) =>
        isRelevant(h, rel),
      ),
    };
    if (args.includes("--inspect")) {
      const ch = row.channelHits as Record<string, boolean>;
      if (ch.denseHyde !== ch.denseQuestion) {
        console.log(`\n### ${g.query}`);
        for (const [name, hits] of [
          ["denseHyde", dHy],
          ["denseQuestion", dQ],
        ] as const) {
          console.log(`  ${name}:`);
          for (const h of hits.slice(0, 4)) {
            const body = h.text.replace(/^Document Title: .*? URL Path: /, "").replace(/\s+/g, " ");
            console.log(`    - ${body.slice(0, 170)}`);
          }
        }
      }
    }
    perQuery.push(row);
    console.log(
      g.query.slice(0, 60).padEnd(62),
      variants.map((v) => (row[v] ? "1" : "0")).join(" "),
      JSON.stringify(row.channelHits),
    );
  }

  const summary = Object.fromEntries(
    Object.entries(tally).map(([v, t]) => [
      v,
      {
        recallAt8: +(t.hit / t.n).toFixed(3),
        hits: t.hit,
        queries: t.n,
        recallAt8Uncontested: cleanTally[v]!.n
          ? +(cleanTally[v]!.hit / cleanTally[v]!.n).toFixed(3)
          : null,
        uncontestedQueries: cleanTally[v]!.n,
      },
    ]),
  );
  const rerankSummary = Object.fromEntries(
    Object.entries(rerankTally).map(([k, t]) => [k, +(t.hit / t.n).toFixed(3)]),
  );
  const budgetSummary = Object.fromEntries(
    Object.entries(budgetTally).map(([k, t]) => [k, +(t.hit / t.n).toFixed(3)]),
  );
  const answerSummary = Object.fromEntries(
    Object.entries(answerTally).map(([k, t]) => [k, `${t.pass}/${t.n}`]),
  );
  console.log(JSON.stringify({ summary, rerankSummary, budgetSummary, answerSummary }, null, 2));
  if (cohereCalls) console.log(`Cohere API calls this run: ${cohereCalls}`);
  writeFileSync(
    outPath,
    JSON.stringify({ summary, rerankSummary, budgetSummary, answerSummary, perQuery }, null, 2),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
