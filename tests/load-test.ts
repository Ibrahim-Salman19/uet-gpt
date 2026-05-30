import { createHmac } from "crypto";

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL ?? "https://adamant-sandpiper-391.convex.site";
const WEBHOOK_SECRET = process.env.CRAWL_WEBHOOK_SECRET || "";
if (!process.env.CRAWL_WEBHOOK_SECRET) {
  console.error("FATAL: CRAWL_WEBHOOK_SECRET environment variable is required");
  process.exit(1);
}

function generateSignature(timestamp: string, secret: string): string {
  return createHmac("sha256", secret).update(timestamp).digest("hex");
}

function generateMarkdown(paragraphs: number): string {
  let md = "# Stress Test Document\n\n";
  for (let i = 0; i < paragraphs; i++) {
    md += `## Section ${i}\n`;
    md += `This is paragraph ${i}. We are generating a large amount of text to simulate a realistic web page crawl. `.repeat(10) + "\n\n";
  }
  return md;
}

async function sendWebhookRequest(jobId: string, url: string, content: string) {
  const timestamp = Date.now().toString();
  const signature = generateSignature(timestamp, WEBHOOK_SECRET);

  const payload = {
    job_id: jobId,
    status: "completed",
    data: [
      {
        url: url,
        markdown: content,
        metadata: { title: `Stress Test - ${url}` },
      }
    ]
  };

  const response = await fetch(`${CONVEX_SITE_URL}/api/webhook/crawl`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-crawl-timestamp": timestamp,
      "x-crawl-signature": signature,
    },
    body: JSON.stringify(payload),
  });

  return response;
}

async function runLoadTest() {
  console.log("Starting Load Test...");
  
  // 1. Send one moderately large document (approx 50 chunks)
  console.log("\n[Test 1] Large Document (50 Paragraphs)");
  const largeDoc = generateMarkdown(50);
  console.log(`Document size: ${(largeDoc.length / 1024).toFixed(2)} KB`);
  const res1 = await sendWebhookRequest("job-large-1", "https://example.com/large", largeDoc);
  console.log(`Response: ${res1.status} - await text: ${await res1.text()}`);

  // 2. Thundering Herd (5 parallel requests for different URLs)
  console.log("\n[Test 2] Thundering Herd (5 concurrent webhook calls)");
  const promises = [];
  for (let i = 0; i < 5; i++) {
    const md = generateMarkdown(5); // smaller docs for thundering herd to avoid insane API usage
    promises.push(
      sendWebhookRequest(`job-herd-${i}`, `https://example.com/herd-${i}`, md)
        .then(async (res) => ({ status: res.status, text: await res.text() }))
    );
  }

  const results = await Promise.all(promises);
  results.forEach((res, i) => {
    console.log(`Request ${i} -> Status: ${res.status}, Text: ${res.text}`);
  });

  // 3. Test Invalid Signature Rejection
  console.log("\n[Test 3] Invalid Signature (Security Verification)");
  const fakeTimestamp = Date.now().toString();
  const fakeSignature = generateSignature(fakeTimestamp, "wrong-secret-123");
  const res3 = await fetch(`${CONVEX_SITE_URL}/api/webhook/crawl`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-crawl-timestamp": fakeTimestamp,
      "x-crawl-signature": fakeSignature,
    },
    body: JSON.stringify({ job_id: "fake", data: [] }),
  });
  console.log(`Expected rejection (401). Got: ${res3.status} - ${await res3.text()}`);

  console.log("\nLoad Test completed. Now check Convex dashboard logs to verify embedding generation behavior (rate limiting, retries, fallbacks).");
}

runLoadTest().catch(console.error);
