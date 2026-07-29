import { describe, expect, it } from "vitest";
import {
  assertCacheEntryCompatible,
  assertDocumentRetrievable,
  assertEmbeddingDimension,
  assertFiniteVector,
  assertHighCurrentEvidence,
  assertIngestionPublishable,
  InvariantViolationError,
} from "../../convex/shared/invariants";

describe("Executable RAG Invariants", () => {
  it("validates embedding dimensions", () => {
    expect(() => assertEmbeddingDimension(new Array(768).fill(0.1), 768)).not.toThrow();
    expect(() => assertEmbeddingDimension(new Array(512).fill(0.1), 768)).toThrow(
      InvariantViolationError,
    );
  });

  it("validates finite vector and L2 normalization", () => {
    // Unit vector
    const unitVec = new Array(768).fill(0);
    unitVec[0] = 1.0;
    expect(() => assertFiniteVector(unitVec)).not.toThrow();

    // Non-finite
    const badVec = [...unitVec];
    badVec[1] = NaN;
    expect(() => assertFiniteVector(badVec)).toThrow(InvariantViolationError);

    // Unnormalized vector
    const unnormVec = new Array(768).fill(1.0);
    expect(() => assertFiniteVector(unnormVec)).toThrow(InvariantViolationError);
  });

  it("validates document retrievability", () => {
    expect(() =>
      assertDocumentRetrievable({
        status: "indexed",
        lifecycleStatus: "active",
        securityStatus: "approved",
        chunkCount: 5,
        chunksEmbedded: 5,
      }),
    ).not.toThrow();

    expect(() =>
      assertDocumentRetrievable({
        status: "failed",
      }),
    ).toThrow(InvariantViolationError);

    expect(() =>
      assertDocumentRetrievable({
        status: "indexed",
        lifecycleStatus: "superseded",
      }),
    ).toThrow(InvariantViolationError);
  });

  it("validates high-current evidence requirement", () => {
    expect(() =>
      assertHighCurrentEvidence({
        freshPrimarySourceCount: 1,
        applicability: "current",
        unresolvedCriticalConflict: false,
        citationCoveragePossible: true,
      }),
    ).not.toThrow();

    expect(() =>
      assertHighCurrentEvidence({
        freshPrimarySourceCount: 0,
        applicability: "current",
        unresolvedCriticalConflict: false,
        citationCoveragePossible: true,
      }),
    ).toThrow(InvariantViolationError);
  });

  it("validates cache compatibility", () => {
    const policy = {
      retrievalPolicyVersion: "v1.0",
      evidencePolicyVersion: "v1.0",
      corpusGeneration: "gen-123",
    };
    expect(() =>
      assertCacheEntryCompatible(
        {
          expiresAt: Date.now() + 10000,
          retrievalPolicyVersion: "v1.0",
          evidencePolicyVersion: "v1.0",
          corpusGeneration: "gen-123",
        },
        policy,
      ),
    ).not.toThrow();

    expect(() =>
      assertCacheEntryCompatible(
        {
          expiresAt: Date.now() - 1000,
        },
        policy,
      ),
    ).toThrow(InvariantViolationError);
  });

  it("validates ingestion publishability", () => {
    expect(() =>
      assertIngestionPublishable({
        expectedChunkCount: 10,
        persistedChunkCount: 10,
        embeddedChunkCount: 10,
        everyEmbeddingDimension: 768,
        runGeneration: "gen-1",
        latestSourceGeneration: "gen-1",
      }),
    ).not.toThrow();

    expect(() =>
      assertIngestionPublishable({
        expectedChunkCount: 10,
        persistedChunkCount: 9,
        embeddedChunkCount: 10,
        everyEmbeddingDimension: 768,
        runGeneration: "gen-1",
        latestSourceGeneration: "gen-1",
      }),
    ).toThrow(InvariantViolationError);
  });
});
