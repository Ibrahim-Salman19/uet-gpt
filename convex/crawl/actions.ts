import { v } from "convex/values";
import { action } from "../_generated/server";

export const startCrawlAction = action({
  args: {
    seedUrls: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Contact local Crawl4AI instance
    const response = await fetch("http://localhost:11235/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: args.seedUrls,
        max_pages: 500,
        max_depth: 5,
        include_patterns: ["https://web.uettaxila.edu.pk/**"],
        exclude_patterns: ["*.pdf", "*.jpg", "*.png", "*/edit", "*/delete"],
        extract_blocks: true,
        word_count_threshold: 50,
        check_robots_txt: true,
        flatten_shadow_dom: true,
        magic: true,
        simulate_user: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Crawl4AI API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;
    return data.job_id;
  },
});

export const processPageAction = action({
  args: {
    jobId: v.string(),
    url: v.string(),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.content || args.content.trim().length === 0) {
      throw new Error("Content is empty");
    }

    // 1. Generate SHA-256 hash of the content for duplicate detection
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(args.content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const contentHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Note: The subsequent steps (calling internal mutations to check if the hash exists,
    // chunking the text, generating Gemini embeddings, and storing them) will be integrated
    // once the internal mutations are scaffolded.

    return {
      success: true,
      hash: contentHash,
    };
  },
});
