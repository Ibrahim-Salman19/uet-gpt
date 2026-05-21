import { describe, expect, it } from "vitest";

describe("messages api", () => {
  it("exports expected functions", async () => {
    const mod = await import("../../convex/messages");
    expect(mod.insert).toBeDefined();
    expect(typeof mod.insert).toBe("function");
    expect(mod.list).toBeDefined();
    expect(typeof mod.list).toBe("function");
  });
});
