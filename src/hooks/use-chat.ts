"use client";

import { useConvex, useMutation } from "convex/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { streamRegistry } from "./stream-registry";

export function useChat(threadId: string | undefined) {
  const convex = useConvex();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastMessageRef = useRef<string>("");
  const isLoadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const insertMutation = useMutation(api.messages.insert);

  const handleSend = useCallback(
    async (content: string) => {
      if (!content.trim() || !threadId || isLoadingRef.current) return;

      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);
      lastMessageRef.current = content.trim();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // 1. Insert the user's message into Convex
        await insertMutation({
          threadId,
          role: "user",
          content: content.trim(),
        });

        // 2. Fetch the updated messages list from Convex to include the user message
        const dbMessages = await convex.query(api.messages.list, {
          threadId,
        });

        // 3. Format messages for the API route
        const formattedMessages = dbMessages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        }));

        // 4. Send messages to Next.js API route
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: formattedMessages,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to generate response");
        }

        // 5. Parse sources metadata from response headers
        const sourcesHeader = response.headers.get("X-Sources");
        let sources = [];
        if (sourcesHeader) {
          try {
            sources = JSON.parse(sourcesHeader);
          } catch (e) {
            console.error("Failed to parse X-Sources header:", e);
          }
        }

        // 6. Read and stream the response body token-by-token
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body reader available");
        }

        const decoder = new TextDecoder();
        let accumulatedText = "";

        // Initialize the streaming state in the registry with empty text and sources
        streamRegistry.update(threadId, "", sources);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;

          // Update the streaming message in real-time
          streamRegistry.update(threadId, accumulatedText, sources);
        }

        // 7. Save the assistant's response to Convex once streaming is complete
        if (accumulatedText.trim()) {
          await insertMutation({
            threadId,
            role: "assistant",
            content: accumulatedText,
            sources: sources.length > 0 ? sources : undefined,
          });
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("Chat generation stopped by user.");
        } else {
          const message = err instanceof Error ? err.message : "Failed to send message";
          setError(message);
          toast.error(message);
        }
      } finally {
        // Clean up the streaming registry state
        if (threadId) {
          streamRegistry.update(threadId, "", []);
        }
        abortControllerRef.current = null;
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [threadId, insertMutation, convex],
  );

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    isLoadingRef.current = false;
    setIsLoading(false);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    if (lastMessageRef.current) {
      handleSend(lastMessageRef.current);
    }
  }, [handleSend]);

  return {
    isLoading,
    error,
    sendMessage: handleSend,
    stopGeneration: handleStop,
    retry: handleRetry,
  };
}
