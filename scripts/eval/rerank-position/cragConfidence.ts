/**
 * Is CRAG's self-reported confidence a real signal, or a fourth inert one?
 *
 * `allIrrelevant` - the gate that produces a refusal, and the mechanism behind the
 * 2026-09-19 production regression (§13) - fires only when the judge marks EVERY chunk
 * `!relevant` with `confidence > CRAG_CONFIG.highConfidenceThreshold` (0.7). An LLM's
 * self-reported confidence is not calibrated, so that threshold is only meaningful if the
 * numbers actually vary.
 *
 * Calls the REAL deployed rag/crag:evaluateChunks on the real production top-4 per golden
 * query, so the inputs are production-shaped. 10 calls at temperature 0.
 *
 *   npx tsx scripts/eval/rerank-position/cragConfidence.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { CRAG_CONFIG } from "../../../convex/rag/constants";

const ROOT = resolve(__dirname, "../../..");
const HERE = resolve(__dirname);

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.replace(/^"|"$/g, "");
  }
  return out;
}

type Eval = { index: number; relevant: boolean; confidence: number };

async function main() {
  const env = loadEnvFile(resolve(ROOT, ".env.vercel-production.local"));
  const client = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL!);
  (client as unknown as { setAdminAuth(k: string): void }).setAdminAuth(env.CONVEX_DEPLOY_KEY!);
  const evaluateChunks = makeFunctionReference<"action">("rag/crag:evaluateChunks");

  const frozen = JSON.parse(readFileSync(resolve(HERE, "frozen.json"), "utf8"));
  const chunks = JSON.parse(readFileSync(resolve(HERE, "chunks.json"), "utf8")) as Record<
    string,
    { text: string }
  >;

  const all: Eval[] = [];
  let wouldRefuse = 0;
  console.log(`highConfidenceThreshold = ${CRAG_CONFIG.highConfidenceThreshold}\n`);
  console.log("query      | verdicts (relevant? @confidence)                     | allIrrelevant?");
  console.log("-".repeat(96));

  for (const row of frozen.rows) {
    const top4 = [...row.post]
      .sort(
        (a: { relevanceScore: number }, b: { relevanceScore: number }) =>
          b.relevanceScore - a.relevanceScore,
      )
      .slice(0, 4);
    const payload = top4.map((c: { entryId: string; contentExcerpt: string }, i: number) => ({
      index: i,
      text: chunks[c.entryId]?.text ?? c.contentExcerpt,
    }));

    // CRAG judges the user's question, not the rewrite (retrieval.ts passes safeQuestion).
    const evals = (await client.action(evaluateChunks, {
      query: row.query,
      chunks: payload,
    })) as Eval[];
    all.push(...evals);

    const refuses =
      evals.length > 0 &&
      evals.every((e) => !e.relevant && e.confidence > CRAG_CONFIG.highConfidenceThreshold);
    if (refuses) wouldRefuse++;

    const rendered = evals
      .map((e) => `${e.relevant ? "Y" : "n"}@${e.confidence.toFixed(2)}`)
      .join(" ");
    console.log(
      `${row.queryId.slice(0, 8)} | ${rendered.padEnd(52)} | ${refuses ? "REFUSE" : "-"}`,
    );
  }

  const confs = all.map((e) => e.confidence).sort((a, b) => a - b);
  const uniq = [...new Set(confs)];
  const pct = (p: number) => confs[Math.floor(p * (confs.length - 1))]!;
  console.log("-".repeat(96));
  console.log(
    `\nper-chunk verdicts: ${all.length}  (relevant ${all.filter((e) => e.relevant).length})`,
  );
  console.log(
    `confidence  min ${confs[0]}  p25 ${pct(0.25)}  median ${pct(0.5)}  p75 ${pct(0.75)}  max ${confs[confs.length - 1]}`,
  );
  console.log(`distinct confidence values actually emitted: ${uniq.length}  -> ${uniq.join(", ")}`);
  console.log(
    `rejections (!relevant) below the 0.7 gate: ${all.filter((e) => !e.relevant && e.confidence <= CRAG_CONFIG.highConfidenceThreshold).length}`,
  );
  console.log(`queries where allIrrelevant would fire: ${wouldRefuse}/${frozen.rows.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
