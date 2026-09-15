export type ModelTask =
  | "security_classification"
  | "query_understanding"
  | "query_rewrite"
  | "hyde"
  | "embedding"
  | "reranking"
  | "critical_fact_extraction"
  | "crag"
  | "answer_generation"
  | "output_validation";

export interface ModelRouteDefinition {
  task: ModelTask;
  primaryProvider: "openai" | "google" | "cohere" | "groq" | "local";
  primaryModel: string;
  fallbackProvider?: "openai" | "google" | "cohere" | "groq" | "local";
  fallbackModel?: string;
  expectedDimension?: number;
  deprecatedAfter?: number;
  circuitBreakerOpen?: boolean;
}

export const PRODUCTION_MODEL_REGISTRY: Record<ModelTask, ModelRouteDefinition> = {
  security_classification: {
    task: "security_classification",
    primaryProvider: "openai",
    primaryModel: "openai/gpt-oss-20b",
    fallbackProvider: "google",
    fallbackModel: "gemini-2.5-flash",
  },
  query_understanding: {
    task: "query_understanding",
    primaryProvider: "openai",
    primaryModel: "openai/gpt-oss-20b",
    fallbackProvider: "google",
    fallbackModel: "gemini-2.5-flash",
  },
  query_rewrite: {
    task: "query_rewrite",
    primaryProvider: "openai",
    primaryModel: "openai/gpt-oss-20b",
  },
  hyde: {
    task: "hyde",
    primaryProvider: "openai",
    primaryModel: "openai/gpt-oss-20b",
  },
  embedding: {
    task: "embedding",
    primaryProvider: "google",
    primaryModel: "gemini-embedding-2",
    expectedDimension: 768,
  },
  reranking: {
    task: "reranking",
    primaryProvider: "cohere",
    primaryModel: "rerank-v4.0-fast",
    fallbackProvider: "local",
    fallbackModel: "bge-reranker-large",
  },
  critical_fact_extraction: {
    task: "critical_fact_extraction",
    primaryProvider: "openai",
    primaryModel: "openai/gpt-oss-20b",
  },
  crag: {
    task: "crag",
    primaryProvider: "google",
    primaryModel: "gemini-2.5-flash",
  },
  answer_generation: {
    task: "answer_generation",
    primaryProvider: "openai",
    primaryModel: "openai/gpt-oss-20b",
    fallbackProvider: "google",
    fallbackModel: "gemini-2.5-flash",
  },
  output_validation: {
    task: "output_validation",
    primaryProvider: "openai",
    primaryModel: "openai/gpt-oss-20b",
  },
};

export function validateEmbeddingDimension(embedding: number[]): {
  valid: boolean;
  dimension: number;
} {
  const dimension = embedding.length;
  if (dimension !== 768) {
    return { valid: false, dimension };
  }
  return { valid: true, dimension };
}

export function getActiveModelRoute(task: ModelTask): ModelRouteDefinition {
  const route = PRODUCTION_MODEL_REGISTRY[task];
  if (!route) {
    throw new Error(`Unmapped model task: ${task}`);
  }
  if (route.deprecatedAfter && Date.now() > route.deprecatedAfter) {
    if (route.fallbackModel && route.fallbackProvider) {
      return {
        ...route,
        primaryProvider: route.fallbackProvider,
        primaryModel: route.fallbackModel,
      };
    }
    throw new Error(`Primary model for task ${task} is deprecated and no fallback is registered.`);
  }
  return route;
}
