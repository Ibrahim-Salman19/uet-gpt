"use client";

import type { FunctionReference } from "convex/server";
import { useEffect, useState } from "react";
import { useStableQuery } from "@/hooks/use-stable-query";
import type { ChatMessage, Source } from "@/lib/types";
import { api } from "../../convex/_generated/api";
import { streamRegistry } from "./stream-registry";

export function useMessages(threadId: string | undefined) {
  const messagesData = useStableQuery(api.messages.list, threadId ? { threadId } : "skip");

  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);

  useEffect(() => {
    if (!threadId) {
      setStreamingMessage(null);
      return;
    }

    // Register listener for streaming message updates
    streamRegistry.register(threadId, (content: string, sources?: Source[]) => {
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
    });

    return () => {
      streamRegistry.unregister(threadId);
    };
  }, [threadId]);

  const isLoading = threadId ? messagesData === undefined : false;

  // Map Convex messages format to ChatMessage frontend interface
  const dbMessages: ChatMessage[] = (messagesData ?? []).map((msg: any) => ({
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
