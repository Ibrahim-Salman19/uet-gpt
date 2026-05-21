import { describe, expect, it } from "vitest";

describe("clerk webhook", () => {
  it("exports POST handler", async () => {
    const mod = await import("../../src/app/api/webhooks/clerk/route");
    expect(mod.POST).toBeDefined();
    expect(typeof mod.POST).toBe("function");
  });

  it("POST is async function", async () => {
    const mod = await import("../../src/app/api/webhooks/clerk/route");
    expect(mod.POST.constructor.name).toBe("AsyncFunction");
  });

  it("POST returns 500 when CLERK_SIGNING_SECRET is missing", async () => {
    const mod = await import("../../src/app/api/webhooks/clerk/route");
    const original = process.env.CLERK_SIGNING_SECRET;
    delete process.env.CLERK_SIGNING_SECRET;
    try {
      const res = await mod.POST(new Request("http://localhost"));
      expect(res).toBeInstanceOf(Response);
      expect(res.status).toBe(500);
    } finally {
      process.env.CLERK_SIGNING_SECRET = original;
    }
  });
});
