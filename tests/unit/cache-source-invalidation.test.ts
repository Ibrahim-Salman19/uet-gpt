import { describe, expect, it } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { findSourceInvalidation } from "../../convex/cache/get";

const docA = "docA" as Id<"documents">;
const docB = "docB" as Id<"documents">;

const entry = {
  sourceEntryIds: ["rag1", "rag2"],
  sourceDocVersions: [
    { documentId: docA, contentHash: "hashA" },
    { documentId: docB, contentHash: "hashB" },
  ],
};

describe("findSourceInvalidation (semantic cache source-version validity)", () => {
  it("serves the hit when every source document is unchanged", () => {
    expect(
      findSourceInvalidation(entry, [
        { contentHash: "hashA", lifecycleStatus: "active" },
        { contentHash: "hashB" },
      ]),
    ).toBeNull();
  });

  it("rejects the hit when any source document's content changed after the write", () => {
    // Regression: the old fast path compared two write-time timestamps and could never fire.
    expect(
      findSourceInvalidation(entry, [{ contentHash: "hashA" }, { contentHash: "hashB-v2" }]),
    ).toBe("SOURCE_DOCUMENT_CHANGED");
  });

  it("does not invalidate on a recrawl that left content unchanged", () => {
    // updatedAt is bumped on unchanged recrawls; only contentHash is compared.
    expect(
      findSourceInvalidation(entry, [{ contentHash: "hashA" }, { contentHash: "hashB" }]),
    ).toBeNull();
  });

  it("rejects deleted, stale, and retired source documents", () => {
    expect(findSourceInvalidation(entry, [{ contentHash: "hashA" }, null])).toBe(
      "SOURCE_DOCUMENT_MISSING",
    );
    expect(
      findSourceInvalidation(entry, [{ contentHash: "hashA", isStale: true }, { contentHash: "hashB" }]),
    ).toBe("SOURCE_DOCUMENT_STALE");
    for (const lifecycleStatus of ["superseded", "withdrawn", "explicitly_stale", "quarantined", "deleted"]) {
      expect(
        findSourceInvalidation(entry, [{ contentHash: "hashA" }, { contentHash: "hashB", lifecycleStatus }]),
      ).toBe("SOURCE_DOCUMENT_RETIRED");
    }
  });

  it("treats cited entries without a version snapshot as unverifiable", () => {
    expect(findSourceInvalidation({ sourceEntryIds: ["rag1"] }, [])).toBe("SOURCE_VERSIONS_UNKNOWN");
  });

  it("has nothing to validate for entries with no cited sources", () => {
    expect(findSourceInvalidation({ sourceEntryIds: [] }, [])).toBeNull();
    expect(findSourceInvalidation({}, [])).toBeNull();
  });
});
