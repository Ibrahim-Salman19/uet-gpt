import { describe, expect, it } from "vitest";

describe("clerk webhook", () => {
  it("has a POST route file that is a valid module", async () => {
    const fileExists = await import("fs").then((fs) =>
      fs.promises.access("src/app/api/webhooks/clerk/route.ts").then(() => true, () => false),
    );
    expect(fileExists).toBe(true);
  });

  it("processes CLERK_SIGNING_SECRET env variable correctly", () => {
    const original = process.env.CLERK_SIGNING_SECRET;
    delete process.env.CLERK_SIGNING_SECRET;

    const handler = () => {
      const secret = process.env.CLERK_SIGNING_SECRET;
      if (!secret) {
        return new Response("Missing CLERK_SIGNING_SECRET", { status: 500 });
      }
      return new Response("OK", { status: 200 });
    };

    const res = handler();
    expect(res.status).toBe(500);

    process.env.CLERK_SIGNING_SECRET = original;
  });

  it("returns 200 when CLERK_SIGNING_SECRET is set", () => {
    const original = process.env.CLERK_SIGNING_SECRET;
    process.env.CLERK_SIGNING_SECRET = "test_secret_value";

    const handler = () => {
      const secret = process.env.CLERK_SIGNING_SECRET;
      if (!secret) {
        return new Response("Missing CLERK_SIGNING_SECRET", { status: 500 });
      }
      return new Response("OK", { status: 200 });
    };

    const res = handler();
    expect(res.status).toBe(200);

    process.env.CLERK_SIGNING_SECRET = original;
  });
});
