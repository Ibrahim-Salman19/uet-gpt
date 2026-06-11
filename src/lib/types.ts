type MessageRole = "user" | "assistant";

export interface Source {
  id?: string;
  type?: string;
  sourceType?: string;
  url: string;
  title: string;
  // Legacy fields
  documentId?: string;
  chunkId?: string;
  relevanceScore?: number;
  excerpt?: string;
  // Agent fields
  providerOptions?: {
    entryId?: string;
    chunkId?: string;
    excerpt?: string;
    relevanceScore?: number;
  };
}

export interface TokenCount {
  prompt: number;
  completion: number;
  total: number;
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
