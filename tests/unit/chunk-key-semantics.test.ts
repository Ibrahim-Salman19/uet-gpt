/**
 * Phase 6.21A Part 8: chunk-key (structural position identity) semantics
 * stress tests. Quantifies key churn for each edit shape and confirms the
 * key is deliberately position-stable, not semantic-identity-stable.
 *
 * "Storage remains bounded" and "stale keys are removed" for each churn
 * case below are proven at the mutation layer, not here - see
 * tests/convex/crawl/mutations.test.ts's diffAndDeleteStaleChunks tests and
 * tests/convex/crawl/lifecycle-generations.test.ts's T18 (1200-chunk full
 * delete). This file isolates and quantifies the KEY CHURN ITSELF, i.e. how
 * many chunkKeys change for a given edit shape, using the real
 * generateChunks/computeChunkKey (no mocking - these are pure functions).
 */
import { describe, expect, it } from "vitest";
import { generateChunks } from "../../convex/crawl/chunking";
import { computeChunkKey } from "../../convex/crawl/chunkKey";

// Padded well past CHILD_CHUNK_SIZE (800 chars) so each paragraph forms its
// own distinct child chunk instead of being merged with a sibling by
// processSmallBlock - every test below relies on one-paragraph-one-chunk.
function pad(label: string): string {
  return (
    `${label} paragraph with enough words to survive the quality filter easily. ` +
    "It keeps going for a while so this single paragraph alone exceeds the eight " +
    "hundred character child-chunk-size threshold on its own, forcing the chunker " +
    "to treat it as a standalone chunk instead of merging it with whatever " +
    "paragraph happens to sit next to it under the same heading in the source " +
    "document, which is the structural property every assertion below depends on."
  );
}

function keysOf(children: { chunkKey: string }[]): string[] {
  return children.map((c) => c.chunkKey);
}

