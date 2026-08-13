// One-off empirical verification of libSQL SQL surface (F32_BLOB, vector
// functions, libsql_vector_idx/vector_top_k, FTS5) against a LOCAL file
// database. Local-file mode uses the same libSQL engine/SQL dialect as Turso
// Cloud (docs.turso.tech: "develop locally with file:local.db, then change
// the URL to libsql://... for production — no code changes needed"), so this
// is real execution evidence, not documentation trust, for everything except
// Cloud-specific transport behavior (HTTP batch()-only semantics, network
// latency, the open TS-client FTS5-insert bug — those need a real Cloud DB).
//
// Usage:
//   node scripts/turso-capability-check.mjs <path-to-scratch-db>   (local file mode)
//   node scripts/turso-capability-check.mjs --cloud                (real Turso Cloud,
//     reads TURSO_DATABASE_URL / TURSO_AUTH_TOKEN from the environment)
import { createClient } from "@libsql/client";
import { unlinkSync, existsSync } from "node:fs";

const arg = process.argv[2];
if (!arg) {
  console.error(
    "usage: node scripts/turso-capability-check.mjs <path-to-scratch-db> | --cloud",
  );
  process.exit(1);
}

let client;
if (arg === "--cloud") {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error("TURSO_DATABASE_URL is not set");
    process.exit(1);
  }
  client = createClient({ url, authToken });
  // Cloud DB persists between runs (unlike a freshly-deleted local file) -
  // drop anything a prior run of this script left behind so it's rerun-safe.
  for (const stmt of [
    "DROP TABLE IF EXISTS test_vectors",
    "DROP TABLE IF EXISTS test_vectors2",
    "DROP TABLE IF EXISTS test_fts",
    "DROP TABLE IF EXISTS test_fts_ext",
    "DROP TABLE IF EXISTS upsert_test",
    "DROP TABLE IF EXISTS unique_test",
    "DROP TABLE IF EXISTS atomic_test",
  ]) {
    await client.execute(stmt);
  }
} else {
  const dbPath = arg;
  for (const suffix of ["", "-wal", "-shm"]) {
    if (existsSync(dbPath + suffix)) unlinkSync(dbPath + suffix);
  }
  client = createClient({ url: `file:${dbPath}` });
}

const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`PASS  ${name}${detail ? " — " + detail : ""}`);
  } catch (err) {
    results.push({ name, ok: false, detail: String(err?.message ?? err) });
    console.log(`FAIL  ${name} — ${String(err?.message ?? err)}`);
  }
}

const D = 8; // small test dimension, not 768 — this is a syntax/behavior check, not a scale test
function vecLiteral(values) {
  return `[${values.join(",")}]`;
}

await check("CREATE TABLE with F32_BLOB column", async () => {
  await client.execute(`CREATE TABLE test_vectors (id INTEGER PRIMARY KEY, embedding F32_BLOB(${D}))`);
});

await check("INSERT via vector32() function", async () => {
  await client.execute({
    sql: "INSERT INTO test_vectors (id, embedding) VALUES (1, vector32(?)), (2, vector32(?)), (3, vector32(?))",
    args: [
      vecLiteral([1, 0, 0, 0, 0, 0, 0, 0]),
      vecLiteral([0, 1, 0, 0, 0, 0, 0, 0]),
      vecLiteral([0.9, 0.1, 0, 0, 0, 0, 0, 0]),
    ],
  });
});

await check("vector_distance_cos scalar function", async () => {
  const res = await client.execute({
    sql: "SELECT id, vector_distance_cos(embedding, vector32(?)) AS dist FROM test_vectors ORDER BY dist ASC",
    args: [vecLiteral([1, 0, 0, 0, 0, 0, 0, 0])],
  });
  return JSON.stringify(res.rows);
});

await check("CREATE INDEX libsql_vector_idx (default config)", async () => {
  await client.execute(
    "CREATE INDEX test_vectors_idx ON test_vectors(libsql_vector_idx(embedding))",
  );
});

await check("CREATE INDEX libsql_vector_idx with compress_neighbors=float8", async () => {
  await client.execute(
    "CREATE TABLE test_vectors2 (id INTEGER PRIMARY KEY, embedding F32_BLOB(8))",
  );
  await client.execute(
    "CREATE INDEX test_vectors2_idx ON test_vectors2(libsql_vector_idx(embedding, 'compress_neighbors=float8'))",
  );
});

await check("vector_top_k ANN query against the index", async () => {
  const res = await client.execute({
    sql: "SELECT t.id FROM vector_top_k('test_vectors_idx', vector32(?), 2) AS v JOIN test_vectors t ON t.rowid = v.id",
    args: [vecLiteral([1, 0, 0, 0, 0, 0, 0, 0])],
  });
  return JSON.stringify(res.rows);
});

