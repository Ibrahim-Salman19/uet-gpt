import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { resolve } from "node:path";
const ROOT = resolve(__dirname, "../../..");
const env: Record<string,string> = {};
for (const line of readFileSync(`${ROOT}/.env.vercel-production.local`, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]!] = m[2]!.replace(/^"|"$/g, "");
}
const client = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL!);
(client as unknown as { setAdminAuth(k: string): void }).setAdminAuth(env.CONVEX_DEPLOY_KEY!);
const q = makeFunctionReference<"query">("knowledgeStore/convexQueries:getChunkHitsByRagIds");
const frozen = JSON.parse(readFileSync(`${ROOT}/scripts/eval/rerank-position/frozen.json`, "utf8"));

async function main() {
  const ids = [...new Set(frozen.rows.flatMap((r: any) => r.pre.map((c: any) => c.entryId)))] as string[];
  let withCtx = 0, without = 0, unresolved = 0;
  const samples: string[] = [];
  for (const id of ids) {
    try {
      const [h] = (await client.query(q, { ragIds: [id] })) as Array<null | { contextualizedText: string | null; text: string }>;
      if (!h) { unresolved++; continue; }
      if (h.contextualizedText && h.contextualizedText.trim().length > 0) {
        withCtx++;
        if (samples.length < 2) samples.push(h.contextualizedText.replace(/\s+/g," ").slice(0,140));
      } else without++;
    } catch { unresolved++; }
  }
  const resolved = withCtx + without;
  console.log(`retrieved chunks probed        : ${ids.length}`);
  console.log(`  resolved in crawledChunks    : ${resolved}`);
  console.log(`  unresolved (FAQ / F-9 rows)  : ${unresolved}`);
  console.log(`\ncontextualizedText present     : ${withCtx}/${resolved}  (${resolved ? (100*withCtx/resolved).toFixed(0) : 0}%)`);
  console.log(`contextualizedText missing     : ${without}/${resolved}`);
  if (samples.length) { console.log("\nsample contextualized text:"); for (const s of samples) console.log(`  ${s}`); }
}
main().catch((e)=>{console.error(e);process.exit(1);});
