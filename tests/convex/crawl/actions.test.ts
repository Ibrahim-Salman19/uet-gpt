vi.mock("../../../convex/_generated/server", () => ({
  internalAction: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  internal: {
    crawl: {
      workflow: { updateJobState: "updateJobState" as any },
      mutations: { saveEmbedding: "saveEmbedding" as any },
      queries: { getJobById: "getJobById" as any },
      actions: {},
    },
    embeddings: {
      contextualize: {
        contextualizeNewChunk: "contextualizeNewChunk" as any,
      },
    },
  },
}));

vi.mock("../../../convex/rag/instance", () => ({
  rag: {
    add: vi.fn(),
    delete: vi.fn(),
  },
}));

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConvexError } from "convex/values";

describe("executeCrawlJob", () => {
  let executeCrawlJob: any;
  let mockCtx: any;

  beforeEach(async () => {
    process.env.CRAWL4AI_URL = "http://crawl4ai:8000";
    process.env.CRAWL_WEBHOOK_SECRET = "test-secret";
    process.env.CONVEX_SITE_URL = "https://test-project.convex.cloud";
    globalThis.fetch = vi.fn();
    const mod = await import("../../../convex/crawl/actions");
    executeCrawlJob = mod.executeCrawlJob;
    mockCtx = {
      runMutation: vi.fn(),
      runQuery: vi.fn().mockResolvedValue(null), // getJobById returns null (no crash-recovery state)
      runAction: vi.fn().mockResolvedValue(undefined),
      auth: { getUserIdentity: vi.fn() },
      scheduler: {
        runAfter: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.CRAWL4AI_URL;
    delete process.env.CRAWL_WEBHOOK_SECRET;
    delete process.env.CONVEX_SITE_URL;
  });

  it("sets job to running state first", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ task_id: "provider-task-1" }),
    });
    mockCtx.runMutation.mockResolvedValue(undefined);

    await (executeCrawlJob as any).handler(mockCtx, { jobId: "job123" });

    expect(mockCtx.runMutation).toHaveBeenCalledWith(
      "updateJobState",
      expect.objectContaining({ jobId: "job123", status: "running" }),
    );
  });

  it("calls Crawl4AI API with correct config", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ task_id: "provider-task-1" }),
    });
    mockCtx.runMutation.mockResolvedValue(undefined);

    await (executeCrawlJob as any).handler(mockCtx, { jobId: "job123" });

    // fetch is called at least twice: once for sitemap pre-seeding, once for the crawl API
    const crawlCall = (globalThis.fetch as any).mock.calls.find(
      (c: any[]) => c[0].includes("/crawl/job")
    );
    expect(crawlCall).toBeDefined();
    const [url, options] = crawlCall;
    expect(url).toBe("http://crawl4ai:8000/crawl/job");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body);
    expect(body.urls).toBeDefined();
    expect(Array.isArray(body.urls)).toBe(true);
    expect(body.urls.length).toBeGreaterThan(0);
    expect(body.webhook_config).toBeDefined();
    expect(body.webhook_config.webhook_url).toBe("https://test-project.convex.cloud/api/webhook/crawl");
    expect(body.webhook_config.webhook_headers["x-crawl-timestamp"]).toBeDefined();
    expect(body.webhook_config.webhook_headers["x-crawl-signature"]).toBeDefined();
  });

  it("stores provider task_id after successful crawl API call", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ task_id: "provider-task-42" }),
    });
    mockCtx.runMutation.mockResolvedValue(undefined);

    await (executeCrawlJob as any).handler(mockCtx, { jobId: "job123" });

    const providerUpdateCalls = mockCtx.runMutation.mock.calls.filter(
      (c: any[]) => c[0] === "updateJobState",
    );
    const providerCall = providerUpdateCalls.find(
      (c: any[]) => c[1].providerJobId !== undefined,
    );
    expect(providerCall).toBeDefined();
    expect(providerCall[1].providerJobId).toBe("provider-task-42");
  });

  it("handles job_id field from API response as fallback", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ job_id: "provider-job-1" }),
    });
    mockCtx.runMutation.mockResolvedValue(undefined);

    await (executeCrawlJob as any).handler(mockCtx, { jobId: "job456" });

    const providerUpdateCalls = mockCtx.runMutation.mock.calls.filter(
      (c: any[]) => c[0] === "updateJobState",
    );
    const providerCall = providerUpdateCalls.find(
      (c: any[]) => c[1].providerJobId !== undefined,
    );
    expect(providerCall).toBeDefined();
    expect(providerCall[1].providerJobId).toBe("provider-job-1");
  });

  it("sets job to failed when CRAWL4AI_URL is missing", async () => {
    delete process.env.CRAWL4AI_URL;

    await expect(
      (executeCrawlJob as any).handler(mockCtx, { jobId: "job123" }),
    ).rejects.toThrow(ConvexError);

    expect(mockCtx.runMutation).toHaveBeenCalledWith(
      "updateJobState",
      expect.objectContaining({ jobId: "job123", status: "failed" }),
    );
  });

  it("sets job to failed when API returns non-200", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => "Bad Gateway",
    });
    mockCtx.runMutation.mockResolvedValue(undefined);

    await expect(
      (executeCrawlJob as any).handler(mockCtx, { jobId: "job123" }),
    ).rejects.toThrow("Crawl4AI API error (502): Bad Gateway");

    expect(mockCtx.runMutation).toHaveBeenCalledWith(
      "updateJobState",
      expect.objectContaining({
        jobId: "job123",
        status: "failed",
        error: "Crawl4AI API error (502): Bad Gateway",
      }),
    );
  });

  it("sets job to failed when API returns no task_id", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    mockCtx.runMutation.mockResolvedValue(undefined);

    await expect(
      (executeCrawlJob as any).handler(mockCtx, { jobId: "job123" }),
    ).rejects.toThrow("Invalid response format from Crawl4AI - no job ID returned");

    expect(mockCtx.runMutation).toHaveBeenCalledWith(
      "updateJobState",
      expect.objectContaining({ jobId: "job123", status: "failed" }),
    );
  });

  it("handles network errors gracefully", async () => {
    (globalThis.fetch as any).mockRejectedValue(new Error("ECONNREFUSED"));
    mockCtx.runMutation.mockResolvedValue(undefined);

    await expect(
      (executeCrawlJob as any).handler(mockCtx, { jobId: "job123" }),
    ).rejects.toThrow("ECONNREFUSED");

    expect(mockCtx.runMutation).toHaveBeenCalledWith(
      "updateJobState",
      expect.objectContaining({
        jobId: "job123",
        status: "failed",
        error: "ECONNREFUSED",
      }),
    );
  });

  it("normalizes CRAWL4AI_URL by removing trailing slash", async () => {
    process.env.CRAWL4AI_URL = "http://crawl4ai:8000/";
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ task_id: "task-1" }),
    });
    mockCtx.runMutation.mockResolvedValue(undefined);

    await (executeCrawlJob as any).handler(mockCtx, { jobId: "job123" });

    // Sitemap fetch happens first, then the actual crawl API call
    const crawlJobCall = (globalThis.fetch as any).mock.calls.find(
      (c: any[]) => c[0].includes("/crawl/job"),
    );
    expect(crawlJobCall).toBeDefined();
    expect(crawlJobCall[0]).toBe("http://crawl4ai:8000/crawl/job");
  });
});

