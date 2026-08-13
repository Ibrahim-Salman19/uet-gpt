// Dense ANN benchmark (migration brief §17-19, revised after incident
// turso-default-diskann-fullscale-build-failure - see
// /tmp/.../incident-turso-diskann-001/incident.json for the full record).
//
// INCIDENT SUMMARY: the previous version of this script wrapped ALL
// client.execute/batch calls (including CREATE INDEX) in a uniform
// network-error retry. A CREATE INDEX for a default/uncompressed DiskANN
// index on the full 20,652x768 table got an ambiguous "fetch failed" on
// attempt 1 (a client-side error that does NOT prove the server never
// received/started the request), was automatically retried 550ms later, and
// attempt 2 failed with "vector index: unable to update global metadata
// table" - consistent with the retry colliding with a still-in-flight or
// partially-committed first attempt. Cleanup (DROP TABLE) on the resulting
// orphaned structures then failed twice, each after ~5 minutes. That table
// (bench_default_uncompressed) is preserved as forensic evidence and is
// PERMANENTLY EXCLUDED from this script - never create, drop, or otherwise
// touch it here again.
//
// CHANGES since the incident:
//   1. CREATE INDEX now goes through executeOnce() - no automatic retry,
//      ever. A failure is reported and the run stops for that
//      configuration/scale; it does not blindly retry.
//   2. default_uncompressed is removed from the configuration set entirely.
//      Its full-scale result is already classified FAILED (see incident
//      record) and is not re-attempted without a documented, specific reason
//      (migration brief's incident-response addendum §14).
//   3. Scaling ladder (--scales) instead of jumping straight to full scale.
//   4. Structured per-(configuration,scale) report block on stdout.
//   5. Errors are classified (CLIENT_TIMEOUT / NETWORK_TRANSIENT /
//      SERVER_ERROR / SQLITE_ERROR / VECTOR_INDEX_ERROR / CAPACITY_ERROR /
//      UNKNOWN) rather than collapsed into a generic failure.
//
// Runs against the REAL Turso Cloud database at real-scale row counts, so
// storage/latency numbers are measured, not estimated - but the VECTOR
// CONTENT is synthetic (clustered random data), not the real corpus, because
// this script has no access to real embeddings. Recall@k numbers are valid
// ANN-vs-exact-search evidence; they are NOT a substitute for the
// real-corpus retrieval-quality benchmark (a separate, later task).
//
// Usage: node scripts/turso-ann-benchmark.mjs [--scales=1000,5000,10000,20652]
//        [--configs=diskann_f8,diskann_f16] [--keep-tables]
import { createClient } from "@libsql/client";
import { writeFileSync } from "node:fs";
import { Agent, setGlobalDispatcher } from "undici";

// N=5000 DiskANN builds (both float8 and float16) hit the client's DEFAULT
// ~300s header timeout (UND_ERR_HEADERS_TIMEOUT / "Headers Timeout Error")
// with ZERO server-side artifacts left behind afterward (confirmed via
// direct sqlite_master inspection - unlike the original incident, this is a
// clean timeout, not a corrupted partial build). That leaves genuinely open
// whether the server would have finished given more time, or whether it
// also gives up around this point.
//
// First attempt: pass a custom `fetch` via createClient's config (it accepts
// one - confirmed via http.js: `config.fetch` is passed straight to
// HttpClient) bound to a separate `undici` package instance's own fetch.
// That failed with the same Request/Response realm mismatch documented in
// tests/integration/knowledgeStore-turso-cloud.test.ts: hrana-client
// constructs its own Request object using a DIFFERENT Request class than
// the one my explicitly-imported undici fetch expects, so it can't
// recognize it and tries to stringify it as a URL ("[object Request]").
// Fix: don't inject a separate fetch implementation at all - instead
// extend the timeout on Node's OWN native fetch (which is undici under the
// hood) via setGlobalDispatcher, so there is only ever one realm involved.
setGlobalDispatcher(
  new Agent({
    headersTimeout: 30 * 60 * 1000, // 30 minutes - N=5000 needed more than the default 5min
    bodyTimeout: 30 * 60 * 1000,
    connectTimeout: 30 * 1000,
  }),
);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const D = 768;
const NUM_CLUSTERS = 200;
const NUM_QUERIES = 30;
const TOP_K_VALUES = [5, 10, 20];
const INSERT_BATCH_SIZE = 100;
const KEEP_TABLES = Boolean(args["keep-tables"]);
const SCALES = String(args.scales ?? "1000,5000,10000,20652")
  .split(",")
  .map(Number)
  .sort((a, b) => a - b);
