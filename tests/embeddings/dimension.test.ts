import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMBEDDING_DIMENSION } from "../../convex/embeddings/dimension";

/**
 * Regression guard for the AGENTS.md forbidden operation: changing
 * embeddingDimension corrupts the live vector index and requires a full ($$$)
 * re-embed. The value 768 is duplicated as a numeric literal in schema.ts
 * (vectorIndex dimensions cannot import a runtime constant) and used in
 * generate.ts. This test asserts all three sites agree and that the value stays
 * 768 — catching an accidental divergence before it ships.
 */
describe("embedding dimension consistency", () => {
  it("exports 768 (gemini-embedding-2 fixed dimension)", () => {
    expect(EMBEDDING_DIMENSION).toBe(768);
  });

  it("schema.ts semanticCache vectorIndex dimension matches the constant", () => {
    const schema = readFileSync(
      join(__dirname, "..", "..", "convex", "schema.ts"),
      "utf8",
    );
    // Match the vectorIndex dimensions literal on semanticCache.by_queryEmbedding.
    const match = schema.match(/dimensions:\s*(\d+)/);
    expect(match, "schema.ts must declare a vectorIndex `dimensions` literal").not.toBeNull();
    expect(Number(match![1])).toBe(EMBEDDING_DIMENSION);
  });

  it("generate.ts has no stray 768 literal outside the dimension constant", () => {
    const generate = readFileSync(
      join(__dirname, "..", "..", "convex", "embeddings", "generate.ts"),
      "utf8",
    );
    // The only `768` in generate.ts should now flow through EMBEDDING_DIMENSION.
    // Any remaining bare `768` numeric literal (outside the constant import) is a
    // sign someone re-hardcoded it. Allow the literal only inside the comment
    // block at the top of the file and the dimension.ts import source path.
    const lines = generate.split("\n");
    const bareLiteralLines = lines.filter(
      (l) => /\b768\b/.test(l) && !l.includes("EMBEDDING_DIMENSION") && !l.trim().startsWith("//"),
    );
    expect(
      bareLiteralLines,
      `generate.ts should not contain a bare 768 literal: ${bareLiteralLines.join("\n")}`,
    ).toHaveLength(0);
  });
});
