"use client";

import { useEffect, useState } from "react";
import { useStableQuery } from "@/hooks/use-stable-query";
import type { ChatMessage, Source, TokenCount } from "@/lib/types";
import { api } from "../../convex/_generated/api";
import { streamRegistry } from "./stream-registry";

// Shape of a message document returned by api.messages.list. Defined locally
// because the Convex generated `Doc<"messages">` types are not always present
// (e.g. before `convex dev`/codegen has run).
interface MessageDoc {
  _id: string;
  role: ChatMessage["role"];
  content: string;
  sources?: Source[];
  tokenCount?: TokenCount;
}

export function useMessages(threadId: string | undefined) {
  const messagesData = useStableQuery(api.messages.list, threadId ? { threadId } : "skip");

  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);

  useEffect(() => {
    if (!threadId) {
      setStreamingMessage(null);
      return;
    }

    // Register listener for streaming message updates
    const listener = (content: string, sources?: Source[]) => {
      if (!content && (!sources || sources.length === 0)) {
        setStreamingMessage(null);
      } else {
        setStreamingMessage({
          id: "streaming-message",
          role: "assistant",
          content,
          sources,
        });
      }
    };
    streamRegistry.register(threadId, listener);

    return () => {
      streamRegistry.unregister(threadId, listener);
    };
  }, [threadId]);

  const isLoading = threadId ? messagesData === undefined : false;

  // Map Convex messages format to ChatMessage frontend interface
  const dbMessages: ChatMessage[] = ((messagesData ?? []) as MessageDoc[]).map((msg) => ({
    id: msg._id,
    role: msg.role,
    content: msg.content,
    sources: msg.sources,
    tokenCount: msg.tokenCount,
  }));

  // Merge database messages with active streaming message
  const messages = [...dbMessages];
  if (streamingMessage) {
    messages.push(streamingMessage);
  }

  return {
    messages,
    isLoading,
  };
}
