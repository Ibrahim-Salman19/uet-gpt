// Executable RAG Pipeline Invariants for UETGPT

export class InvariantViolationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(`[INVARIANT_VIOLATION:${code}] ${message}`);
    this.name = "InvariantViolationError";
  }
}

/**
 * Asserts embedding vector is 768-dimensional.
 */
export function assertEmbeddingDimension(vector: number[], expectedDim = 768): void {
  if (!Array.isArray(vector) || vector.length !== expectedDim) {
    throw new InvariantViolationError(
      "INVALID_DIMENSION",
      `Expected vector dimension ${expectedDim}, got ${vector?.length}`,
    );
  }
}

/**
 * Asserts every element in vector is a finite number and L2 norm is normalized (~1.0).
 */
export function assertFiniteVector(vector: number[]): void {
  if (!vector.every(Number.isFinite)) {
    throw new InvariantViolationError(
      "NON_FINITE_VECTOR",
      "Vector contains NaN or Infinity values",
    );
  }
  let sumSq = 0;
  for (const v of vector) {
    sumSq += v * v;
  }
  const norm = Math.sqrt(sumSq);
  if (norm < 0.999 || norm > 1.001) {
    throw new InvariantViolationError(
      "UNNORMALIZED_VECTOR",
      `Vector L2 norm must be between 0.999 and 1.001, got ${norm}`,
    );
  }
}

export interface RetrievableDocument {
  status: string;
  lifecycleStatus?: string;
  securityStatus?: string;
  chunksEmbedded?: number;
  chunkCount?: number;
}

/**
 * Document Invariant:
 * Document is retrievable only when status == indexed AND lifecycleStatus == active
 * AND securityStatus != rejected AND embedding coverage is complete.
 */
export function assertDocumentRetrievable(doc: RetrievableDocument): void {
  if (doc.status !== "indexed" && doc.status !== "active") {
    throw new InvariantViolationError(
      "DOC_NOT_INDEXED",
      `Document status '${doc.status}' is not retrievable`,
    );
  }
  if (doc.lifecycleStatus && doc.lifecycleStatus !== "active") {
    throw new InvariantViolationError(
      "DOC_LIFECYCLE_EXCLUDED",
      `Document lifecycleStatus '${doc.lifecycleStatus}' is not active`,
    );
  }
  if (doc.securityStatus === "quarantined" || doc.securityStatus === "rejected") {
    throw new InvariantViolationError(
      "DOC_SECURITY_EXCLUDED",
      `Document securityStatus '${doc.securityStatus}' is excluded`,
    );
  }
  if (
    typeof doc.chunkCount === "number" &&
    typeof doc.chunksEmbedded === "number" &&
    doc.chunksEmbedded < doc.chunkCount
  ) {
    throw new InvariantViolationError(
      "INCOMPLETE_EMBEDDINGS",
      `Document embeddings incomplete (${doc.chunksEmbedded}/${doc.chunkCount})`,
    );
  }
}

export interface HighCurrentDecisionInput {
  freshPrimarySourceCount: number;
  applicability: string;
  unresolvedCriticalConflict: boolean;
  citationCoveragePossible: boolean;
}

/**
 * High-current Evidence Invariant:
 * A high-current answer is allowed only when freshPrimarySourceCount >= 1 AND applicability == current
 * AND unresolvedCriticalConflict == false AND citationCoveragePossible == true.
 */
export function assertHighCurrentEvidence(input: HighCurrentDecisionInput): void {
  if (input.freshPrimarySourceCount < 1) {
    throw new InvariantViolationError(
      "NO_FRESH_PRIMARY_SOURCE",
      "High-current answer requires at least 1 fresh primary source",
    );
  }
  if (input.applicability !== "current") {
    throw new InvariantViolationError(
      "INAPPLICABLE_TEMPORAL_STATE",
      `High-current answer requires applicability 'current', got '${input.applicability}'`,
    );
  }
  if (input.unresolvedCriticalConflict) {
    throw new InvariantViolationError(
      "UNRESOLVED_CRITICAL_CONFLICT",
      "High-current answer cannot be issued with unresolved critical conflicts",
    );
  }
  if (!input.citationCoveragePossible) {
    throw new InvariantViolationError(
      "NO_CITATION_COVERAGE",
      "High-current answer requires verifiable citation coverage",
    );
  }
}

