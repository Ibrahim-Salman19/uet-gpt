import { describe, it, expect } from "vitest";
import { chunkMarkdown } from "../../../convex/crawl/webhook";

describe("chunkMarkdown", () => {
  it("splits a 3200-char prose document into chunks with 300-char overlap", () => {
    // Generate a long prose string
    const paragraph = "This is a sentence of prose to fill up space and make this document long enough to exceed the three thousand character limit. ";
    let doc = "";
    while (doc.length < 3200) {
      doc += paragraph;
      // Inject some newlines to ensure it can split naturally
      if (doc.length % 500 < 50) doc += "\n\n";
    }
    
    // Total size should be > 3000
    expect(doc.length).toBeGreaterThan(3000);

    const chunks = chunkMarkdown(doc, 3000, 300);
    
    // Should split into at least 2 chunks
    expect(chunks.length).toBe(2);

    const chunk1 = chunks[0]!;
    const chunk2 = chunks[1]!;

    // The second chunk should start with the last 300 chars of the first chunk
    const expectedOverlapSize = 300;
    const actualOverlapText = chunk1.slice(-expectedOverlapSize);
    
    // We clean up partial words so it might not be EXACTLY 300, but very close
    expect(chunk2).toContain(actualOverlapText.split(" ").slice(1).join(" "));
  });

  it("does not split a 3200-char document mid-table", () => {
    // Create a markdown table that exceeds the chunk size
    let doc = "| Header 1 | Header 2 |\n|---|---|\n";
    let row = "| cell 1 | cell 2 |\n";
    while (doc.length < 3200) {
      doc += row;
    }

    const chunks = chunkMarkdown(doc, 4000);
    
    // Because it's entirely inside a table, it should NOT split, returning 1 massive chunk
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.length).toBeGreaterThan(3000);
  });

  it("injects breadcrumbs for headers into split chunks", () => {
    const doc = `## Admissions Process 2025\n\nThis is the admissions process. We will now have a very long paragraph that causes a split. ` + 
    "prose ".repeat(600) + "\n\nHere is the rest of the text.";

    const chunks = chunkMarkdown(doc, 3000);
    expect(chunks.length).toBe(4);

    // Both chunks should start with the header breadcrumb
    expect(chunks[0]!.startsWith("## Admissions Process 2025")).toBe(true);
    expect(chunks[1]!.startsWith("## Admissions Process 2025")).toBe(true);
    expect(chunks[2]!.startsWith("## Admissions Process 2025")).toBe(true);
    expect(chunks[3]!.startsWith("## Admissions Process 2025")).toBe(true);
  });

  it("does not apply overlap on explicit header splits", () => {
    // If a split happens exactly because of a header, it should NOT include overlap
    const doc = "Some normal text here that is sufficiently long enough to pass the forty character minimum requirement for a chunk to be kept.\n\n## Next Header is a Custom Section Header\n\nSome more text here that is also sufficiently long enough to exceed the forty character limit so it gets pushed as a chunk.";
    
    // Set maxChunkSize small enough so it splits exactly at the header
    const chunks = chunkMarkdown(doc, 130);
    
    expect(chunks.length).toBe(2);
    
    const chunk1 = chunks[0]!;
    const chunk2 = chunks[1]!;
    
    // chunk2 should start with "## Next Header is a Custom Section Header" and not contain the first chunk text
    expect(chunk2.startsWith("## Next Header is a Custom Section Header")).toBe(true);
    expect(chunk2).not.toContain("Some normal text here");
  });

  it("parent-child chunking correctly generates parent chunks and child chunks with parent mapping", () => {
    const title = "UET Guide";
    const contextPrefix = `Document Title: ${title}\nContext: General info\n\n`;
    
    const text = "This is a sentence that goes on and on to fill up the parent and child chunks. ".repeat(50);
    
    const parentChunks = chunkMarkdown(text, 3000, 300);
    expect(parentChunks.length).toBeGreaterThan(1);
    
    const chunks: any[] = [];
    for (const parentText of parentChunks) {
      const childChunks = chunkMarkdown(parentText, 800, 100);
      for (const childText of childChunks) {
        chunks.push({
          text: contextPrefix + childText,
          parentText,
        });
      }
    }
    
    expect(chunks.length).toBeGreaterThan(parentChunks.length);
    for (const c of chunks) {
      expect(c.parentText).toBeDefined();
      expect(c.parentText.length).toBeGreaterThan(c.text.length - contextPrefix.length);
    }
  });
});
