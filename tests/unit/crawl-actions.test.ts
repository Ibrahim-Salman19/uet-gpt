import { beforeEach, describe, expect, it, vi } from "vitest";
import { processPageAction, startCrawlAction } from "../../convex/crawl/actions";

interface MockActionCtx {
  runMutation: ReturnType<typeof vi.fn>;
}

describe("crawl:actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("startCrawlAction", () => {
    it("should send a POST request to the local Crawl4AI instance", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ job_id: "test-job-123" }),
      });
      global.fetch = mockFetch;

      const mockCtx: MockActionCtx = {
        runMutation: vi.fn().mockResolvedValue("job_123"),
      };

      const result = await (
        startCrawlAction as unknown as {
          handler: (ctx: MockActionCtx, args: { seedUrls: string[] }) => Promise<string>;
        }
      ).handler(mockCtx, {
        seedUrls: ["https://web.uettaxila.edu.pk/"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:11235/crawl",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );

      // It should include the magic flags specified in Phase 2
      const requestBody = JSON.parse(mockFetch.mock.calls[0]?.[1].body);
      expect(requestBody.magic).toBe(true);
      expect(requestBody.flatten_shadow_dom).toBe(true);
      expect(requestBody.check_robots_txt).toBe(true);

      expect(result).toBe("test-job-123");
    });
  });

  describe("processPageAction", () => {
    it("should throw an error if no content is provided", async () => {
      await expect(
        (
          processPageAction as unknown as {
            handler: (
              ctx: object,
              args: { jobId: string; url: string; title: string; content: string },
            ) => Promise<void>;
          }
        ).handler(
          {},
          {
            jobId: "job_123",
            url: "https://web.uettaxila.edu.pk/",
            title: "Home",
            content: "",
          },
        ),
      ).rejects.toThrow("Content is empty");
    });
  });
});