export interface CacheEntryMetadata {
  expiresAt: number;
  retrievalPolicyVersion?: string;
  evidencePolicyVersion?: string;
  corpusGeneration?: string;
  anySourceSuperseded?: boolean;
}

/**
 * Cache Invariant:
 * A cache entry is usable only when not expired, policy versions match, corpus generation matches,
 * and no required source has been superseded or withdrawn.
 */
export function assertCacheEntryCompatible(
  entry: CacheEntryMetadata,
  currentPolicy: {
    retrievalPolicyVersion: string;
    evidencePolicyVersion: string;
    corpusGeneration: string;
  },
): void {
  if (Date.now() >= entry.expiresAt) {
    throw new InvariantViolationError("CACHE_EXPIRED", "Cache entry has expired");
  }
  if (
    entry.retrievalPolicyVersion &&
    entry.retrievalPolicyVersion !== currentPolicy.retrievalPolicyVersion
  ) {
    throw new InvariantViolationError("CACHE_POLICY_MISMATCH", "Retrieval policy version mismatch");
  }
  if (
    entry.evidencePolicyVersion &&
    entry.evidencePolicyVersion !== currentPolicy.evidencePolicyVersion
  ) {
    throw new InvariantViolationError("CACHE_POLICY_MISMATCH", "Evidence policy version mismatch");
  }
  if (entry.corpusGeneration && entry.corpusGeneration !== currentPolicy.corpusGeneration) {
    throw new InvariantViolationError("CORPUS_GENERATION_MISMATCH", "Corpus generation mismatch");
  }
  if (entry.anySourceSuperseded) {
    throw new InvariantViolationError(
      "SOURCE_SUPERSEDED",
      "Cache depends on a superseded source version",
    );
  }
}

export interface IngestionRunMetadata {
  expectedChunkCount: number;
  persistedChunkCount: number;
  embeddedChunkCount: number;
  everyEmbeddingDimension: number;
  runGeneration: string;
  latestSourceGeneration: string;
}

/**
 * Ingestion Invariant:
 * Publication is allowed only when expectedChunkCount == persistedChunkCount == embeddedChunkCount
 * AND every embedding dimension is 768 AND runGeneration matches latestSourceGeneration.
 */
export function assertIngestionPublishable(meta: IngestionRunMetadata): void {
  if (meta.expectedChunkCount !== meta.persistedChunkCount) {
    throw new InvariantViolationError(
      "INGESTION_CHUNK_MISMATCH",
      `Persisted chunk count ${meta.persistedChunkCount} != expected ${meta.expectedChunkCount}`,
    );
  }
  if (meta.expectedChunkCount !== meta.embeddedChunkCount) {
    throw new InvariantViolationError(
      "INGESTION_EMBEDDING_MISMATCH",
      `Embedded chunk count ${meta.embeddedChunkCount} != expected ${meta.expectedChunkCount}`,
    );
  }
  if (meta.everyEmbeddingDimension !== 768) {
    throw new InvariantViolationError(
      "INVALID_DIMENSION",
      `Ingestion embedding dimension ${meta.everyEmbeddingDimension} != 768`,
    );
  }
  if (meta.runGeneration !== meta.latestSourceGeneration) {
    throw new InvariantViolationError(
      "OBSOLETE_INGESTION_RUN",
      `Ingestion run generation ${meta.runGeneration} is superseded by ${meta.latestSourceGeneration}`,
    );
  }
}
