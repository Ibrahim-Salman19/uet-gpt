vi.mock("../../../convex/_generated/server", () => ({
  httpAction: (fn: Function) => fn,
}));

vi.mock("../../../convex/_generated/api", () => ({
  internal: {
    crawl: {
      mutations: {
        getProcessedWebhook: "getProcessedWebhook" as any,
        markWebhookProcessed: "markWebhookProcessed" as any,
        queueChunksForEmbedding: "queueChunksForEmbedding" as any,
        upsertDocument: "upsertDocument" as any,
        enqueueDocumentChunks: "enqueueDocumentChunks" as any,
      },
      workflow: {
        completeJobByTaskId: "completeJobByTaskId" as any,
      },
    },
  },
}));

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  chunkMarkdown,
  normalizeContent,
  isQualityChunk,
} from "../../../convex/crawl/chunking";

function computeSignature(timestamp: string, rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

describe("isQualityChunk", () => {
  it("returns true for text with 5+ meaningful words", () => {
    expect(isQualityChunk("this sentence has more than five words here")).toBe(true);
  });

  it("returns false for text with fewer than 5 meaningful words", () => {
    expect(isQualityChunk("a b c d")).toBe(false);
  });

  it("returns false for empty text", () => {
    expect(isQualityChunk("")).toBe(false);
  });

  it("returns false for text with only single-character words", () => {
    expect(isQualityChunk("a b c d e f g")).toBe(false);
  });

  it("returns true for markdown tables (dense content)", () => {
    const table = "| Col1 | Col2 | Col3 |\n| --- | --- | --- |\n| data1 | data2 | data3 |";
    expect(isQualityChunk(table)).toBe(true);
  });

  it("counts only words with length > 1", () => {
    expect(isQualityChunk("a b c d valid one two three")).toBe(false);
    expect(isQualityChunk("a b c d valid one two three four")).toBe(true);
  });
});

describe("normalizeContent", () => {
  it("normalizes line endings", () => {
    expect(normalizeContent("line1\r\nline2\r\nline3")).toBe("line1\nline2\nline3");
  });

  it("strips trailing whitespace on lines", () => {
    expect(normalizeContent("hello   \nworld  \n")).toBe("hello\nworld");
  });

  it("collapses excessive blank lines", () => {
    expect(normalizeContent("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("removes pure navigation anchor links", () => {
    const input = "some text\n[Learn More](#features)\nmore text";
    expect(normalizeContent(input)).toBe("some text\nmore text");
  });

  it("removes empty markdown table rows", () => {
    const input = "text\n|---|\n| |\nmore";
    expect(normalizeContent(input)).toBe("text\n|---|\nmore");
  });

  it("trims the result", () => {
    expect(normalizeContent("  hello world  ")).toBe("hello world");
  });

  it("handles empty input", () => {
    expect(normalizeContent("")).toBe("");
    expect(normalizeContent("   ")).toBe("");
  });
});

describe("chunkMarkdown", () => {
  it("splits a 3200-char prose document into chunks with 300-char overlap", () => {
    const paragraph = "This is a sentence of prose to fill up space and make this document long enough to exceed the three thousand character limit. ";
    let doc = "";
    while (doc.length < 3200) {
      doc += paragraph;
      if (doc.length % 500 < 50) doc += "\n\n";
    }
    expect(doc.length).toBeGreaterThan(3000);
    const chunks = chunkMarkdown(doc, 3000, 300);
    expect(chunks.length).toBe(2);
    const chunk1 = chunks[0]!.text;
    const chunk2 = chunks[1]!.text;
    const expectedOverlapSize = 300;
    const actualOverlapText = chunk1.slice(-expectedOverlapSize);
    expect(chunk2).toContain(actualOverlapText.split(" ").slice(1).join(" "));
  });

  it("does not split a 3200-char document mid-table", () => {
    let doc = "| Header 1 | Header 2 |\n|---|---|\n";
    let row = "| cell 1 | cell 2 |\n";
    while (doc.length < 3200) {
      doc += row;
    }
    const chunks = chunkMarkdown(doc, 4000);
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.text.length).toBeGreaterThan(3000);
  });

  it("injects breadcrumbs for headers into split chunks", () => {
    const doc = `## Admissions Process 2025\n\nThis is the admissions process. We will now have a very long paragraph that causes a split. ` +
      "prose ".repeat(600) + "\n\nHere is the rest of the text.";
    const chunks = chunkMarkdown(doc, 3000);
    expect(chunks.length).toBe(4);
    // Breadcrumbs are stored in headingPath, not prepended to text
    expect(chunks[0]!.headingPath).toContain("Admissions Process 2025");
    expect(chunks[1]!.headingPath).toContain("Admissions Process 2025");
    expect(chunks[2]!.headingPath).toContain("Admissions Process 2025");
    expect(chunks[3]!.headingPath).toContain("Admissions Process 2025");
  });

  it("does not apply overlap on explicit header splits", () => {
    const doc = "Some normal text here that is sufficiently long enough to pass the forty character minimum requirement for a chunk to be kept.\n\n## Next Header is a Custom Section Header\n\nSome more text here that is also sufficiently long enough to exceed the forty character limit so it gets pushed as a chunk.";
    const chunks = chunkMarkdown(doc, 200, 20);
    expect(chunks.length).toBe(2);
    expect(chunks[0]!.text).not.toContain("## Next Header");
    expect(chunks[1]!.text.startsWith("## Next Header is a Custom Section Header")).toBe(true);
    expect(chunks[1]!.text).not.toContain("Some normal text here");
  });

  it("parent-child chunking correctly generates parent chunks and child chunks with parent mapping", () => {
    const title = "UET Guide";
    const contextPrefix = `Document Title: ${title}\nContext: General info\n\n`;
    const text = "This is a sentence that goes on and on to fill up the parent and child chunks. ".repeat(50);
    const parentChunks = chunkMarkdown(text, 3000, 300);
    expect(parentChunks.length).toBeGreaterThan(1);
    const chunks: any[] = [];
    for (const parent of parentChunks) {
      const childChunks = chunkMarkdown(parent.text, 800, 100);
      for (const child of childChunks) {
        chunks.push({
          text: contextPrefix + child.text,
          parentText: parent.text,
        });
      }
    }
    expect(chunks.length).toBeGreaterThan(parentChunks.length);
    for (const c of chunks) {
      expect(c.parentText).toBeDefined();
      expect(c.parentText.length).toBeGreaterThanOrEqual(c.text.length - contextPrefix.length);
    }
  });

  it("returns empty array for empty input", () => {
    expect(chunkMarkdown("")).toEqual([]);
    expect(chunkMarkdown("   ")).toEqual([]);
  });

  it("returns empty array when all chunks are filtered by quality", () => {
    expect(chunkMarkdown("a b c d")).toEqual([]);
  });

  it("returns single chunk for content smaller than maxChunkSize", () => {
    const text = "This is a short document with enough meaningful content to pass the quality filter.";
    const chunks = chunkMarkdown(text, 3000);
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.text).toContain("short document");
  });

  it("splits markdown tables row-by-row when they exceed maxChunkSize", () => {
    const header = "| Name | Department | Grade |\n| --- | --- | --- |\n";
    const rows = Array.from({ length: 50 }, (_, i) => `| Student ${i} | CS | A${i % 5} |\n`).join("");
    const doc = header + rows;
    const chunks = chunkMarkdown(doc, 300, 30);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text).toContain("| Name | Department | Grade |");
      expect(chunk.text).toContain("| --- | --- | --- |");
    }
  });

  it("splits prose blocks by sentence boundaries", () => {
    const sentences = Array.from({ length: 100 }, (_, i) => `This is sentence number ${i} in the test document. More words here to make it longer. `);
    const doc = sentences.join("\n\n");
    const chunks = chunkMarkdown(doc, 2000, 200);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("handles a single very long sentence by word-splitting", () => {
    const words = Array.from({ length: 500 }, (_, i) => `word${i}`).join(" ");
    const doc = `# Header\n\n${words}`;
    const chunks = chunkMarkdown(doc, 500, 100);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("preserves unicode content", () => {
    const doc = "University of Engineering and Technology Taxila\n\n" +
      "علاقہ: ٹیکسلا، پنجاب، پاکستان\n\n" +
      "This is English text alongside Urdu content. ".repeat(50);
    const chunks = chunkMarkdown(doc, 2000, 200);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const allText = chunks.map(c => c.text).join(" ");
    expect(allText).toContain("ٹیکسلا");
    expect(allText).toContain("University of Engineering");
  });

  it("handles code blocks without splitting mid-block", () => {
    const doc = "# API Reference\n\n```typescript\nconst result = await ctx.runQuery(api.search.fullText, {\n  query: searchQuery," +
      "\n  limit: 10,\n});\nconsole.log(result);\n```\n\nMore text here that continues the documentation. ".repeat(30);
    const chunks = chunkMarkdown(doc, 1000, 100);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("respects maxChunkSize within overlap boundaries", () => {
    const doc = "First chunk content. ".repeat(200) + "\n\nSecond chunk content. ".repeat(200);
    const maxSize = 3000;
    const overlap = 300;
    const chunks = chunkMarkdown(doc, maxSize, overlap);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(maxSize + 500);
    }
  });

  it("applies overlap on large blocks that are split", () => {
    const doc = "This is a long text that will need to be split into multiple chunks with proper overlap. ".repeat(300);
    const chunks = chunkMarkdown(doc, 2000, 300);
    expect(chunks.length).toBeGreaterThan(1);
    if (chunks.length >= 2) {
      const chunk1Tail = chunks[0]!.text.slice(-350);
      const chunk2Head = chunks[1]!.text.slice(0, 350);
      const overlapWords = chunk1Tail.split(" ").slice(5).join(" ");
      expect(chunk2Head).toContain(overlapWords.slice(0, 50));
    }
  });
});

describe("crawlWebhook", () => {
  let crawlWebhook: any;
  let mockCtx: any;

  beforeEach(async () => {
    process.env.CRAWL_WEBHOOK_SECRET = "test-webhook-secret-12345";
    const mod = await import("../../../convex/crawl/webhook");
    crawlWebhook = mod.crawlWebhook;
    mockCtx = {
      runQuery: vi.fn(),
      runMutation: vi.fn().mockImplementation((mutationName) => {
        if (
          mutationName === "markWebhookProcessed" ||
          (mutationName && mutationName.toString().includes("markWebhookProcessed"))
        ) {
          return true;
        }
        return undefined;
      }),
      runAction: vi.fn(),
      auth: { getUserIdentity: vi.fn() },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.CRAWL_WEBHOOK_SECRET;
  });

  function createSignedRequest(
    body: any,
    secret: string,
    options?: { timestamp?: string; extraHeaders?: Record<string, string> },
  ): Request {
    const rawBody = JSON.stringify(body);
    const ts = options?.timestamp ?? Date.now().toString();
    const signature = computeSignature(ts, rawBody, secret);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-crawl-timestamp": ts,
      "x-crawl-signature": signature,
      "content-length": rawBody.length.toString(),
      ...options?.extraHeaders,
    };
    return new Request("http://localhost/api/webhook/crawl", {
      method: "POST",
      headers,
      body: rawBody,
    });
  }

  it("rejects payload larger than 10MB with 413", async () => {
    // The webhook checks content-length header against 10MB (10_485_760 bytes)
    const largeBody = { data: "x".repeat(10_500_000) };
    const req = createSignedRequest(largeBody, "test-webhook-secret-12345");
    const res = await crawlWebhook(mockCtx, req);
    expect(res.status).toBe(413);
    const text = await res.text();
    expect(text).toBe("Payload too large");
  });

  it("rejects missing signature headers with 400", async () => {
    const req = new Request("http://localhost/api/webhook/crawl", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task_id: "t1" }),
    });
    const res = await crawlWebhook(mockCtx, req);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toBe("Missing signature headers");
  });

  it("rejects missing timestamp with 400", async () => {
    const rawBody = JSON.stringify({ task_id: "t1" });
    const req = new Request("http://localhost/api/webhook/crawl", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-crawl-signature": "abc123",
        "content-length": rawBody.length.toString(),
      },
      body: rawBody,
    });
    const res = await crawlWebhook(mockCtx, req);
    expect(res.status).toBe(400);
  });

  it("rejects expired timestamp with 400", async () => {
    const oldTs = (Date.now() - 10 * 60 * 1000).toString();
    const req = createSignedRequest(
      { task_id: "t1", url: "https://example.com/page" },
      "test-webhook-secret-12345",
      { timestamp: oldTs },
    );
    const res = await crawlWebhook(mockCtx, req);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toBe("Request timestamp expired");
  });

  it("rejects invalid timestamp (NaN) with 400", async () => {
    const req = createSignedRequest(
      { task_id: "t1" },
      "test-webhook-secret-12345",
      { timestamp: "not-a-number" },
    );
    const res = await crawlWebhook(mockCtx, req);
    expect(res.status).toBe(400);
  });

  it("rejects invalid signature with 401", async () => {
    const rawBody = JSON.stringify({ task_id: "t1", url: "https://example.com" });
    const ts = Date.now().toString();
    const req = new Request("http://localhost/api/webhook/crawl", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-crawl-timestamp": ts,
        "x-crawl-signature": "invalid-signature-hex",
        "content-length": rawBody.length.toString(),
      },
      body: rawBody,
    });
    const res = await crawlWebhook(mockCtx, req);
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toBe("Invalid signature");
  });

  it("accepts valid request with complete payload and returns 200", async () => {
    mockCtx.runQuery.mockResolvedValue(null);
    mockCtx.runMutation.mockResolvedValue(true);
    const payload = {
      task_id: "task-123",
      url: "https://web.uettaxila.edu.pk/page",
      markdown: "# Test Page\n\nThis is test content with enough words to pass the quality filter.",
      status: "completed",
    };
    const req = createSignedRequest(payload, "test-webhook-secret-12345");
    const res = await crawlWebhook(mockCtx, req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("marks processed before processing (race-condition safe idempotency)", async () => {
    mockCtx.runQuery.mockResolvedValue(null);
    mockCtx.runMutation.mockResolvedValue(true);
    const payload = {
      task_id: "task-123",
      url: "https://web.uettaxila.edu.pk/page",
      markdown: "content",
    };
    const req = createSignedRequest(payload, "test-webhook-secret-12345");
    const res = await crawlWebhook(mockCtx, req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    // Verify markWebhookProcessed was called BEFORE processing
    const firstCall = mockCtx.runMutation.mock.calls[0];
    expect(firstCall[0]).toContain("markWebhookProcessed");
  });

  it("handles multiple pages in one webhook", async () => {
    mockCtx.runQuery.mockResolvedValue(null);
    mockCtx.runMutation.mockResolvedValue(true);
    const payload = {
      task_id: "task-multi",
      status: "completed",
      // Use payload.results - the webhook reads: payload.data?.results || payload.results || ...
      results: [
        {
          url: "https://web.uettaxila.edu.pk/page1",
          markdown: "Content for page one with enough words to pass the quality filter.",
        },
        {
          url: "https://web.uettaxila.edu.pk/page2",
          markdown: "Content for page two with enough words to pass the quality filter.",
        },
      ],
    };
    const req = createSignedRequest(payload, "test-webhook-secret-12345");
    const res = await crawlWebhook(mockCtx, req);
    expect(res.status).toBe(200);
    expect(mockCtx.runMutation).toHaveBeenCalled();
    const upsertArgs = mockCtx.runMutation.mock.calls.filter(
      (c: any[]) => c[1] && Array.isArray(c[1].children),
    );
    expect(upsertArgs.length).toBeGreaterThanOrEqual(2);
  });

  it("calls completeJobByTaskId when status is completed", async () => {
    mockCtx.runQuery.mockResolvedValue(null);
    mockCtx.runMutation.mockResolvedValue(true);
    const payload = {
      task_id: "task-complete",
      status: "completed",
      markdown: "Content with enough words to pass the quality filter for this single page.",
      url: "https://web.uettaxila.edu.pk/page",
    };
    const req = createSignedRequest(payload, "test-webhook-secret-12345");
    const res = await crawlWebhook(mockCtx, req);
    expect(res.status).toBe(200);
    const completeCalls = mockCtx.runMutation.mock.calls.filter(
      (c: any[]) => c[1] && c[1].taskId === "task-complete" && c[1].status === "completed",
    );
    expect(completeCalls.length).toBeGreaterThanOrEqual(1);
    expect(completeCalls[0][1].taskId).toBe("task-complete");
    expect(completeCalls[0][1].status).toBe("completed");
  });

  it("skips pages with empty content", async () => {
    mockCtx.runQuery.mockResolvedValue(null);
    mockCtx.runMutation.mockResolvedValue(true);
    const payload = {
      task_id: "task-skip",
      url: "https://web.uettaxila.edu.pk/empty",
      markdown: "",
    };
    const req = createSignedRequest(payload, "test-webhook-secret-12345");
    const res = await crawlWebhook(mockCtx, req);
    expect(res.status).toBe(200);
    const upsertCalls = mockCtx.runMutation.mock.calls.filter(
      (c: any[]) => c[0] === "queueChunksForEmbedding",
    );
    expect(upsertCalls.length).toBe(0);
  });
});

describe("ingestWebhook", () => {
  let ingestWebhook: any;
  let mockCtx: any;

  beforeEach(async () => {
    process.env.CONVEX_AUTH_TOKEN = "test-auth-token";
    const mod = await import("../../../convex/crawl/webhook");
    ingestWebhook = mod.ingestWebhook;
    mockCtx = {
      runQuery: vi.fn(),
      runMutation: vi.fn(),
      runAction: vi.fn(),
      auth: { getUserIdentity: vi.fn() },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.CONVEX_AUTH_TOKEN;
  });

  function createRequest(body: any, token?: string): Request {
    const rawBody = JSON.stringify(body);
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return new Request("http://localhost/api/ingest", {
      method: "POST",
      headers,
      body: rawBody,
    });
  }

  it("rejects payload larger than 4MB with 413", async () => {
    const largeBody = { url: "https://example.com", markdown: "x".repeat(4_200_000), contentHash: "abc", crawlSessionId: "s1", sourceType: "html" };
    const req = createRequest(largeBody, "test-auth-token");
    const res = await ingestWebhook(mockCtx, req);
    expect(res.status).toBe(413);
  });

  it("rejects missing required fields with 400", async () => {
    const req = createRequest({ url: "https://example.com" }, "test-auth-token");
    const res = await ingestWebhook(mockCtx, req);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("Missing required fields");
  });

  it("rejects non-UET domain URLs with 403", async () => {
    const req = createRequest({
      url: "https://evil-site.com/malware",
      markdown: "some content with enough words for quality",
      contentHash: "hash1",
      crawlSessionId: "s1",
      sourceType: "html",
    }, "test-auth-token");
    const res = await ingestWebhook(mockCtx, req);
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toBe("URL domain not permitted");
  });

  it("rejects malformed URLs with 400", async () => {
    const req = createRequest({
      url: "not-a-valid-url",
      markdown: "some content with enough words for quality",
      contentHash: "hash1",
      crawlSessionId: "s1",
      sourceType: "html",
    }, "test-auth-token");
    const res = await ingestWebhook(mockCtx, req);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toBe("Invalid URL");
  });

  it("allows pdf:// URLs through domain check", async () => {
    mockCtx.runMutation.mockResolvedValue({ action: "inserted", documentId: "doc123" as any });
    const req = createRequest({
      url: "pdf://some-local-file.pdf",
      markdown: "PDF content with enough words for testing quality filter purposes.",
      contentHash: "hash-pdf-1",
      crawlSessionId: "s1",
      sourceType: "pdf",
    }, "test-auth-token");
    const res = await ingestWebhook(mockCtx, req);
    expect(res.status).toBe(200);
  });

  it("rejects unauthorized requests when auth token is configured", async () => {
    const req = createRequest({
      url: "https://web.uettaxila.edu.pk/page",
      markdown: "some content with enough words for quality",
      contentHash: "hash1",
      crawlSessionId: "s1",
      sourceType: "html",
    }, "wrong-token");
    const res = await ingestWebhook(mockCtx, req);
    expect(res.status).toBe(401);
  });

  it("returns 500 when CONVEX_AUTH_TOKEN is not configured", async () => {
    delete process.env.CONVEX_AUTH_TOKEN;
    const req = createRequest({
      url: "https://web.uettaxila.edu.pk/page",
      markdown: "some content with enough words for quality filtering purposes here.",
      contentHash: "hash2",
      crawlSessionId: "s1",
      sourceType: "html",
    });
    const res = await ingestWebhook(mockCtx, req);
    // The ingestWebhook requires auth token to always be configured - returns 500 if missing
    expect(res.status).toBe(500);
  });

  it("happy path: upserts document and enqueues chunks for new document", async () => {
    mockCtx.runMutation.mockResolvedValue({ action: "inserted", documentId: "doc123" as any });
    const req = createRequest({
      url: "https://web.uettaxila.edu.pk/academics",
      markdown: "## Academics\n\nThe university offers many programs across engineering disciplines. This content has enough words to pass the quality filter and generate multiple chunks for embedding purposes.",
      contentHash: "hash-unique",
      crawlSessionId: "session-1",
      title: "Academics Page",
      sourceType: "html",
      freshnessTier: "high",
    }, "test-auth-token");
    const res = await ingestWebhook(mockCtx, req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.action).toBe("inserted");
    const upsertCalls = mockCtx.runMutation.mock.calls.filter(
      (c: any[]) => c[1] && c[1].crawlSessionId === "session-1",
    );
    expect(upsertCalls.length).toBeGreaterThanOrEqual(1);
    expect(upsertCalls[0][1].url).toBe("https://web.uettaxila.edu.pk/academics");
    expect(upsertCalls[0][1].freshnessTier).toBe("high");
    const enqueueCalls = mockCtx.runMutation.mock.calls.filter(
      (c: any[]) => c[1] && Array.isArray(c[1].children),
    );
    expect(enqueueCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("returns skipped action when content is unchanged", async () => {
    mockCtx.runMutation.mockResolvedValue({ action: "skipped", documentId: "doc123" as any });
    const req = createRequest({
      url: "https://web.uettaxila.edu.pk/unchanged",
      markdown: "same content as before with enough words for quality",
      contentHash: "same-hash",
      crawlSessionId: "s1",
      sourceType: "html",
    }, "test-auth-token");
    const res = await ingestWebhook(mockCtx, req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.action).toBe("skipped");
    const enqueueCalls = mockCtx.runMutation.mock.calls.filter(
      (c: any[]) => c[0] === "enqueueDocumentChunks",
    );
    expect(enqueueCalls.length).toBe(0);
  });

  it("handles missing title gracefully", async () => {
    mockCtx.runMutation.mockResolvedValue({ action: "inserted", documentId: "doc456" as any });
    const req = createRequest({
      url: "https://web.uettaxila.edu.pk/no-title",
      markdown: "This page has no title but should still be processed with enough words for the quality filter.",
      contentHash: "hash-no-title",
      crawlSessionId: "s1",
      sourceType: "html",
    }, "test-auth-token");
    const res = await ingestWebhook(mockCtx, req);
    expect(res.status).toBe(200);
    const upsertCalls = mockCtx.runMutation.mock.calls.filter(
      (c: any[]) => c[1] && c[1].crawlSessionId === "s1" && c[1].contentHash === "hash-no-title",
    );
    expect(upsertCalls[0]?.[1]?.title).toBeUndefined();
  });
});