describe("embedSingleChunk", () => {
  let embedSingleChunk: any;
  let mockCtx: any;
  let ragModule: any;

  beforeEach(async () => {
    ragModule = await import("../../../convex/rag/instance");
    ragModule.rag.add.mockReset();
    ragModule.rag.delete.mockReset();

    const mod = await import("../../../convex/crawl/actions");
    embedSingleChunk = mod.embedSingleChunk;

    mockCtx = {
      runMutation: vi.fn(),
      runQuery: vi.fn(),
      runAction: vi.fn().mockResolvedValue(undefined),
      auth: { getUserIdentity: vi.fn() },
      scheduler: {
        runAfter: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const defaultArgs = {
    documentId: "doc123" as any,
    url: "https://web.uettaxila.edu.pk/academics",
    chunkText: "This is a chunk of text from the academics page that gets embedded into the vector database.",
    contentHash: "hash-chunk-1",
    jobId: "job-123",
    parentId: "parent123" as any,
    namespaceId: "mock-namespace-id",
  };

  it("calls rag.add with correct parameters on success", async () => {
    ragModule.rag.add.mockResolvedValue({ entryId: "rag-entry-1" });
    mockCtx.runMutation.mockResolvedValue(undefined);

    const result = await (embedSingleChunk as any).handler(mockCtx, defaultArgs);

    expect(result).toEqual(expect.objectContaining({ success: true, ragId: "rag-entry-1" }));
    expect(ragModule.rag.add).toHaveBeenCalledWith(
      mockCtx,
      expect.objectContaining({
        namespaceId: "mock-namespace-id",
        text: defaultArgs.chunkText,
      }),
    );
  });

  it("saves embedding via runMutation after successful rag.add", async () => {
    ragModule.rag.add.mockResolvedValue({ entryId: "rag-entry-1" });
    mockCtx.runMutation.mockResolvedValue(undefined);

    await (embedSingleChunk as any).handler(mockCtx, defaultArgs);

    expect(mockCtx.runMutation).toHaveBeenCalledWith(
      "saveEmbedding",
      expect.objectContaining({
        documentId: defaultArgs.documentId,
        chunkText: defaultArgs.chunkText,
        contentHash: defaultArgs.contentHash,
        ragId: "rag-entry-1",
        parentId: defaultArgs.parentId,
      }),
    );
  });

  it("returns skipped for 400 malformed input (no retry)", async () => {
    const error = new Error("400 Bad Request: content too long");
    (error as any).status = 400;
    ragModule.rag.add.mockRejectedValue(error);

    const result = await (embedSingleChunk as any).handler(mockCtx, defaultArgs);

    expect(result).toEqual(expect.objectContaining({ success: false, skipped: true }));
    expect(mockCtx.runMutation).not.toHaveBeenCalled();
  });

  it("throws on network errors (so workpool retries)", async () => {
    ragModule.rag.add.mockRejectedValue(new Error("ECONNRESET"));

    await expect(
      (embedSingleChunk as any).handler(mockCtx, defaultArgs),
    ).rejects.toThrow("ECONNRESET");
  });

  it("throws on rate limit errors (so workpool retries)", async () => {
    ragModule.rag.add.mockRejectedValue(new Error("429 Too Many Requests"));

    await expect(
      (embedSingleChunk as any).handler(mockCtx, defaultArgs),
    ).rejects.toThrow("429 Too Many Requests");
  });

  it("extracts hostname for https:// source", async () => {
    ragModule.rag.add.mockResolvedValue({ entryId: "rag-entry-1" });
    mockCtx.runMutation.mockResolvedValue(undefined);

    await (embedSingleChunk as any).handler(mockCtx, defaultArgs);

    expect(ragModule.rag.add).toHaveBeenCalledWith(
      mockCtx,
      expect.objectContaining({
        filterValues: expect.arrayContaining([
          { name: "source", value: "web.uettaxila.edu.pk" },
        ]),
      }),
    );
  });

  it("sets source to 'pdf' for pdf:// URLs", async () => {
    ragModule.rag.add.mockResolvedValue({ entryId: "rag-entry-2" });
    mockCtx.runMutation.mockResolvedValue(undefined);

    await (embedSingleChunk as any).handler(mockCtx, {
      ...defaultArgs,
      url: "pdf://some-local-file.pdf",
    });

    expect(ragModule.rag.add).toHaveBeenCalledWith(
      mockCtx,
      expect.objectContaining({
        filterValues: expect.arrayContaining([
          { name: "source", value: "pdf" },
        ]),
      }),
    );
  });

  it("sets source to 'unknown' for invalid URLs", async () => {
    ragModule.rag.add.mockResolvedValue({ entryId: "rag-entry-3" });
    mockCtx.runMutation.mockResolvedValue(undefined);

    await (embedSingleChunk as any).handler(mockCtx, {
      ...defaultArgs,
      url: "not-a-valid-url",
    });

    expect(ragModule.rag.add).toHaveBeenCalledWith(
      mockCtx,
      expect.objectContaining({
        filterValues: expect.arrayContaining([
          { name: "source", value: "unknown" },
        ]),
      }),
    );
  });

  it("sets category filter to 'crawled'", async () => {
    ragModule.rag.add.mockResolvedValue({ entryId: "rag-entry-4" });
    mockCtx.runMutation.mockResolvedValue(undefined);

    await (embedSingleChunk as any).handler(mockCtx, defaultArgs);

    expect(ragModule.rag.add).toHaveBeenCalledWith(
      mockCtx,
      expect.objectContaining({
        filterValues: expect.arrayContaining([
          { name: "category", value: "crawled" },
        ]),
      }),
    );
  });
});
