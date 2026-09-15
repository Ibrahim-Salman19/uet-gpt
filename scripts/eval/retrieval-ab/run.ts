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
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { config as loadEnv } from "dotenv";
import { hybridRank } from "../../../convex/embeddings/hybridRank";
import { estimateIdf } from "../../../convex/embeddings/idf";
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

type Golden = { queryId: string; query: string; relevantChunkKeys: string[] };

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

async function enrich(query: string) {
  const [rw, hy] = await Promise.all([
    generateText({
      model: gemini,
      system: REWRITE_SYSTEM,
      prompt: query,
      temperature: 0.3,
      maxOutputTokens: 100,
    }),
    generateText({
      model: gemini,
      system: HYDE_SYSTEM,
      prompt: query,
      temperature: 0.5,
      maxOutputTokens: 200,
    }),
  ]);
  return { rewrite: rw.text.trim() || query, hyde: hy.text.trim() || query };
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

type Hit = { id: string; text: string; url: string };

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
    text: fts.map((r) => ({ id: r.ragId, text: r.text, url: r.url })),
    chunk: fts
      .slice(0, Math.min(20, limit))
      .map((r) => ({ id: r.ragId, text: r.text, url: r.url })),
    ctx: ctxd.map((r) => ({ id: r.ragId, text: r.text, url: r.url })),
  };
}

async function dense(text: string, limit: number): Promise<Hit[]> {
  const emb = (await retry(() => client.action(cfEmbed, { text }))) as number[] | null;
  if (!emb) return [];
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
    out.push({ id: r.ragId, text: r.text, url: "" });
  });
  return out;
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
    .filter((g) => g.relevantChunkKeys.length > 0);

  const cache: Record<string, { rewrite: string; hyde: string }> = existsSync(cachePath)
    ? JSON.parse(readFileSync(cachePath, "utf8"))
    : {};
  const limit = candidateLimit(FINAL_K);
  const variants = [
    "old_lexHyde_denseHyde",
    "new_lexRewrite_denseHyde",
    "lexRewrite_denseRewrite",
    "lexRewrite_denseQuestion",
  ] as const;
  const tally = Object.fromEntries(variants.map((v) => [v, { hit: 0, n: 0 }]));
  const perQuery: unknown[] = [];

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
    const fuse = (d: Hit[], lx: typeof lexRw): Hit[] => {
      const byId = new Map<string, Hit>();
      for (const h of [...d, ...lx.text, ...lx.ctx]) if (!byId.has(h.id)) byId.set(h.id, h);
      const fused = hybridRank(d, lx.text, RRF_K, weights, "reciprocal", [
        { results: lx.chunk, weight: weights.text * 0.5 },
        { results: lx.ctx, weight: weights.text * 0.25 },
      ]);
      return fused
        .slice(0, FINAL_K)
        .map((f) => byId.get(f.id)!)
        .filter(Boolean);
    };
    const results = {
      old_lexHyde_denseHyde: fuse(dHy, lexHy),
      new_lexRewrite_denseHyde: fuse(dHy, lexRw),
      lexRewrite_denseRewrite: fuse(dRw, lexRw),
      lexRewrite_denseQuestion: fuse(dQ, lexRw),
    };
    const row: Record<string, unknown> = { query: g.query, rewrite };
    for (const v of variants) {
      const hit = results[v].some((h) => isRelevant(h, rel));
      tally[v]!.n++;
      if (hit) tally[v]!.hit++;
      row[v] = hit;
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
      { recallAt8: +(t.hit / t.n).toFixed(3), hits: t.hit, queries: t.n },
    ]),
  );
  console.log(JSON.stringify(summary, null, 2));
  writeFileSync(outPath, JSON.stringify({ summary, perQuery }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
