import { describe, expect, it } from "vitest";
import { chunkMarkdown } from "../../convex/crawl/chunking";

const SAMPLE_TEXT =
  "# Section A\n\n" +
  "The UET admission policy requires all applicants to submit valid entry test scores before the published deadline.\n\n" +
  "# Section B\n\n" +
  "Fee structures for undergraduate engineering programs are detailed in the official university prospectus.\n\n" +
  "# Section C\n\n" +
  "Scholarship opportunities are available for high performing students based on merit and financial need criteria.\n\n" +
  "# Section D\n\n" +
  "Campus hostel registration begins immediately after the first merit list announcement each academic year.";

describe("Chunking Invariants (Phase 3)", () => {
  it("produces no empty chunks", () => {
    const chunks = chunkMarkdown(SAMPLE_TEXT, 200, 20);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((c) => c.text.trim().length > 0)).toBe(true);
  });

  it("attaches heading path metadata to chunks", () => {
    const chunks = chunkMarkdown(SAMPLE_TEXT, 200, 20);
    expect(chunks.every((c) => Array.isArray(c.headingPath))).toBe(true);
  });

  it("is 100% deterministic (identical text produces identical chunks)", () => {
    const runA = chunkMarkdown(SAMPLE_TEXT, 200, 20);
    const runB = chunkMarkdown(SAMPLE_TEXT, 200, 20);
    expect(runA.map((c) => c.text)).toEqual(runB.map((c) => c.text));
  });

  it("preserves material text content across chunk set", () => {
    const chunks = chunkMarkdown(SAMPLE_TEXT, 200, 20);
    const combined = chunks.map((c) => c.text).join(" ");
    expect(combined).toContain("admission policy");
    expect(combined).toContain("Fee structures");
    expect(combined).toContain("Scholarship opportunities");
    expect(combined).toContain("hostel registration");
  });

  it("handles short text under chunk size without splitting", () => {
    const shortText = "Short text under 200 tokens.";
    const chunks = chunkMarkdown(shortText, 200, 20);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe(shortText);
  });
});
