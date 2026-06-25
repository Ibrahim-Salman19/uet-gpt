import { createHmac } from "crypto";

interface WebhookDataItem {
  url: string;
  markdown: string;
  metadata: { title: string };
}

interface WebhookPayload {
  job_id: string;
  status: string;
  data: WebhookDataItem[];
}

interface WebhookResponse {
  status: number;
  text: string;
}

// The crawl webhook (convex/crawl/webhook.ts) signs `${timestamp}.${rawBody}`,
// matching tests/convex/crawl/webhook.test.ts. Signing the timestamp alone
// produced an invalid signature, so every non-safe-mode request was rejected
// with 401. Sign over the timestamp AND the exact serialized body.
function generateSignature(timestamp: string, rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

function generateMarkdown(paragraphs: number): string {
  let md = "# Stress Test Document\n\n";
  for (let i = 0; i < paragraphs; i++) {
    md += `## Section ${i}\n`;
    md +=
      `This is paragraph ${i}. We are generating a large amount of text to simulate a realistic web page crawl. `.repeat(
        10,
      ) + "\n\n";
  }
  return md;
}

async function sendWebhookRequest(
  jobId: string,
  url: string,
  content: string,
  convexSiteUrl: string,
  webhookSecret: string,
): Promise<WebhookResponse> {
  const timestamp = Date.now().toString();

  const payload: WebhookPayload = {
    job_id: jobId,
    status: "completed",
    data: [
      {
        url: url,
        markdown: content,
        metadata: { title: `Stress Test - ${url}` },
      },
    ],
  };

  // Serialize once and sign the exact bytes we send, so the server's
  // HMAC-over-raw-body verification matches.
  const rawBody = JSON.stringify(payload);
  const signature = generateSignature(timestamp, rawBody, webhookSecret);

  const response = await fetch(`${convexSiteUrl}/api/webhook/crawl`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-crawl-timestamp": timestamp,
      "x-crawl-signature": signature,
    },
    body: rawBody,
  });

  return { status: response.status, text: await response.text() };
}

export interface LoadTestConfig {
  convexSiteUrl: string;
  webhookSecret: string;
  safeMode?: boolean;
}

export async function runLoadTest(config: LoadTestConfig): Promise<void> {
  const { convexSiteUrl, webhookSecret, safeMode = false } = config;

  if (safeMode) {
    console.log("Running in SAFE MODE — no real HTTP calls will be made");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      console.log(`  [MOCK] ${init?.method ?? "GET"} ${input}`);
      return new Response(JSON.stringify({ ok: true, mock: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const after = () => {
      globalThis.fetch = originalFetch;
    };

    try {
      await doLoadTest(convexSiteUrl, webhookSecret);
    } finally {
      after();
    }
    return;
  }

  await doLoadTest(convexSiteUrl, webhookSecret);
}

async function doLoadTest(convexSiteUrl: string, webhookSecret: string): Promise<void> {
  console.log("Starting Load Test...");

  console.log("\n[Test 1] Large Document (50 Paragraphs)");
  const largeDoc = generateMarkdown(50);
  console.log(`Document size: ${(largeDoc.length / 1024).toFixed(2)} KB`);
  const res1 = await sendWebhookRequest(
    "job-large-1",
    "https://example.com/large",
    largeDoc,
    convexSiteUrl,
    webhookSecret,
  );
  console.log(`Response: ${res1.status} - body: ${res1.text}`);

  console.log("\n[Test 2] Thundering Herd (5 concurrent webhook calls)");
  const promises: Promise<WebhookResponse>[] = [];
  for (let i = 0; i < 5; i++) {
    const md = generateMarkdown(5);
    promises.push(
      sendWebhookRequest(
        `job-herd-${i}`,
        `https://example.com/herd-${i}`,
        md,
        convexSiteUrl,
        webhookSecret,
      ),
    );
  }

  const results = await Promise.all(promises);
  results.forEach((res, i) => {
    console.log(`Request ${i} -> Status: ${res.status}, Text: ${res.text}`);
  });

  console.log("\n[Test 3] Invalid Signature (Security Verification)");
  const fakeTimestamp = Date.now().toString();
  const fakeBody = JSON.stringify({ job_id: "fake", data: [] });
  const fakeSignature = generateSignature(fakeTimestamp, fakeBody, "fake-secret");
  const res3 = await fetch(`${convexSiteUrl}/api/webhook/crawl`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-crawl-timestamp": fakeTimestamp,
      "x-crawl-signature": fakeSignature,
    },
    body: fakeBody,
  });
  const res3text = await res3.text();
  console.log(`Expected rejection (401). Got: ${res3.status} - ${res3text}`);

  console.log("\nLoad Test completed.");
}

if (require.main === module) {
  const convexSiteUrl = process.env.CONVEX_SITE_URL;
  if (!convexSiteUrl) {
    console.error("FATAL: CONVEX_SITE_URL environment variable is required");
    process.exit(1);
  }

  const webhookSecret = process.env.CRAWL_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("FATAL: CRAWL_WEBHOOK_SECRET environment variable is required");
    process.exit(1);
  }

  const safeMode = process.env.CI === "true" || process.env.SAFE_MODE === "true";

  runLoadTest({ convexSiteUrl, webhookSecret, safeMode }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
