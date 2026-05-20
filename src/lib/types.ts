export type Id<T extends string> = string & { __tableName: T };

export type UserRole = "user" | "admin" | "superadmin";

export type DocumentStatus = "pending" | "processing" | "indexed" | "failed" | "stale";

export type CrawlStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type CrawlTrigger = "manual" | "scheduled" | "webhook";

export type FeedbackRating = "thumbsUp" | "thumbsDown";

export type FeedbackCategory = "accurate" | "inaccurate" | "incomplete" | "irrelevant" | "other";

export type MessageRole = "user" | "assistant";

export type QueryCategory =
  | "admissions"
  | "academic"
  | "administrative"
  | "campus_life"
  | "general"
  | "off_topic"
  | "simple_fact";

export interface Source {
  documentId: Id<"documents">;
  chunkId: Id<"chunks">;
  url: string;
  title: string;
  relevanceScore: number;
  excerpt: string;
}

export interface TokenCount {
  prompt: number;
  completion: number;
  total: number;
}

export interface CrawlConfig {
  maxPages: number;
  maxDepth: number;
  includePaths: string[];
  excludePaths: string[];
  allowExternalLinks: boolean;
}

export interface CrawlStats {
  totalPages: number;
  successfulPages: number;
  failedPages: number;
  skippedPages: number;
  totalChunks: number;
  totalTokens: number;
  bytesProcessed: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  sources?: Source[];
  model?: string;
  latency?: number;
  tokenCount?: TokenCount;
}

export interface Thread {
  _id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}