describe("Part 8: chunk-key churn quantification", () => {
  it("insert: a new chunk before an existing one under the same heading shifts only the later ordinals", async () => {
    const before = `# Section\n\n${pad("First")}\n\n${pad("Second")}\n\n${pad("Third")}`;
    const after = `# Section\n\n${pad("First")}\n\n${pad("Inserted")}\n\n${pad("Second")}\n\n${pad("Third")}`;

    const { children: beforeChildren } = await generateChunks(before, "", "https://example.com/test-doc");
    const { children: afterChildren } = await generateChunks(after, "", "https://example.com/test-doc");
    expect(beforeChildren.length).toBe(3);
    expect(afterChildren.length).toBe(4);

    // Find each labeled paragraph BY ITS CONTENT (not raw array index, since
    // chunkKey is a pure function of (headingPath, ordinal) - comparing key
    // SETS between a 3-item and a 4-item list would trivially "overlap" on
    // ordinals 0-2 regardless of which content occupies them. The only
    // meaningful check is: does the SAME labeled paragraph keep the same key.
    const firstBefore = beforeChildren.find((c) => c.text.includes("First paragraph"))!;
    const firstAfter = afterChildren.find((c) => c.text.includes("First paragraph"))!;
    const secondBefore = beforeChildren.find((c) => c.text.includes("Second paragraph"))!;
    const secondAfter = afterChildren.find((c) => c.text.includes("Second paragraph"))!;
    const thirdBefore = beforeChildren.find((c) => c.text.includes("Third paragraph"))!;
    const thirdAfter = afterChildren.find((c) => c.text.includes("Third paragraph"))!;

    // "First" (before the insertion point) keeps its key...
    expect(firstAfter.chunkKey).toBe(firstBefore.chunkKey);
    // ...but "Second" and "Third" (at and after the insertion point) both
    // churn to a new key, even though their own text is unchanged.
    expect(secondAfter.chunkKey).not.toBe(secondBefore.chunkKey);
    expect(thirdAfter.chunkKey).not.toBe(thirdBefore.chunkKey);
  });

  it("delete: removing a chunk before another under the same heading shifts the later one's ordinal down", async () => {
    const before = `# Section\n\n${pad("First")}\n\n${pad("Second")}\n\n${pad("Third")}`;
    const after = `# Section\n\n${pad("First")}\n\n${pad("Third")}`; // "Second" deleted

    const { children: beforeChildren } = await generateChunks(before, "", "https://example.com/test-doc");
    const { children: afterChildren } = await generateChunks(after, "", "https://example.com/test-doc");
    expect(beforeChildren.length).toBe(3);
    expect(afterChildren.length).toBe(2);

    // "First" (ordinal 0) is unaffected.
    expect(afterChildren[0]!.chunkKey).toBe(beforeChildren[0]!.chunkKey);
    // "Third" shifts from ordinal 2 to ordinal 1 - a new key, even though
    // its own text is unchanged (position-stable, not content-stable).
    const thirdBefore = beforeChildren[2]!;
    const thirdAfter = afterChildren[1]!;
    expect(thirdAfter.text).toContain("Third paragraph");
    expect(thirdAfter.chunkKey).not.toBe(thirdBefore.chunkKey);
  });

  it("split: one large paragraph splitting into two chunks produces one new ordinal, not a renamed single key", async () => {
    // A single paragraph long enough to itself exceed CHILD_CHUNK_SIZE forces
    // chunkMarkdown to split IT into two children under one heading -
    // simulating "one paragraph became two" via an edit.
    const longParagraph = Array.from(
      { length: 20 },
      (_, i) => `Sentence number ${i} in a very long single paragraph that will need splitting.`,
    ).join(" ");
    const doc = `# Section\n\n${longParagraph}`;

    const { children } = await generateChunks(doc, "", "https://example.com/test-doc");
    expect(children.length).toBeGreaterThanOrEqual(2);
    // Every resulting piece gets its own distinct, deterministic key.
    expect(new Set(keysOf(children)).size).toBe(children.length);
    const key0 = await computeChunkKey("https://example.com/test-doc", ["Section"], 0);
    const key1 = await computeChunkKey("https://example.com/test-doc", ["Section"], 1);
    expect(children[0]!.chunkKey).toBe(key0);
    expect(children[1]!.chunkKey).toBe(key1);
  });

  it("merge: two chunks collapsing into one (short paragraphs) produces a single ordinal-0 key", async () => {
    // Unpadded (short) paragraphs are merged into ONE child chunk by
    // processSmallBlock - simulating an edit that merged two paragraphs.
    const doc = "# Section\n\nShort first bit.\n\nShort second bit.";
    const { children } = await generateChunks(doc, "", "https://example.com/test-doc");
    expect(children.length).toBe(1);
    const key0 = await computeChunkKey("https://example.com/test-doc", ["Section"], 0);
    expect(children[0]!.chunkKey).toBe(key0);
  });

  it("heading rename: renaming a heading churns every key under it, but nothing outside it", async () => {
    const before = `# Overview\n\n${pad("A")}\n\n${pad("B")}\n\n# Other Section\n\n${pad("C")}`;
    const after = `# Summary\n\n${pad("A")}\n\n${pad("B")}\n\n# Other Section\n\n${pad("C")}`;

    const { children: beforeChildren } = await generateChunks(before, "", "https://example.com/test-doc");
    const { children: afterChildren } = await generateChunks(after, "", "https://example.com/test-doc");
    expect(beforeChildren.length).toBe(3);
    expect(afterChildren.length).toBe(3);

    const beforeKeys = keysOf(beforeChildren);
    const afterKeys = new Set(keysOf(afterChildren));
    // The renamed heading's 2 chunks (A, B) both churn (headingPath changed).
    // "Other Section"'s chunk (C) is completely unaffected - churn is
    // scoped to the renamed heading's own subtree, not the whole document.
    const survived = beforeKeys.filter((k) => afterKeys.has(k));
    expect(survived.length).toBe(1);
    expect(afterChildren[2]!.chunkKey).toBe(beforeChildren[2]!.chunkKey); // "C" under "Other Section"
  });

  it("heading insertion: splitting one section into two with a new heading only churns chunks from that point onward", async () => {
    const before = `# Section\n\n${pad("A")}\n\n${pad("B")}\n\n${pad("C")}`;
    const after = `# Section\n\n${pad("A")}\n\n## Subsection\n\n${pad("B")}\n\n${pad("C")}`;

    const { children: beforeChildren } = await generateChunks(before, "", "https://example.com/test-doc");
    const { children: afterChildren } = await generateChunks(after, "", "https://example.com/test-doc");
    expect(beforeChildren.length).toBe(3);
    expect(afterChildren.length).toBe(3);

    // "A" (before the new heading) keeps its key.
    expect(afterChildren[0]!.chunkKey).toBe(beforeChildren[0]!.chunkKey);
    // "B" and "C" now live under a DIFFERENT headingPath ("Section >
    // Subsection" instead of "Section"), so both get new keys even though
    // their ordinal-within-their-new-heading resets to 0 and 1.
    expect(afterChildren[1]!.chunkKey).not.toBe(beforeChildren[1]!.chunkKey);
    expect(afterChildren[2]!.chunkKey).not.toBe(beforeChildren[2]!.chunkKey);
    expect(afterChildren[1]!.headingPath).toEqual(["Section", "Subsection"]);
  });

  it("duplicate: two byte-identical paragraphs under one heading get two distinct, coexisting keys (T7 mechanism)", async () => {
    const identical = pad("Repeated");
    // An intro paragraph absorbs chunkMarkdown's "first chunk after a
    // heading includes the heading line itself" behavior, so the two
    // "Repeated" chunks that follow are truly byte-identical to each other
    // (neither is the section's first chunk).
    const doc = `# Section\n\n${pad("Intro")}\n\n${identical}\n\n${identical}`;
    const { children } = await generateChunks(doc, "", "https://example.com/test-doc");

    expect(children.length).toBe(3);
    const [, first, second] = children;
    expect(first!.text).toBe(second!.text); // byte-identical content
    expect(first!.contentHash).toBe(second!.contentHash); // same value hash
    expect(first!.chunkKey).not.toBe(second!.chunkKey); // but DIFFERENT position keys
  });

  it("documents that chunkKey is position-stable, not semantic-identity-stable: swapping two paragraphs' order swaps their keys with each other, not with their content", async () => {
    const before = `# Section\n\n${pad("Alpha")}\n\n${pad("Beta")}`;
    const after = `# Section\n\n${pad("Beta")}\n\n${pad("Alpha")}`; // order swapped

    const { children: beforeChildren } = await generateChunks(before, "", "https://example.com/test-doc");
    const { children: afterChildren } = await generateChunks(after, "", "https://example.com/test-doc");

    // Ordinal 0's key is the SAME in both documents (position-stable)...
    expect(afterChildren[0]!.chunkKey).toBe(beforeChildren[0]!.chunkKey);
    // ...even though the CONTENT at ordinal 0 is now different (was Alpha,
    // now Beta) - the key tracks the SLOT, not the semantic content that
    // happens to occupy it. This is why saveEmbedding's patch-in-place is
    // correct behavior here, not a bug: from the diff's perspective this
    // reads as "ordinal 0's value changed," which is exactly what happened
    // to the retrievable content at that position.
    expect(afterChildren[0]!.text).not.toBe(beforeChildren[0]!.text);
  });

  it("Phase 6.21A regression: two DIFFERENT documents sharing an identical heading breadcrumb get DIFFERENT keys at every position", async () => {
    // The exact real-scale finding: a 199-document local run using generic
    // synthetic headings ("## Section 1", "## Section 2", ...) hit 664
    // cross-document chunkKey collisions before documentUrl was added to
    // the hash - each collision silently deleted an earlier document's RAG
    // vector when a later document's chunk landed on the same key. Two
    // documents here share the exact same heading structure on purpose.
    const sharedStructure = `# Overview\n\n${pad("A")}\n\n${pad("B")}`;
    const { children: docAChildren } = await generateChunks(sharedStructure, "", "https://example.com/doc-a");
    const { children: docBChildren } = await generateChunks(sharedStructure, "", "https://example.com/doc-b");

    expect(docAChildren.length).toBe(docBChildren.length);
    for (let i = 0; i < docAChildren.length; i++) {
      expect(docAChildren[i]!.headingPath).toEqual(docBChildren[i]!.headingPath);
      expect(docAChildren[i]!.text).toBe(docBChildren[i]!.text); // identical content, by construction
      expect(docAChildren[i]!.chunkKey).not.toBe(docBChildren[i]!.chunkKey); // but DIFFERENT keys
    }
  });
});
