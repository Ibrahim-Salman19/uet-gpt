/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_settings from "../admin/settings.js";
import type * as admin_stats from "../admin/stats.js";
import type * as admin_tableExport from "../admin/tableExport.js";
import type * as agent_contracts from "../agent/contracts.js";
import type * as agent_execute from "../agent/execute.js";
import type * as agent_policy from "../agent/policy.js";
import type * as agent_state from "../agent/state.js";
import type * as auth from "../auth.js";
import type * as cache_get from "../cache/get.js";
import type * as cache_internal_queries from "../cache/internal_queries.js";
import type * as cache_multiVector from "../cache/multiVector.js";
import type * as cache_set from "../cache/set.js";
import type * as cache_validate from "../cache/validate.js";
import type * as clerk_webhook from "../clerk/webhook.js";
import type * as constants from "../constants.js";
import type * as crawl_actions from "../crawl/actions.js";
import type * as crawl_backfill from "../crawl/backfill.js";
import type * as crawl_bulkOperationsControl from "../crawl/bulkOperationsControl.js";
import type * as crawl_chunkKey from "../crawl/chunkKey.js";
import type * as crawl_chunking from "../crawl/chunking.js";
import type * as crawl_deduplication from "../crawl/deduplication.js";
import type * as crawl_emergencyStop from "../crawl/emergencyStop.js";
import type * as crawl_exportCorpus from "../crawl/exportCorpus.js";
import type * as crawl_jobs from "../crawl/jobs.js";
import type * as crawl_lexicalProof from "../crawl/lexicalProof.js";
import type * as crawl_list from "../crawl/list.js";
import type * as crawl_mutations from "../crawl/mutations.js";
import type * as crawl_queries from "../crawl/queries.js";
import type * as crawl_reconciliation from "../crawl/reconciliation.js";
import type * as crawl_reset from "../crawl/reset.js";
import type * as crawl_reset_ops from "../crawl/reset_ops.js";
import type * as crawl_staleness from "../crawl/staleness.js";
import type * as crawl_status from "../crawl/status.js";
import type * as crawl_tasks from "../crawl/tasks.js";
import type * as crawl_trigger from "../crawl/trigger.js";
import type * as crawl_utils from "../crawl/utils.js";
import type * as crawl_webhook from "../crawl/webhook.js";
import type * as crawl_workflow from "../crawl/workflow.js";
import type * as crawl_workpools from "../crawl/workpools.js";
import type * as crons from "../crons.js";
import type * as doc_create from "../doc/create.js";
import type * as doc_get from "../doc/get.js";
import type * as doc_index from "../doc/index.js";
import type * as doc_list from "../doc/list.js";
import type * as doc_remove from "../doc/remove.js";
import type * as doc_search from "../doc/search.js";
import type * as doc_validator from "../doc/validator.js";
import type * as embeddings_chunkTextSearch from "../embeddings/chunkTextSearch.js";
import type * as embeddings_cloudflareEmbed from "../embeddings/cloudflareEmbed.js";
import type * as embeddings_contextualize from "../embeddings/contextualize.js";
import type * as embeddings_contextualizeCron from "../embeddings/contextualizeCron.js";
import type * as embeddings_dimension from "../embeddings/dimension.js";
import type * as embeddings_doc_queries from "../embeddings/doc_queries.js";
import type * as embeddings_generate from "../embeddings/generate.js";
import type * as embeddings_hybridRank from "../embeddings/hybridRank.js";
import type * as embeddings_idf from "../embeddings/idf.js";
import type * as embeddings_metadata from "../embeddings/metadata.js";
import type * as embeddings_nearDuplicates from "../embeddings/nearDuplicates.js";
import type * as embeddings_search from "../embeddings/search.js";
import type * as emergencyStop from "../emergencyStop.js";
import type * as eval from "../eval.js";
import type * as eval_constants from "../eval/constants.js";
import type * as eval_exportDataset from "../eval/exportDataset.js";
import type * as eval_runEval from "../eval/runEval.js";
import type * as evaluation_acceptanceGate from "../evaluation/acceptanceGate.js";
import type * as evaluation_metrics from "../evaluation/metrics.js";
import type * as evaluation_promotion from "../evaluation/promotion.js";
import type * as evaluation_suites from "../evaluation/suites.js";
import type * as faq from "../faq.js";
import type * as feedback_list from "../feedback/list.js";
import type * as feedback_submit from "../feedback/submit.js";
import type * as generation_context from "../generation/context.js";
import type * as governance_evidenceGate from "../governance/evidenceGate.js";
import type * as governance_freshnessSweep from "../governance/freshnessSweep.js";
import type * as governance_structuredFacts from "../governance/structuredFacts.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as knowledgeStore_compositeStore from "../knowledgeStore/compositeStore.js";
import type * as knowledgeStore_convexAdapter from "../knowledgeStore/convexAdapter.js";
import type * as knowledgeStore_convexMutations from "../knowledgeStore/convexMutations.js";
import type * as knowledgeStore_convexQueries from "../knowledgeStore/convexQueries.js";
import type * as knowledgeStore_denseSearchAction from "../knowledgeStore/denseSearchAction.js";
import type * as knowledgeStore_lifecycleTest from "../knowledgeStore/lifecycleTest.js";
import type * as knowledgeStore_pineconeAdapter from "../knowledgeStore/pineconeAdapter.js";
import type * as knowledgeStore_pineconeLifecycleTest from "../knowledgeStore/pineconeLifecycleTest.js";
import type * as knowledgeStore_types from "../knowledgeStore/types.js";
import type * as lib_db_helpers from "../lib/db_helpers.js";
import type * as messages from "../messages.js";
import type * as messages_validator from "../messages/validator.js";
import type * as observability_dashboard from "../observability/dashboard.js";
import type * as observability_events from "../observability/events.js";
import type * as observability_index from "../observability/index.js";
import type * as observability_internal from "../observability/internal.js";
import type * as observability_metrics from "../observability/metrics.js";
import type * as observability_metricsAggregator from "../observability/metricsAggregator.js";
import type * as observability_staleness from "../observability/staleness.js";
import type * as observability_trace from "../observability/trace.js";
import type * as people_queries from "../people/queries.js";
import type * as providers_registry from "../providers/registry.js";
import type * as rag_constants from "../rag/constants.js";
import type * as rag_context from "../rag/context.js";
import type * as rag_crag from "../rag/crag.js";
import type * as rag_evalRetrieval from "../rag/evalRetrieval.js";
import type * as rag_faithfulness from "../rag/faithfulness.js";
import type * as rag_instance from "../rag/instance.js";
import type * as rag_modelRegistry from "../rag/modelRegistry.js";
import type * as rag_prompts from "../rag/prompts.js";
import type * as rag_retrieval from "../rag/retrieval.js";
import type * as rag_routing from "../rag/routing.js";
import type * as rag_smokeRetrieval from "../rag/smokeRetrieval.js";
import type * as rag_testing from "../rag/testing.js";
import type * as rateLimit from "../rateLimit.js";
import type * as reranking_cascade from "../reranking/cascade.js";
import type * as reranking_cloudflareRerank from "../reranking/cloudflareRerank.js";
import type * as reranking_groqRerank from "../reranking/groqRerank.js";
import type * as reranking_rerank from "../reranking/rerank.js";
import type * as routing_understandQuery from "../routing/understandQuery.js";
import type * as security_requestGuard from "../security/requestGuard.js";
import type * as shared_faqMatch from "../shared/faqMatch.js";
import type * as shared_freshnessPolicy from "../shared/freshnessPolicy.js";
import type * as shared_invariants from "../shared/invariants.js";
import type * as threads from "../threads.js";
import type * as threads_validator from "../threads/validator.js";
import type * as users from "../users.js";
import type * as users_validator from "../users/validator.js";
import type * as verification_conflictDetector from "../verification/conflictDetector.js";
import type * as verification_officialSourceVerifier from "../verification/officialSourceVerifier.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/settings": typeof admin_settings;
  "admin/stats": typeof admin_stats;
  "admin/tableExport": typeof admin_tableExport;
  "agent/contracts": typeof agent_contracts;
  "agent/execute": typeof agent_execute;
  "agent/policy": typeof agent_policy;
  "agent/state": typeof agent_state;
  auth: typeof auth;
  "cache/get": typeof cache_get;
  "cache/internal_queries": typeof cache_internal_queries;
  "cache/multiVector": typeof cache_multiVector;
  "cache/set": typeof cache_set;
  "cache/validate": typeof cache_validate;
  "clerk/webhook": typeof clerk_webhook;
  constants: typeof constants;
  "crawl/actions": typeof crawl_actions;
  "crawl/backfill": typeof crawl_backfill;
  "crawl/bulkOperationsControl": typeof crawl_bulkOperationsControl;
  "crawl/chunkKey": typeof crawl_chunkKey;
  "crawl/chunking": typeof crawl_chunking;
  "crawl/deduplication": typeof crawl_deduplication;
  "crawl/emergencyStop": typeof crawl_emergencyStop;
  "crawl/exportCorpus": typeof crawl_exportCorpus;
  "crawl/jobs": typeof crawl_jobs;
  "crawl/lexicalProof": typeof crawl_lexicalProof;
  "crawl/list": typeof crawl_list;
  "crawl/mutations": typeof crawl_mutations;
  "crawl/queries": typeof crawl_queries;
  "crawl/reconciliation": typeof crawl_reconciliation;
  "crawl/reset": typeof crawl_reset;
  "crawl/reset_ops": typeof crawl_reset_ops;
  "crawl/staleness": typeof crawl_staleness;
  "crawl/status": typeof crawl_status;
  "crawl/tasks": typeof crawl_tasks;
  "crawl/trigger": typeof crawl_trigger;
  "crawl/utils": typeof crawl_utils;
  "crawl/webhook": typeof crawl_webhook;
  "crawl/workflow": typeof crawl_workflow;
  "crawl/workpools": typeof crawl_workpools;
  crons: typeof crons;
  "doc/create": typeof doc_create;
  "doc/get": typeof doc_get;
  "doc/index": typeof doc_index;
  "doc/list": typeof doc_list;
  "doc/remove": typeof doc_remove;
  "doc/search": typeof doc_search;
  "doc/validator": typeof doc_validator;
  "embeddings/chunkTextSearch": typeof embeddings_chunkTextSearch;
  "embeddings/cloudflareEmbed": typeof embeddings_cloudflareEmbed;
  "embeddings/contextualize": typeof embeddings_contextualize;
  "embeddings/contextualizeCron": typeof embeddings_contextualizeCron;
  "embeddings/dimension": typeof embeddings_dimension;
  "embeddings/doc_queries": typeof embeddings_doc_queries;
  "embeddings/generate": typeof embeddings_generate;
  "embeddings/hybridRank": typeof embeddings_hybridRank;
  "embeddings/idf": typeof embeddings_idf;
  "embeddings/metadata": typeof embeddings_metadata;
  "embeddings/nearDuplicates": typeof embeddings_nearDuplicates;
  "embeddings/search": typeof embeddings_search;
  emergencyStop: typeof emergencyStop;
  eval: typeof eval;
  "eval/constants": typeof eval_constants;
  "eval/exportDataset": typeof eval_exportDataset;
  "eval/runEval": typeof eval_runEval;
  "evaluation/acceptanceGate": typeof evaluation_acceptanceGate;
  "evaluation/metrics": typeof evaluation_metrics;
  "evaluation/promotion": typeof evaluation_promotion;
  "evaluation/suites": typeof evaluation_suites;
  faq: typeof faq;
  "feedback/list": typeof feedback_list;
  "feedback/submit": typeof feedback_submit;
  "generation/context": typeof generation_context;
  "governance/evidenceGate": typeof governance_evidenceGate;
  "governance/freshnessSweep": typeof governance_freshnessSweep;
  "governance/structuredFacts": typeof governance_structuredFacts;
  health: typeof health;
  http: typeof http;
  "knowledgeStore/compositeStore": typeof knowledgeStore_compositeStore;
  "knowledgeStore/convexAdapter": typeof knowledgeStore_convexAdapter;
  "knowledgeStore/convexMutations": typeof knowledgeStore_convexMutations;
  "knowledgeStore/convexQueries": typeof knowledgeStore_convexQueries;
  "knowledgeStore/denseSearchAction": typeof knowledgeStore_denseSearchAction;
  "knowledgeStore/lifecycleTest": typeof knowledgeStore_lifecycleTest;
  "knowledgeStore/pineconeAdapter": typeof knowledgeStore_pineconeAdapter;
  "knowledgeStore/pineconeLifecycleTest": typeof knowledgeStore_pineconeLifecycleTest;
  "knowledgeStore/types": typeof knowledgeStore_types;
  "lib/db_helpers": typeof lib_db_helpers;
  messages: typeof messages;
  "messages/validator": typeof messages_validator;
  "observability/dashboard": typeof observability_dashboard;
  "observability/events": typeof observability_events;
  "observability/index": typeof observability_index;
  "observability/internal": typeof observability_internal;
  "observability/metrics": typeof observability_metrics;
  "observability/metricsAggregator": typeof observability_metricsAggregator;
  "observability/staleness": typeof observability_staleness;
  "observability/trace": typeof observability_trace;
  "people/queries": typeof people_queries;
  "providers/registry": typeof providers_registry;
  "rag/constants": typeof rag_constants;
  "rag/context": typeof rag_context;
  "rag/crag": typeof rag_crag;
  "rag/evalRetrieval": typeof rag_evalRetrieval;
  "rag/faithfulness": typeof rag_faithfulness;
  "rag/instance": typeof rag_instance;
  "rag/modelRegistry": typeof rag_modelRegistry;
  "rag/prompts": typeof rag_prompts;
  "rag/retrieval": typeof rag_retrieval;
  "rag/routing": typeof rag_routing;
  "rag/smokeRetrieval": typeof rag_smokeRetrieval;
  "rag/testing": typeof rag_testing;
  rateLimit: typeof rateLimit;
  "reranking/cascade": typeof reranking_cascade;
  "reranking/cloudflareRerank": typeof reranking_cloudflareRerank;
  "reranking/groqRerank": typeof reranking_groqRerank;
  "reranking/rerank": typeof reranking_rerank;
  "routing/understandQuery": typeof routing_understandQuery;
  "security/requestGuard": typeof security_requestGuard;
  "shared/faqMatch": typeof shared_faqMatch;
  "shared/freshnessPolicy": typeof shared_freshnessPolicy;
  "shared/invariants": typeof shared_invariants;
  threads: typeof threads;
  "threads/validator": typeof threads_validator;
  users: typeof users;
  "users/validator": typeof users_validator;
  "verification/conflictDetector": typeof verification_conflictDetector;
  "verification/officialSourceVerifier": typeof verification_officialSourceVerifier;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rag: import("@convex-dev/rag/_generated/component.js").ComponentApi<"rag">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  embeddingWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"embeddingWorkpool">;
  crawlWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"crawlWorkpool">;
  crawlWorkflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"crawlWorkflow">;
};
