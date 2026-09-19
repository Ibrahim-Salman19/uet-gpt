/**
 * Does defining what `confidence` MEANS make CRAG's number usable?
 *
 * convex/rag/crag.ts asks the judge to "determine if it is relevant" and to return
 * {relevant, confidence}, but never says what confidence measures. Measured against
 * production (scripts/eval/rerank-position/cragConfidence.ts) the model uses it two
 * incompatible ways in the same run: rejections at 0.90/0.85/0.80, and rejections at
 * 0.20/0.15/0.05.
 *
 * Two live consumers read that number in OPPOSITE directions:
 *   retrieval.ts:454 allIrrelevant          - wants high = certainly irrelevant
 *   retrieval.ts:381 pickLeastRejectedIndex - takes the MINIMUM as "least confidently
 *                                             rejected", which under the other reading
 *                                             selects the least RELEVANT chunk
 *
 * Prediction if the scale is the problem: on 8fe9e8f2 ("fee structure for BS Software
 * Engineering") chunks 2-4 are postgraduate fee tables and a PhD scholar bio - clearly
 * irrelevant - so a prompt defining confidence as certainty-in-the-verdict should reject
 * them with HIGH confidence, where the current prompt gives 0.20/0.15/0.10.
 *
 * NOT YET RUN. The first attempt hit Groq's 8,000 tokens-per-minute limit partway
 * through - each call carries four full chunks, ~2,400 tokens - and that budget is shared
 * with the live bot, which Groq rate-limited for ~24h on 2026-09-15. Calls are now paced
 * below; re-run when spending that quota is acceptable.
 *
 *   npx tsx scripts/eval/crag-confidence-ab/run.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";

const ROOT = resolve(__dirname, "../../..");
const CAP = resolve(ROOT, "scripts/eval/rerank-position");

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.replace(/^"|"$/g, "");
  }
  return out;
}
const env = loadEnvFile(resolve(ROOT, ".env.vercel-production.local"));
const model = createGroq({ apiKey: env.GROQ_API_KEY! })("openai/gpt-oss-120b");

const schema = z.object({
  evaluations: z.array(
    z.object({ index: z.number(), relevant: z.boolean(), confidence: z.number().min(0).max(1) }),
  ),
});

// Verbatim from convex/rag/crag.ts:buildCragPrompt.
const currentTail =
  "For each chunk above, determine if it is relevant to answering the user query.\n" +
  "Respond with a JSON array of evaluations, one per chunk in the order shown above.";

// Only addition: what the number means, and that it is about the VERDICT.
const clarifiedTail =
  "For each chunk above, determine if it is relevant to answering the user query.\n" +
  '"confidence" is how certain you are of your own relevant/not-relevant verdict for that ' +
  "chunk, from 0 (a coin flip) to 1 (completely certain). It is NOT a relevance score: a " +
  "chunk you are sure is irrelevant has HIGH confidence, not low.\n" +
  "Respond with a JSON array of evaluations, one per chunk in the order shown above.";

function buildPrompt(query: string, chunks: Array<{ index: number; text: string }>, tail: string) {
  const chunksText = chunks.map((c) => `[Chunk ${c.index}]\n${c.text}`).join("\n\n");
  return `You are evaluating whether retrieved document chunks are relevant to answering a user query.

User query: ${JSON.stringify(query)}

${chunksText}

${tail}`;
}

async function main() {
  const frozen = JSON.parse(readFileSync(resolve(CAP, "frozen.json"), "utf8"));
  const chunks = JSON.parse(readFileSync(resolve(CAP, "chunks.json"), "utf8")) as Record<
    string,
    { text: string }
  >;

  for (const [label, tail] of [
    ["CURRENT (confidence undefined)", currentTail],
    ["CLARIFIED (confidence = certainty in the verdict)", clarifiedTail],
  ] as const) {
    const rejected: number[] = [];
    const accepted: number[] = [];
    const lines: string[] = [];
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
      // Paced: 4 chunks/call is ~2,400 tokens against an 8,000 TPM ceiling shared with
      // production traffic. Without this the second arm rate-limits partway through.
      await new Promise((r) => setTimeout(r, 22_000));
      const { object } = await generateObject({
        model,
        schema,
        prompt: buildPrompt(row.query, payload, tail),
        temperature: 0,
        maxRetries: 2,
      });
      for (const e of object.evaluations) (e.relevant ? accepted : rejected).push(e.confidence);
      lines.push(
        `  ${row.queryId.slice(0, 8)} ${object.evaluations.map((e) => `${e.relevant ? "Y" : "n"}@${e.confidence.toFixed(2)}`).join(" ")}`,
      );
    }
    const med = (a: number[]) =>
      a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]! : Number.NaN;
    console.log(`\n== ${label} ==`);
    console.log(lines.join("\n"));
    console.log(`  rejections ${rejected.length}, median confidence ${med(rejected).toFixed(2)}`);
    console.log(
      `  rejections BELOW the 0.7 allIrrelevant gate: ${rejected.filter((c) => c <= 0.7).length}/${rejected.length}`,
    );
    console.log(`  acceptances ${accepted.length}, median confidence ${med(accepted).toFixed(2)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
