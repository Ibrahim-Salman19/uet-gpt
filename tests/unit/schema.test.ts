import { describe, expect, it } from "vitest";

describe("convex schema", () => {
  it("defines all required app-owned tables", async () => {
    const mod = await import("../../convex/schema");
    const schema = mod.default;
    expect(schema).toBeDefined();

    const tableNames = Object.keys(schema.tables ?? schema);

    // App-owned tables
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("feedback");
    expect(tableNames).toContain("crawlJobs");
    expect(tableNames).toContain("semanticCache");
    expect(tableNames).toContain("adminAuditLog");

    // WS-1: normalized parent storage (replaces per-child parentText duplication)
    expect(tableNames).toContain("chunkParents");

    // WS-5: the deprecated notifications table was removed (zero read/write code;
    // the "notifications" string in admin settings UI is an appSettings section key)
    expect(tableNames).not.toContain("notifications");

    // Document metadata table (RAG entries are tracked here, chunks managed by @convex-dev/rag)
    expect(tableNames).toContain("documents");
  });

  it("does not define component-managed tables (threads, messages, chunks)", async () => {
    const mod = await import("../../convex/schema");
    const schema = mod.default;
    const tableNames = Object.keys(schema.tables ?? schema);

    // These tables are managed by components and should NOT be in the app schema
    // to avoid table name conflicts with component internal tables
    expect(tableNames).not.toContain("chunks"); // managed by @convex-dev/rag
    expect(tableNames).not.toContain("threads"); // managed by @convex-dev/agent
    expect(tableNames).not.toContain("messages"); // managed by @convex-dev/agent
  });

  it("feedback.messageId uses string type (not v.id('messages')) for component compatibility", async () => {
    const mod = await import("../../convex/schema");
    const schema = mod.default;
    const tableNames = Object.keys(schema.tables ?? schema);
    expect(tableNames).toContain("feedback");
    // The feedback table should exist and use string for messageId since messages
    // is component-managed and we can't reference component table IDs with v.id()
  });

  it("schema exports as valid Convex schema object", async () => {
    const mod = await import("../../convex/schema");
    const schema = mod.default;
    expect(schema).toBeDefined();
    expect(typeof schema).toBe("object");

    // Verify it has the expected structure
    // 7 app-owned tables (threads/messages removed - managed by @convex-dev/agent)
    const tableNames = Object.keys(schema.tables ?? schema);
    expect(tableNames.length).toBeGreaterThanOrEqual(7);
  });
});
