/**
 * stale_cleanup.js
 * 
 * Run after a full crawl to mark and purge stale (deleted) university pages.
 * 
 * Usage:
 *   node scripts/stale_cleanup.js <SESSION_ID>
 * 
 * The session ID is printed at the end of master_crawler.py output.
 */

const { execSync } = require("child_process");

const sessionId = process.argv[2];
if (!sessionId) {
  console.error("[ERROR] Usage: node scripts/stale_cleanup.js <SESSION_ID>");
  process.exit(1);
}

console.log(`\n=== Stale Cleanup for session: ${sessionId} ===\n`);

// ── Step 1: Mark stale documents in batches ────────────────────────────────
console.log("[Step 1] Marking stale documents (batched)...");
let markIteration = 1;
let totalMarked = 0;
while (true) {
  try {
    const output = execSync(
      `npx convex run crawl/mutations:markStaleDocuments "${JSON.stringify({ crawlSessionId: sessionId })}"`,
      { encoding: "utf8" }
    ).trim();
    const res = JSON.parse(output);
    totalMarked += res.marked || 0;
    console.log(`  Batch ${markIteration}: marked=${res.marked}, remaining=${res.remaining}`);
    if (res.remaining === "done") break;
    markIteration++;
  } catch (err) {
    console.error("[ERROR] markStaleDocuments failed:", err.message);
    if (err.stdout) console.error("stdout:", err.stdout);
    break;
  }
}
console.log(`[Step 1] Done. Total marked stale: ${totalMarked}\n`);

// ── Step 2: Purge stale documents in batches ──────────────────────────────
console.log("[Step 2] Purging stale documents (batched)...");
let purgeIteration = 1;
let totalPurged = 0;
while (true) {
  try {
    const output = execSync(
      `npx convex run crawl/mutations:purgeStaleDocuments "{}"`,
      { encoding: "utf8" }
    ).trim();
    const res = JSON.parse(output);
    totalPurged += res.purged || 0;
    console.log(`  Batch ${purgeIteration}: purged=${res.purged}, remaining=${res.remaining}`);
    if (res.remaining === "done") break;
    purgeIteration++;
  } catch (err) {
    console.error("[ERROR] purgeStaleDocuments failed:", err.message);
    if (err.stdout) console.error("stdout:", err.stdout);
    break;
  }
}
console.log(`[Step 2] Done. Total purged: ${totalPurged}\n`);

console.log(`=== Stale cleanup complete ===`);
console.log(`  Marked : ${totalMarked}`);
console.log(`  Purged : ${totalPurged}`);
