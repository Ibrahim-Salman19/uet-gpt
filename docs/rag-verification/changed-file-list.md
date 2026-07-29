# Exact List of Files Created and Modified During Hardening

## Created Files
1. `convex/shared/invariants.ts` - Executable RAG pipeline invariants
2. `tests/unit/invariants.test.ts` - Unit tests for executable invariants
3. `convex/verification/conflictDetector.ts` - Deterministic conflict detector module
4. `tests/unit/conflict-detector.test.ts` - Unit tests for conflict detector
5. `docs/rag-verification/baseline.md` - Master baseline manifest
6. `docs/rag-verification/file-inventory.csv` - File inventory & ownership CSV
7. `docs/rag-verification/model-routes.json` - Active model routes JSON
8. `docs/rag-verification/schema-snapshot.md` - Convex schema snapshot
9. `docs/rag-verification/index-snapshot.md` - Convex index snapshot
10. `docs/rag-verification/cron-snapshot.md` - Convex cron snapshot
11. `docs/rag-verification/test-baseline.json` - Test baseline execution JSON
12. `docs/rag-verification/retrieval-baseline.json` - Retrieval baseline JSON
13. `docs/rag-verification/usage-baseline.json` - Usage baseline JSON
14. `docs/rag-verification/request-flow.mmd` - Request flow Mermaid diagram
15. `docs/rag-verification/ingestion-flow.mmd` - Ingestion flow Mermaid diagram
16. `docs/rag-verification/dependency-graph.json` - Dependency graph JSON
17. `docs/rag-verification/ownership-matrix.md` - Component ownership matrix
18. `docs/rag-verification/provider-compatibility-report.md` - Provider compatibility audit
19. `docs/rag-verification/embedding-compatibility-report.md` - Embedding scientific verification
20. `docs/rag-verification/ingestion-integrity-report.md` - Ingestion pipeline integrity
21. `docs/rag-verification/retrieval-channel-evaluation.md` - Retrieval channel evaluation
22. `docs/rag-verification/fusion-overfetch-evaluation.md` - Hybrid fusion & overfetch evaluation
23. `docs/rag-verification/temporal-evaluation.md` - Temporal governance evaluation
24. `docs/rag-verification/cache-evaluation.md` - Cache evaluation report
25. `docs/rag-verification/reranker-benchmark.md` - Reranker cascade benchmark
26. `docs/rag-verification/evidence-sufficiency-evaluation.md` - Evidence gating evaluation
27. `docs/rag-verification/conflict-evaluation.md` - Conflict detection evaluation
28. `docs/rag-verification/security-red-team-report.md` - Security red-team report
29. `docs/rag-verification/citation-evaluation.md` - Citation grounding evaluation
30. `docs/rag-verification/failure-injection-report.md` - Failure injection report
31. `docs/rag-verification/load-and-cost-report.md` - Load, latency & cost report
32. `docs/rag-verification/preview-report.md` - Preview report
33. `docs/rag-verification/shadow-report.md` - Shadow report
34. `docs/rag-verification/canary-report.md` - Canary report
35. `docs/rag-verification/rollback-report.md` - Rollback report
36. `docs/rag-verification/changed-file-list.md` - Changed file list manifest
37. `docs/rag-verification/unresolved-risks.md` - Residual risk audit
38. `docs/rag-verification/final-production-verdict.md` - Final production verdict

## Modified Files
1. `convex/embeddings/generate.ts` - Enforced `assertEmbeddingDimension` and `assertFiniteVector` on returned embeddings.
2. `convex/reranking/cascade.ts` - Removed `@ts-nocheck` to enforce strict type checking.
3. `convex/rag/constants.ts` - Updated Cohere model ID to `rerank-v3.5`.
