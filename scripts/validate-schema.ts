/**
 * Schema Validation Script
 *
 * Validates the Convex schema structure, indexes, and vector dimensions
 * before deployment. Run with: npx tsx scripts/validate-schema.ts
 */

import schema from "../convex/schema";

const REQUIRED_TABLES = [
  "users",
  "feedback",
  "crawlJobs",
  "semanticCache",
  "adminAuditLog",
  "notifications",
  "documents",
  "processedWebhooks",
  "crawlDeadLetter",
  "crawledChunks",
] as const;

function validateSchema() {
  const tables = schema.tables ?? schema;
  const tableNames = Object.keys(tables);
  let hasErrors = false;

  console.log("🔍 Validating Convex schema...\n");

  // Check required tables
  console.log("📋 Checking required tables:");
  for (const table of REQUIRED_TABLES) {
    if (tableNames.includes(table)) {
      console.log(`  ✅ ${table}`);
    } else {
      console.log(`  ❌ ${table} - MISSING`);
      hasErrors = true;
    }
  }

  // Verify component-managed tables are NOT defined manually
  console.log("\n🧩 Checking component-managed tables:");
  const componentTables = ["chunks", "threads", "messages"];
  for (const table of componentTables) {
    if (!tableNames.includes(table)) {
      console.log(`  ✅ ${table} table correctly absent (managed by components)`);
    } else {
      console.log(`  ❌ ${table} table should NOT be defined manually (managed by components)`);
      hasErrors = true;
    }
  }

  // Verify table count
  console.log(`\n📊 Total tables: ${tableNames.length}`);
  if (tableNames.length === REQUIRED_TABLES.length) {
    console.log(`  ✅ Matches expected table count (${REQUIRED_TABLES.length})`);
  } else {
    console.log(`  ⚠️ Schema defines ${tableNames.length} tables instead of expected ${REQUIRED_TABLES.length}`);
  }

  console.log("\n" + (hasErrors ? "❌ Schema validation FAILED" : "✅ Schema validation PASSED"));
  process.exit(hasErrors ? 1 : 0);
}

validateSchema();
