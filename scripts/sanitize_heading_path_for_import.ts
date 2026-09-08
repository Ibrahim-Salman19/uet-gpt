/**
 * One-off pre-import cleanup for a real, pre-existing bug found while
 * investigating the Step 4 migration (2026-09-05): convex/crawl/chunking.ts's
 * generateChunks sometimes pushes body markdown into `headingPath` instead of
 * a short heading title (e.g. a 17KB table-of-links ending up as a single
 * "heading"). Verified against the full local export
 * (.convex-tmp/table-export/crawledChunks.jsonl): 19,349/44,792 rows (43%)
 * across 1,505/1,891 documents (80%) have at least one headingPath entry over
 * 200 bytes, adding ~155MB of storage - more than the 93MB of actual chunk
 * text - which would meaningfully eat into the free-tier quota on whatever
 * Convex deployment this gets imported into (the same quota ceiling that
 * disabled adamant-stork-623 in the first place).
 *
 * This does NOT fix the chunking bug (convex/crawl/chunking.ts) or touch the
 * live local deployment or Pinecone (Pinecone's metadata never carried
 * headingPath - confirmed in pineconeAdapter.ts - so it is unaffected
 * either way). It only cleans the exported JSONL before import: any
 * headingPath entry over the threshold is dropped, since a legitimate
 * section-heading title is never that long and the alternative (truncating
 * mid-string) would leave garbled fragments visible in citations.
 *
 * Usage: npx tsx scripts/sanitize_heading_path_for_import.ts <in.jsonl> <out.jsonl>
 */
import * as fs from "fs";
import * as readline from "readline";

const MAX_HEADING_BYTES = 200;

const inPath = process.argv[2];
const outPath = process.argv[3];
if (!inPath || !outPath) {
  console.error("Usage: npx tsx scripts/sanitize_heading_path_for_import.ts <in.jsonl> <out.jsonl>");
  process.exit(1);
}

async function main() {
  const rl = readline.createInterface({ input: fs.createReadStream(inPath!) });
  const out = fs.createWriteStream(outPath!);

  let total = 0;
  let rowsChanged = 0;
  let entriesDropped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    total += 1;
    const row = JSON.parse(line);
    const headingPath: unknown = row.headingPath;
    if (Array.isArray(headingPath)) {
      const cleaned = headingPath.filter(
        (h) => typeof h === "string" && Buffer.byteLength(h, "utf8") <= MAX_HEADING_BYTES,
      );
      if (cleaned.length !== headingPath.length) {
        entriesDropped += headingPath.length - cleaned.length;
        rowsChanged += 1;
        row.headingPath = cleaned;
      }
    }
    out.write(JSON.stringify(row) + "\n");
  }
  out.end();

  console.log(`total rows: ${total}`);
  console.log(`rows with a dropped headingPath entry: ${rowsChanged}`);
  console.log(`entries dropped: ${entriesDropped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
