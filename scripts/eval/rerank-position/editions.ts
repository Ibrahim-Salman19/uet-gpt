/**
 * Does a NEWER edition exist for the old-looking documents that reach the answer context?
 *
 * Audit §18.4 leaves open whether classifyFreshness should take an edition signal. That is
 * only a fix if the old editions being served are actually superseded. If Rule-Book-2023 is
 * the newest rule book UET has published, marking it "aged" would mislead in the opposite
 * direction - the honest answer is "the latest rule book is from 2023", which is what the
 * shipped §18.3 prompt rule already produces.
 *
 * Read-only: one evalRetrieveDocuments call per probe term.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const ROOT = resolve(__dirname, "../../..");
const YEAR = /(?<!\d)(?:19|20)\d{2}(?!\d)/g;

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.replace(/^"|"$/g, "");
  }
  return out;
}

// One probe per document family observed carrying an old year in the §14 capture.
const PROBES = [
  ["Rule Book", "Rule-Book-2023.pdf"],
  ["prospectus", "UET-Prospectus-2025.pdf"],
  ["admission guidelines", "Admission_Guidelines_2023.pdf"],
  ["curriculum course scheme", "Curriculum-2020.pdf / session 2017"],
] as const;

async function main() {
  const env = loadEnvFile(resolve(ROOT, ".env.vercel-production.local"));
  const client = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL!);
  (client as unknown as { setAdminAuth(k: string): void }).setAdminAuth(env.CONVEX_DEPLOY_KEY!);
  const evalRetrieve = makeFunctionReference<"action">("rag/evalRetrieval:evalRetrieveDocuments");

  for (const [probe, observed] of PROBES) {
    const res = (await client.action(evalRetrieve, {
      queryText: probe,
      limit: 8,
      rerankTopK: 8,
    })) as { baselineAPreRerank: Array<{ url: string; title: string }> };
    const years = new Set<number>();
    const urls: string[] = [];
    for (const c of res.baselineAPreRerank) {
      let p = c.url;
      try {
        p = decodeURIComponent(c.url);
      } catch {
        /* keep raw */
      }
      for (const m of `${p} ${c.title ?? ""}`.matchAll(YEAR)) years.add(Number(m[0]));
      urls.push(p.replace(/^https?:\/\/[^/]+/, "").slice(0, 66));
    }
    console.log(`\n=== probe "${probe}"  (capture showed: ${observed}) ===`);
    console.log(`  years anywhere in the 8 candidates: ${[...years].sort().join(", ") || "none"}`);
    for (const u of urls) console.log(`    ${u}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
