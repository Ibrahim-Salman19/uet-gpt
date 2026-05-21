import { describe, expect, it } from "vitest";

describe("threads api", () => {
  it("exports expected functions", async () => {
    const mod = await import("../../convex/threads");
    expect(mod.create).toBeDefined();
    expect(typeof mod.create).toBe("function");
    expect(mod.list).toBeDefined();
    expect(typeof mod.list).toBe("function");
    expect(mod.rename).toBeDefined();
    expect(typeof mod.rename).toBe("function");
    expect(mod.remove).toBeDefined();
    expect(typeof mod.remove).toBe("function");
  });
});
