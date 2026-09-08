/**
 * Per-table export for the Convex -> Convex migration (docs/SHIP.md Step 4).
 *
 * `npx convex export` has no per-table flag - it snapshots the whole
 * deployment (every table plus component storage, e.g. the ~183MB
 * @convex-dev/rag embeddings) in one server-side job. That OOM-killed the
 * local self-hosted backend container (exit 137) when attempted against the
 * 44,792-row crawledChunks table. This script instead pages through ONE
 * table at a time via convex/admin/tableExport.ts's exportTablePage query,
 * writing each page straight to disk as it arrives, so no single call ever
 * holds more than one page in memory.
 *
 * Output is JSONLines with raw _id/_creationTime preserved on every row,
 * matching `npx convex import --table <table> <file> --format jsonLines`'s
 * expected input - import is the only way to set pre-existing _id values
 * (Convex docs, confirmed via Context7), which is required so the Pinecone
 * corpus's stored documentId/chunkKey metadata keeps resolving after the
 * migration.
 *
 * Usage: npx tsx scripts/export_table.ts <table> [outDir] [pageSize]
 * Reads CONVEX_SELF_HOSTED_URL / CONVEX_SELF_HOSTED_ADMIN_KEY from
 * .env.local by default (the migration source is local dev, per
 * CLAUDE.md's "local Convex is the default target" policy).
 */
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const table = process.argv[2];
const outDir = process.argv[3] ?? path.join(process.cwd(), ".convex-tmp", "table-export");
const pageSize = Number(process.argv[4] ?? 200);

if (!table) {
  console.error("Usage: npx tsx scripts/export_table.ts <table> [outDir] [pageSize]");
  process.exit(1);
}

const deploymentUrl = process.env.CONVEX_SELF_HOSTED_URL;
const adminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY;
if (!deploymentUrl || !adminKey) {
  console.error("CONVEX_SELF_HOSTED_URL / CONVEX_SELF_HOSTED_ADMIN_KEY not set in .env.local");
  process.exit(1);
}

const exportTablePage = makeFunctionReference<"query">("admin/tableExport:exportTablePage");

// crawledChunks (large text rows) has been observed to take up to ~15s per
// page against the local self-hosted backend, occasionally exceeding it and
// returning a transient "too many system operations" server error (Docker
// health stayed green throughout - this is I/O latency, not the OOM that
// whole-DB `npx convex export` caused). Retry the SAME page rather than
// aborting the whole run on one slow call.
const MAX_RETRIES = 5;

async function queryPageWithRetry(
  client: ConvexHttpClient,
  args: { table: string; cursor: string | null; numItems: number },
): Promise<{ page: unknown[]; continueCursor: string | null; isDone: boolean }> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await client.query(exportTablePage, args);
    } catch (err) {
      lastErr = err;
      const backoffMs = 2000 * attempt;
      console.warn(`  retry ${attempt}/${MAX_RETRIES} after error, waiting ${backoffMs}ms:`, (err as Error).message?.split("\n")[0]);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastErr;
}

async function main() {
  const client = new ConvexHttpClient(deploymentUrl!);
  // setAdminAuth exists at runtime (same mechanism npx convex run uses) but
  // isn't in this convex version's public .d.ts, hence the cast.
  (client as unknown as { setAdminAuth(key: string): void }).setAdminAuth(adminKey!);

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${table}.jsonl`);
  const fh = fs.openSync(outPath, "w");

  let cursor: string | null = null;
  let pages = 0;
  let rows = 0;
  const started = Date.now();

  try {
    for (;;) {
      const result = await queryPageWithRetry(client, { table: table!, cursor, numItems: pageSize });

      for (const row of result.page) {
        fs.writeSync(fh, JSON.stringify(row) + "\n");
      }
      rows += result.page.length;
      pages += 1;

      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`[${table}] page ${pages}, ${rows} rows so far (${elapsed}s)`);

      if (result.isDone) break;
      cursor = result.continueCursor;
    }
  } finally {
    fs.closeSync(fh);
  }

  console.log(`[${table}] DONE - ${rows} rows, ${pages} pages -> ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
