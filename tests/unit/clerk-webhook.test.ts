import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Mock svix so we can drive verify() behavior deterministically ---
const verifyMock = vi.fn();
vi.mock("svix", () => ({
  Webhook: class {
    verify(...args: unknown[]) {
      return verifyMock(...args);
    }
  },
}));

// --- Mock next/headers so we control the incoming svix-* headers ---
const headerStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (name: string) => headerStore.get(name) ?? null,
  })),
}));

import { POST } from "../../src/app/api/webhooks/clerk/route";

function setSvixHeaders(headers: Record<string, string | null>) {
  headerStore.clear();
  for (const [k, v] of Object.entries(headers)) {
    if (v !== null) headerStore.set(k, v);
  }
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/webhooks/clerk", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID_HEADERS = {
  "svix-id": "msg_123",
  "svix-timestamp": "1700000000",
  "svix-signature": "v1,abcdef",
};

describe("clerk webhook POST handler", () => {
  beforeEach(() => {
    vi.stubEnv("CLERK_SIGNING_SECRET", "whsec_test_signing_secret");
    vi.stubEnv("CLERK_WEBHOOK_SECRET", "convex_bearer_secret");
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
    setSvixHeaders(VALID_HEADERS);
    verifyMock.mockReset();
    // Default: fetch to Convex succeeds.
    global.fetch = vi.fn(async () => new Response("ok", { status: 200 })) as any;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("has a POST route file that is a valid module", async () => {
    expect(typeof POST).toBe("function");
  });

  it("returns 500 when CLERK_SIGNING_SECRET is missing", async () => {
    vi.stubEnv("CLERK_SIGNING_SECRET", "");

    const res = await POST(makeRequest({ type: "user.created", data: {} }));

    expect(res.status).toBe(500);
    expect(verifyMock).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    "svix-id",
    "svix-timestamp",
    "svix-signature",
  ])("returns 400 when the %s header is missing", async (missing) => {
    setSvixHeaders({ ...VALID_HEADERS, [missing]: null });

    const res = await POST(makeRequest({ type: "user.created", data: {} }));

    expect(res.status).toBe(400);
    expect(verifyMock).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 400 and does not forward when signature verification throws", async () => {
    verifyMock.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const res = await POST(makeRequest({ type: "user.created", data: {} }));

    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("verifies the RAW request body (not a re-stringified object)", async () => {
    // Body with whitespace that JSON.stringify(JSON.parse(...)) would collapse.
    const rawBody = '{\n  "type":  "user.created",\n  "data": { "id": "user_1" }\n}';
    verifyMock.mockReturnValue({ type: "user.created", data: { id: "user_1" } });

    await POST(makeRequest(rawBody));

    expect(verifyMock).toHaveBeenCalledTimes(1);
    // First arg passed to verify must be the exact raw text we received.
    expect(verifyMock.mock.calls[0][0]).toBe(rawBody);
    expect(verifyMock.mock.calls[0][1]).toEqual({
      "svix-id": "msg_123",
      "svix-timestamp": "1700000000",
      "svix-signature": "v1,abcdef",
    });
  });

  it.each([
    "user.created",
    "user.updated",
    "user.deleted",
  ])("forwards a valid %s event to Convex and returns 200", async (eventType) => {
    const evt = { type: eventType, data: { id: "user_42" } };
    verifyMock.mockReturnValue(evt);

    const res = await POST(makeRequest(evt));

    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe("https://example.convex.site/api/webhook/clerk");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer convex_bearer_secret");
    expect(JSON.parse(init.body)).toEqual(evt);
  });

  it("returns 500 when CLERK_WEBHOOK_SECRET (Convex bearer) is missing", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SECRET", "");
    verifyMock.mockReturnValue({ type: "user.created", data: {} });

    const res = await POST(makeRequest({ type: "user.created", data: {} }));

    expect(res.status).toBe(500);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 502 when the downstream Convex sync fails", async () => {
    verifyMock.mockReturnValue({ type: "user.created", data: {} });
    global.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as any;

    const res = await POST(makeRequest({ type: "user.created", data: {} }));

    expect(res.status).toBe(502);
  });
});
