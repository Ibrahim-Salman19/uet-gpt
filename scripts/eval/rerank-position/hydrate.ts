import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const ROOT = resolve(__dirname, "../../..");
const env: Record<string, string> = {};
for (const line of readFileSync(resolve(ROOT, ".env.vercel-production.local"), "utf8").split(
  "\n",
)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]!] = m[2]!.replace(/^"|"$/g, "");
}
const client = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL!);
(client as unknown as { setAdminAuth(k: string): void }).setAdminAuth(env.CONVEX_DEPLOY_KEY!);
const q = makeFunctionReference<"query">("knowledgeStore/convexQueries:getChunkHitsByRagIds");

async function main() {
  const frozen = JSON.parse(
    readFileSync(resolve(ROOT, "scripts/eval/rerank-position/frozen.json"), "utf8"),
  );
  const ragIds = [
    ...new Set(frozen.rows.flatMap((r: any) => r.pre.map((c: any) => c.entryId))),
  ] as string[];
  console.log(`hydrating ${ragIds.length} unique chunks in one batched query...`);
  // One ragId per call: getChunkHitsByRagIds uses .unique(), so a single duplicated
  // ragId throws for the WHOLE batch and tells us nothing about which one it was.
  const byRag: Record<string, { chunkKey: string; text: string }> = {};
  const duplicated: string[] = [];
  let nulls = 0;
  for (const id of ragIds) {
    try {
      const [h] = (await client.query(q, { ragIds: [id] })) as Array<null | {
        chunkKey: string;
        text: string;
      }>;
      if (h) byRag[id] = { chunkKey: h.chunkKey, text: h.text };
      else nulls++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("more than one result")) duplicated.push(id);
      else throw e;
    }
  }
  console.log(
    `resolved ${Object.keys(byRag).length}, missing ${nulls}, DUPLICATED ragIds ${duplicated.length}`,
  );
  if (duplicated.length) {
    console.log("\nragIds mapping to more than one crawledChunks row:");
    for (const id of duplicated) {
      const where = frozen.rows
        .filter((r: any) => r.pre.some((c: any) => c.entryId === id))
        .map((r: any) => {
          const c = r.pre.find((x: any) => x.entryId === id);
          return `${r.queryId.slice(0, 8)} rank ${r.pre.findIndex((x: any) => x.entryId === id) + 1} -> ${c.url.replace(/^https?:\/\/[^/]+/, "")}`;
        });
      console.log(`  ${id}\n     ${where.join("\n     ")}`);
    }
  }
  writeFileSync(
    resolve(ROOT, "scripts/eval/rerank-position/chunks.json"),
    JSON.stringify(byRag, null, 2),
  );
  console.log("wrote scripts/eval/rerank-position/chunks.json");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