await check("CREATE VIRTUAL TABLE ... USING fts5 (standalone, not external-content)", async () => {
  await client.execute(
    "CREATE VIRTUAL TABLE test_fts USING fts5(chunk_text)",
  );
});

await check("FTS5 insert via execute() (single statement)", async () => {
  await client.execute({
    sql: "INSERT INTO test_fts (rowid, chunk_text) VALUES (?, ?)",
    args: [1, "Admissions fee structure for undergraduate programs"],
  });
});

await check("FTS5 insert via batch() (mirrors production write path)", async () => {
  await client.batch(
    [
      { sql: "INSERT INTO test_fts (rowid, chunk_text) VALUES (?, ?)", args: [2, "Electrical engineering course description"] },
      { sql: "INSERT INTO test_fts (rowid, chunk_text) VALUES (?, ?)", args: [3, "Hostel and transport services overview"] },
    ],
    "write",
  );
});

await check("FTS5 MATCH query", async () => {
  const res = await client.execute({
    sql: "SELECT rowid, chunk_text FROM test_fts WHERE test_fts MATCH ? ORDER BY rank",
    args: ["admissions fee"],
  });
  return JSON.stringify(res.rows);
});

await check("FTS5 external-content table (content=, content_rowid=)", async () => {
  await client.execute(
    "CREATE VIRTUAL TABLE test_fts_ext USING fts5(chunk_text, content='test_vectors', content_rowid='id')",
  );
});

await check("batch() atomicity: multi-statement all-or-nothing", async () => {
  await client.execute("CREATE TABLE atomic_test (id INTEGER PRIMARY KEY, val TEXT UNIQUE)");
  let rolledBack = false;
  try {
    await client.batch(
      [
        { sql: "INSERT INTO atomic_test (id, val) VALUES (1, 'a')" },
        { sql: "INSERT INTO atomic_test (id, val) VALUES (2, 'a')" }, // UNIQUE violation - should abort the whole batch
      ],
      "write",
    );
  } catch {
    rolledBack = true;
  }
  const res = await client.execute("SELECT count(*) as c FROM atomic_test");
  const count = res.rows[0].c;
  if (!rolledBack || count !== 0) {
    throw new Error(`expected full rollback (count=0), got rolledBack=${rolledBack} count=${count}`);
  }
  return `confirmed: failed statement rolled back the entire batch (count=${count})`;
});

await check("ON CONFLICT DO UPDATE ... RETURNING (upsert pattern)", async () => {
  await client.execute(
    "CREATE TABLE upsert_test (id INTEGER PRIMARY KEY, key TEXT UNIQUE, val TEXT)",
  );
  const first = await client.execute({
    sql: "INSERT INTO upsert_test (key, val) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET val=excluded.val RETURNING id",
    args: ["k1", "v1"],
  });
  const second = await client.execute({
    sql: "INSERT INTO upsert_test (key, val) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET val=excluded.val RETURNING id",
    args: ["k1", "v2"],
  });
  const firstId = first.rows[0].id;
  const secondId = second.rows[0].id;
  if (firstId !== secondId) throw new Error(`expected same id on conflict, got ${firstId} vs ${secondId}`);
  return `stable id=${firstId} across insert-then-conflict-update`;
});

await check("DELETE + INSERT into FTS5 UNINDEXED column filter (upsert emulation)", async () => {
  await client.execute({
    sql: "DELETE FROM test_fts WHERE chunk_text = ?",
    args: ["Admissions fee structure for undergraduate programs"],
  });
  const res = await client.execute({
    sql: "SELECT count(*) as c FROM test_fts WHERE rowid = 1",
  });
  return `remaining rowid=1 rows after delete: ${res.rows[0].c}`;
});

await check("UNIQUE constraint violation surfaces as a catchable error (not a silent no-op)", async () => {
  await client.execute("CREATE TABLE unique_test (id INTEGER PRIMARY KEY, u TEXT UNIQUE)");
  await client.execute({ sql: "INSERT INTO unique_test (u) VALUES (?)", args: ["x"] });
  let threw = false;
  try {
    await client.execute({ sql: "INSERT INTO unique_test (u) VALUES (?)", args: ["x"] });
  } catch (err) {
    threw = true;
    return `caught: ${err?.code ?? err?.message ?? err}`;
  }
  if (!threw) throw new Error("expected a UNIQUE constraint error, none thrown");
});

console.log("\n--- summary ---");
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("FAILED:", failed.map((f) => f.name).join(", "));
}

client.close();
process.exit(failed.length ? 1 : 0);
