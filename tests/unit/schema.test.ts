import { describe, expect, it } from "vitest";

describe("convex schema", () => {
  it("defines all required tables", async () => {
    const mod = await import("../../convex/schema");
    const schema = mod.default;
    expect(schema).toBeDefined();

    const tableNames = Object.keys(schema.tables ?? schema);
    expect(tableNames).toContain("documents");
    expect(tableNames).toContain("chunks");
    expect(tableNames).toContain("threads");
    expect(tableNames).toContain("messages");
    expect(tableNames).toContain("users");
  });
});