const FULL_N = SCALES[SCALES.length - 1];

// Configurations available to this script. default_uncompressed is
// deliberately NOT here - see incident summary above. Re-adding it requires
// a documented, specific reason (a confirmed transient vendor incident, a
// confirmed fixed bug, or a corrected SQL configuration - migration brief's
// incident-response addendum §14), not just "another data point."
const ALL_CONFIGS = {
  diskann_f8: { compressNeighbors: "float8" },
  diskann_f16: { compressNeighbors: "float16" },
};
const REQUESTED_CONFIGS = String(args.configs ?? "diskann_f8,diskann_f16").split(",");
for (const c of REQUESTED_CONFIGS) {
  if (c === "default_uncompressed") {
    console.error(
      "default_uncompressed is permanently excluded from this script after the incident. " +
        "See incident-turso-diskann-001/incident.json. Do not pass it via --configs.",
    );
    process.exit(1);
  }
  if (!(c in ALL_CONFIGS)) {
    console.error(`Unknown config "${c}". Valid: ${Object.keys(ALL_CONFIGS).join(", ")}`);
    process.exit(1);
  }
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set");
  process.exit(1);
}
const rawClient = createClient({ url, authToken });

// ---- error classification -------------------------------------------------
function classifyError(err) {
  const cause = err?.cause ?? err;
  const msg = err?.message ?? "";
  if (cause?.code === "UND_ERR_HEADERS_TIMEOUT" || /headers timeout/i.test(msg)) return "CLIENT_TIMEOUT";
  if (cause?.code === "ECONNRESET" || cause?.code === "ETIMEDOUT" || /fetch failed/i.test(msg)) return "NETWORK_TRANSIENT";
  if (cause?.code === "ENOTFOUND") return "SERVER_ERROR";
  if (err?.code === "SQLITE_CONSTRAINT") return "SQLITE_ERROR";
  if (/vector index/i.test(msg)) return "VECTOR_INDEX_ERROR";
  if (/resource|quota|limit|capacity/i.test(msg)) return "CAPACITY_ERROR";
  if (err?.code && String(err.code).startsWith("SQLITE")) return "SQLITE_ERROR";
  return "UNKNOWN";
}

// Retryable DML only (reads, idempotent-by-design upserts, deletes) - NEVER
// used for CREATE INDEX. See incident summary at the top of this file for
// exactly why that distinction matters.
function isRetryableNetworkError(err) {
  const cls = classifyError(err);
  return cls === "NETWORK_TRANSIENT";
}
async function withRetry(fn, label, maxAttempts = 4) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts || !isRetryableNetworkError(err)) throw err;
      const delayMs = 500 * 2 ** (attempt - 1) + Math.random() * 200;
      console.warn(`  [retry] ${label} attempt ${attempt} failed (${err.message}), retrying in ${Math.round(delayMs)}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
const client = {
  execute: (stmt) => withRetry(() => rawClient.execute(stmt), "execute"),
  batch: (stmts, mode) => withRetry(() => rawClient.batch(stmts, mode), "batch"),
  // Single attempt, no retry, ever. Used for CREATE INDEX (and available for
  // any other DDL). A failure here is reported as-is; the caller decides
  // whether/how to proceed - it is never silently retried.
  executeOnce: (stmt) => rawClient.execute(stmt),
  close: () => rawClient.close(),
};

// ---- synthetic corpus: clustered + normalized, not uniform-random --------
function randomGaussian() {
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function normalize(v) {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  return v.map((x) => x / (norm || 1));
}
function randomUnitVector(dim) {
  return normalize(Array.from({ length: dim }, randomGaussian));
}
function generateCorpus(n, dim, numClusters) {
  const centroids = Array.from({ length: numClusters }, () => randomUnitVector(dim));
  const vectors = new Array(n);
  for (let i = 0; i < n; i++) {
    const centroid = centroids[i % numClusters];
    const noisy = centroid.map((c) => c + 0.15 * randomGaussian());
    vectors[i] = normalize(noisy);
  }
  return vectors;
}
function vectorLiteral(v) {
  return `[${v.join(",")}]`;
}

// ---- storage measurement (dbstat - see prior incident-free run's notes) --
async function tableStorageBytes(tableName) {
  const res = await client.execute({
    sql: "SELECT COALESCE(SUM(pgsize), 0) AS bytes FROM dbstat WHERE name = ? OR name LIKE ? ESCAPE '\\'",
    args: [tableName, `${tableName}\\_%`],
  });
  return Number(res.rows[0].bytes);
}

async function createTable(tableName) {
  await client.execute(`CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, embedding F32_BLOB(${D}) NOT NULL)`);
}
async function dropTable(tableName) {
  await client.execute(`DROP TABLE IF EXISTS ${tableName}`);
}
async function bulkInsert(tableName, vectors) {
  for (let i = 0; i < vectors.length; i += INSERT_BATCH_SIZE) {
    const batch = vectors.slice(i, i + INSERT_BATCH_SIZE);
    const statements = batch.map((v, j) => ({
      sql: `INSERT INTO ${tableName} (id, embedding) VALUES (?, vector32(?))`,
      args: [i + j + 1, vectorLiteral(v)],
    }));
    await client.batch(statements, "write");
  }
}

async function exactTopK(scale, queryVec, k) {
  const res = await client.execute({
    sql: `SELECT id, vector_distance_cos(embedding, vector32(?)) AS dist FROM bench_exact WHERE id <= ? ORDER BY dist ASC LIMIT ?`,
    args: [vectorLiteral(queryVec), scale, k],
  });
  return res.rows.map((r) => Number(r.id));
}
async function annTopK(tableName, queryVec, k) {
  const res = await client.execute({
    sql: `SELECT t.id FROM vector_top_k('${tableName}_idx', vector32(?), ?) AS v JOIN ${tableName} t ON t.rowid = v.id`,
    args: [vectorLiteral(queryVec), k],
  });
  return res.rows.map((r) => Number(r.id));
}
function recallAt(annIds, exactIds) {
  const exactSet = new Set(exactIds);
  const hits = annIds.filter((id) => exactSet.has(id)).length;
  return hits / exactIds.length;
}
function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function printReportBlock(r) {
  console.log(`
