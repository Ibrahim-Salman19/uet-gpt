import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../convex/_generated/server", () => ({
  httpAction: (fn: Function) => ({ handler: fn }),
}));

import { crawlWebhook } from "../../convex/crawl/webhook";

const WEBHOOK_SECRET =
  process.env.WEBHOOK_SECRET ||
  process.env.CRAWL_WEBHOOK_SECRET ||
  "dummy-webhook-secret-for-tests-12345";
process.env.CRAWL_WEBHOOK_SECRET = WEBHOOK_SECRET;

function generateSignature(timestamp: string, body: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

function createMockCtx() {
  let webhookProcessed = false;
  return {
    runMutation: vi.fn().mockImplementation(async (ref: any, args: any) => {
      let refName = "";
      if (typeof ref === "string") {
        refName = ref;
      } else if (ref && (typeof ref === "object" || typeof ref === "function")) {
        const sym = Symbol.for("functionName");
        try {
          if (sym in ref && typeof ref[sym] === "string") {
            refName = ref[sym];
          } else if ("name" in ref && typeof ref.name === "string") {
            refName = ref.name;
          } else {
            refName = Object.prototype.toString.call(ref);
          }
        } catch (e) {
          refName = "";
        }
      }
      if (refName && refName.includes("markWebhookProcessed")) {
        if (webhookProcessed) return false;
        webhookProcessed = true;
        return true;
      }
      return null;
    }),
    runQuery: vi.fn().mockResolvedValue(null), // null means not processed
  };
}

describe("Crawl Webhook Integration & Load Testing", () => {
  let ctx: any;

  beforeEach(() => {
    vi.resetAllMocks();
    ctx = createMockCtx();
  });

  it("rejects payloads that exceed 10MB", async () => {
    const timestamp = Date.now().toString();
    // Webhook checks content-length against 10_485_760 (10MB)
    const signature = generateSignature(timestamp, "x".repeat(10_485_761), WEBHOOK_SECRET);

    const request = {
      url: "http://localhost/webhook",
      text: async () => "x".repeat(10_485_761),
      arrayBuffer: async () => new TextEncoder().encode("x".repeat(10_485_761)).buffer,
      headers: {
        get: (key: string) => {
          if (key.toLowerCase() === "content-length") return "10485761"; // >10MB
          if (key === "x-crawl-timestamp") return timestamp;
          if (key === "x-crawl-signature") return signature;
          return null;
        },
      },
    };

    const response = await (crawlWebhook as any).handler(ctx, request as any);
    expect(response.status).toBe(413);
  });

  it("rejects invalid HMAC signatures (Timing Attack Resistance)", async () => {
    const timestamp = Date.now().toString();
    const body = JSON.stringify({ job_id: "test", data: [] });
    const signature = generateSignature(timestamp, body, "wrong-secret-123");

    const request = {
      url: "http://localhost/webhook",
      text: async () => JSON.stringify({ job_id: "test", data: [] }),
      arrayBuffer: async () =>
        new TextEncoder().encode(JSON.stringify({ job_id: "test", data: [] })).buffer,
      headers: {
        get: (key: string) => {
          if (key === "x-crawl-timestamp") return timestamp;
          if (key === "x-crawl-signature") return signature;
          return null;
        },
      },
    };

    const response = await (crawlWebhook as any).handler(ctx, request as any);
    expect(response.status).toBe(401);
  });

  it("rejects replay attacks via expired timestamps", async () => {
    const expiredTimestamp = (Date.now() - 5 * 60 * 60 * 1000).toString(); // 5 hours ago
    const body = JSON.stringify({ job_id: "test", data: [] });
    const signature = generateSignature(expiredTimestamp, body, WEBHOOK_SECRET);

    const request = {
      url: "http://localhost/webhook",
      text: async () => JSON.stringify({ job_id: "test", data: [] }),
      arrayBuffer: async () =>
        new TextEncoder().encode(JSON.stringify({ job_id: "test", data: [] })).buffer,
      headers: {
        get: (key: string) => {
          if (key === "x-crawl-timestamp") return expiredTimestamp;
          if (key === "x-crawl-signature") return signature;
          return null;
        },
      },
    };

    const response = await (crawlWebhook as any).handler(ctx, request as any);
    expect(response.status).toBe(400);
  });

  it("processes large legitimate payloads and queues chunks idempotently", async () => {
    let massiveMarkdown = "# Massive Page\n\n";
    for (let i = 0; i < 50; i++) {
      massiveMarkdown +=
        `## Section ${i}\nThis is paragraph ${i} with a lot of text to force chunking. `.repeat(
          20,
        ) + "\n\n";
    }

    // Webhook reads: payload.data?.results || payload.results || (payload.url ? [payload] : [])
    // Use an ON-DOMAIN (uettaxila.edu.pk) URL so the page actually passes the
    // allowlist and the chunk-queuing path is genuinely exercised. (Off-domain
    // ingestion is covered by the dedicated allowlist test below.)
    const payload = {
      job_id: "massive-job-001",
      status: "completed",
      results: [
        {
          url: "https://web.uettaxila.edu.pk/massive-page",
          markdown: massiveMarkdown,
          metadata: { title: "Massive Page" },
        },
      ],
    };

    const timestamp = Date.now().toString();
    const signature = generateSignature(timestamp, JSON.stringify(payload), WEBHOOK_SECRET);

    const request = {
      url: "http://localhost/webhook",
      text: async () => JSON.stringify(payload),
      arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(payload)).buffer,
      headers: {
        get: (key: string) => {
          if (key.toLowerCase() === "content-length") return "50000";
          if (key === "x-crawl-timestamp") return timestamp;
          if (key === "x-crawl-signature") return signature;
          return null;
        },
      },
    };

    const response = await (crawlWebhook as any).handler(ctx, request as any);
    expect(response.status).toBe(200);

    // Verify markWebhookProcessed was called with the job id
    const mutationCalls: any[] = ctx.runMutation.mock.calls;
    const processedCall = mutationCalls.find(
      (c: any[]) => c[1] && c[1].jobId === "massive-job-001",
    );
    expect(processedCall).toBeDefined();

    // The on-domain page must actually be chunked + queued for embedding.
    const queuedCall = mutationCalls.find(
      (c: any[]) => c[1] && Array.isArray(c[1].chunks) && c[1].url?.includes("uettaxila.edu.pk"),
    );
    expect(queuedCall).toBeDefined();

    // Second webhook delivery - mark-first pattern prevents race condition
    ctx.runQuery.mockResolvedValue(null);
    ctx.runMutation.mockResolvedValue(undefined);

    const dedupResponse = await (crawlWebhook as any).handler(ctx, request as any);
    expect(dedupResponse.status).toBe(200);

    const resText = await dedupResponse.text();
    const result = JSON.parse(resText);
    expect(result.ok).toBe(true);
  }, 30000);

  it("enforces the domain allowlist: off-domain pages are skipped, not ingested", async () => {
    // SECURITY (OWASP LLM01 - ingestion poisoning): crawlWebhook must NOT
    // chunk/embed pages from domains outside uettaxila.edu.pk, even when the
    // signature is valid. The job is still acknowledged (200), but no chunks
    // are queued for the off-domain page. This pins the allowlist contract so a
    // regression that drops isAllowedHost() is caught.
    const payload = {
      job_id: "off-domain-job-001",
      status: "completed",
      results: [
        {
          url: "https://wikipedia.org/wiki/Massive_Page",
          markdown: "# Wikipedia\n\nThis off-domain content should never be ingested into the KB.",
          metadata: { title: "Massive Page" },
        },
      ],
    };

    const body = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const signature = generateSignature(timestamp, body, WEBHOOK_SECRET);

    const request = {
      url: "http://localhost/webhook",
      text: async () => body,
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
      headers: {
        get: (key: string) => {
          if (key.toLowerCase() === "content-length") return String(body.length);
          if (key === "x-crawl-timestamp") return timestamp;
          if (key === "x-crawl-signature") return signature;
          return null;
        },
      },
    };

    const response = await (crawlWebhook as any).handler(ctx, request as any);
    expect(response.status).toBe(200);

    // No chunks must have been queued for the off-domain URL.
    const mutationCalls: any[] = ctx.runMutation.mock.calls;
    const queuedOffDomain = mutationCalls.find((c: any[]) => c[1] && Array.isArray(c[1].chunks));
    expect(queuedOffDomain).toBeUndefined();
  }, 30000);
});