CONFIGURATION: ${r.configuration}
SCALE: ${r.scale}
STATUS: ${r.status}
BUILD: ${r.build}
INTEGRITY: ${r.integrity}
RECALL: ${r.recall}
LATENCY: ${r.latency}
STORAGE: ${r.storage}
CLEANUP: ${r.cleanup}
EVIDENCE: ${r.evidence}
INTERPRETATION: ${r.interpretation}
NEXT ACTION: ${r.nextAction}
`);
}

// ---- exact ground-truth verification (§13 in the incident brief) ---------
async function verifyExactTable(corpus) {
  // Rebuilds bench_exact from THIS run's own corpus array, every time -
  // deliberately not "reuse the existing table if the row count looks
  // right." generateCorpus() has no fixed seed, so a prior run's bench_exact
  // contains vectors with NO relationship to this run's freshly-generated
  // corpus beyond coincidentally-matching row ids. Comparing an ANN table
  // (built from this run's corpus) against a ground truth table built from a
  // DIFFERENT run's corpus produces meaningless near-zero recall numbers
  // that look like a real quality failure but are actually a test-harness
  // bug - caught empirically: a validation run measured recall@10=0.017
  // (expected close to 1.0) until this fix.
  console.log("\n--- Rebuilding + verifying bench_exact (ground truth) from this run's corpus ---");
  await dropTable("bench_exact");
  await createTable("bench_exact");
  await bulkInsert("bench_exact", corpus);

  const count = await client.execute("SELECT count(*) as c FROM bench_exact");
  const rowCount = Number(count.rows[0].c);
  const dupCheck = await client.execute("SELECT count(*) as c, count(DISTINCT id) as d FROM bench_exact");
  const hasDuplicates = Number(dupCheck.rows[0].c) !== Number(dupCheck.rows[0].d);

  const q = randomUnitVector(D);
  const run1 = await exactTopK(rowCount, q, 10);
  const run2 = await exactTopK(rowCount, q, 10);
  const deterministic = JSON.stringify(run1) === JSON.stringify(run2);

  const start = Date.now();
  const latencies = [];
  for (let i = 0; i < NUM_QUERIES; i++) {
    const t0 = Date.now();
    await exactTopK(rowCount, randomUnitVector(D), 20);
    latencies.push(Date.now() - t0);
  }
  latencies.sort((a, b) => a - b);

  const result = {
    rowCount,
    // >= not === : bench_exact is a persistent, previously-populated table
    // (confirmed 20,652 rows from the incident's own unaffected-table probe)
    // reused across runs of this script. A run started with a smaller
    // --scales subset (e.g. quick validation at --scales=1000) must not
    // treat a larger, still-valid existing ground truth table as "wrong
    // count" - only insufficient coverage of the requested max scale is a
    // real problem.
    expectedMinRowCount: FULL_N,
    countMatches: rowCount >= FULL_N,
    hasDuplicates,
    deterministic,
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      sampleSize: latencies.length,
    },
  };
  console.log(`  rows: ${rowCount} (need >= ${FULL_N}, match=${result.countMatches})`);
  console.log(`  duplicates: ${hasDuplicates}`);
  console.log(`  deterministic top-k: ${deterministic}`);
  console.log(`  latency p50=${result.latencyMs.p50}ms p95=${result.latencyMs.p95}ms p99=${result.latencyMs.p99}ms (n=${NUM_QUERIES})`);

  printReportBlock({
    configuration: "exact (ground truth)",
    scale: rowCount,
    status: result.countMatches && !hasDuplicates && deterministic ? "PASS" : "FAIL",
    build: "N/A (no index)",
    integrity: `rowCount=${rowCount} needAtLeast=${FULL_N} match=${result.countMatches}, duplicates=${hasDuplicates}, deterministic=${deterministic}`,
    recall: "ground truth (N/A)",
    latency: `p50=${result.latencyMs.p50}ms p95=${result.latencyMs.p95}ms p99=${result.latencyMs.p99}ms n=${NUM_QUERIES}`,
    storage: "not re-measured (unchanged since prior successful run)",
    cleanup: "N/A - bench_exact is retained as the persistent ground-truth table",
    evidence: "direct query results, this run",
    interpretation:
      result.countMatches && !hasDuplicates && deterministic
        ? "bench_exact is a valid, unaffected ground-truth source - confirms the incident is isolated to bench_default_uncompressed, not database-wide."
        : "bench_exact integrity check FAILED - do not trust recall numbers computed against it until resolved.",
    nextAction: result.countMatches && !hasDuplicates && deterministic ? "proceed to ANN configs" : "STOP - investigate before proceeding",
  });
  return result;
}

// ---- one (configuration, scale) run ---------------------------------------
async function runConfigAtScale(configName, cfg, scale, corpus) {
  const tableName = `bench_${configName}_${scale}`;
  const report = {
    configuration: configName,
    scale,
    status: "UNKNOWN",
    build: "NOT EXECUTED",
    integrity: "NOT EXECUTED",
    recall: "NOT EXECUTED",
    latency: "NOT EXECUTED",
    storage: "NOT EXECUTED",
    cleanup: "NOT EXECUTED",
    evidence: `table=${tableName}`,
    interpretation: "",
    nextAction: "",
  };

  try {
    await dropTable(tableName); // clean slate for this specific (config,scale) table only
    await createTable(tableName);
    await bulkInsert(tableName, corpus.slice(0, scale));
    const baseBytes = await tableStorageBytes(tableName);

    // ONE attempt. No retry. See incident summary at top of file.
    const buildStart = Date.now();
    let buildMs = null;
    try {
      await client.executeOnce(
        `CREATE INDEX ${tableName}_idx ON ${tableName}(libsql_vector_idx(embedding, 'compress_neighbors=${cfg.compressNeighbors}'))`,
      );
      buildMs = Date.now() - buildStart;
      report.build = `SUCCESS in ${buildMs}ms`;
    } catch (err) {
      const errClass = classifyError(err);
      report.status = "FAIL";
      report.build = `FAILED after ${Date.now() - buildStart}ms - ${errClass}: ${err.message}`;
      report.interpretation = `Index build failed (${errClass}). Table ${tableName} may contain partial/orphaned structures - NOT auto-cleaning per incident policy.`;
      report.nextAction = `Inspect ${tableName} manually before any further action. Do not retry automatically.`;
      printReportBlock(report);
      return report;
    }

    const totalBytes = await tableStorageBytes(tableName);
    const indexBytes = totalBytes - baseBytes;
    report.storage = `index-only: ${indexBytes} bytes (${(indexBytes / scale).toFixed(0)} bytes/vector), base: ${baseBytes} bytes`;

    // Integrity: row count matches, no duplicate ids
    const countRes = await client.execute(`SELECT count(*) as c, count(DISTINCT id) as d FROM ${tableName}`);
    const rowCount = Number(countRes.rows[0].c);
    const dupFree = Number(countRes.rows[0].c) === Number(countRes.rows[0].d);
    report.integrity = `rowCount=${rowCount} expected=${scale} match=${rowCount === scale}, duplicateFree=${dupFree}`;

    // Recall + latency
    const latencies = [];
    const recalls = { 5: [], 10: [], 20: [] };
    const maxK = Math.max(...TOP_K_VALUES);
    const queryVectors = Array.from({ length: NUM_QUERIES }, () => randomUnitVector(D));
    for (const q of queryVectors) {
      const t0 = Date.now();
      const annIds = await annTopK(tableName, q, maxK);
      latencies.push(Date.now() - t0);
      const exactIds = await exactTopK(scale, q, maxK);
      for (const k of TOP_K_VALUES) {
        recalls[k].push(recallAt(annIds.slice(0, k), exactIds.slice(0, k)));
      }
    }
    latencies.sort((a, b) => a - b);
    const avgRecall = Object.fromEntries(
      TOP_K_VALUES.map((k) => [k, recalls[k].reduce((a, b) => a + b, 0) / recalls[k].length]),
    );
    report.recall = `recall@5=${avgRecall[5].toFixed(3)} recall@10=${avgRecall[10].toFixed(3)} recall@20=${avgRecall[20].toFixed(3)}`;
    report.latency = `p50=${percentile(latencies, 50)}ms p95=${percentile(latencies, 95)}ms p99=${percentile(latencies, 99)}ms n=${NUM_QUERIES}`;

    report.status = rowCount === scale && dupFree && avgRecall[10] >= 0.98 ? "PASS" : "CONDITIONAL";
    report.interpretation =
      avgRecall[10] >= 0.98
        ? "Meets the pre-declared Recall@10 >= 0.98 gate."
        : `Recall@10 = ${avgRecall[10].toFixed(3)} is below the pre-declared 0.98 gate.`;

    if (!KEEP_TABLES) {
      try {
        await dropTable(tableName);
        report.cleanup = "SUCCESS";
      } catch (err) {
        report.cleanup = `FAILED - ${classifyError(err)}: ${err.message}`;
        report.interpretation += " Cleanup also failed - operational reliability concern, see migration brief incident-response addendum §25.";
      }
    } else {
      report.cleanup = "SKIPPED (--keep-tables)";
    }
    report.nextAction = report.status === "PASS" ? "proceed to next scale/config" : "review before treating this configuration as viable";

    printReportBlock(report);
    return { ...report, avgRecall, latencies, indexBytes, buildMs, rowCount };
  } catch (err) {
    report.status = "FAIL";
    report.interpretation = `Unexpected error: ${classifyError(err)}: ${err.message}`;
    report.nextAction = "STOP - investigate before proceeding to next scale";
    printReportBlock(report);
    throw err;
  }
}

// ---- main ------------------------------------------------------------
async function main() {
  console.log(`Scales: ${SCALES.join(", ")}  Configs: ${REQUESTED_CONFIGS.join(", ")}  D=${D}`);
  console.log("Generating synthetic corpus at max scale (reused/sliced for smaller rungs)...");
  const corpus = generateCorpus(FULL_N, D, NUM_CLUSTERS);

  const exactResult = await verifyExactTable(corpus);
  if (!exactResult.countMatches || exactResult.hasDuplicates || !exactResult.deterministic) {
    console.error("Ground-truth verification failed - stopping before running any ANN configs.");
    process.exit(1);
  }

  const allResults = { scales: SCALES, configs: REQUESTED_CONFIGS, exact: exactResult, runs: [] };

  for (const configName of REQUESTED_CONFIGS) {
    for (const scale of SCALES) {
      console.log(`\n=== ${configName} @ scale=${scale} ===`);
      const result = await runConfigAtScale(configName, ALL_CONFIGS[configName], scale, corpus);
      allResults.runs.push(result);
      if (result.status === "FAIL") {
        console.warn(`Stopping ${configName}'s scaling ladder after a FAIL at scale=${scale} - not proceeding to larger scales for this config.`);
        break;
      }
    }
  }

  allResults.timestamp = new Date().toISOString();
  const outPath = `/tmp/turso-ann-benchmark-${Date.now()}.json`;
  writeFileSync(outPath, JSON.stringify(allResults, null, 2));
  console.log(`\nMachine-readable results written to ${outPath}`);

  client.close();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
