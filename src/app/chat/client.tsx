"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { ChatWindow } from "@/components/chat/chat-window";
import type { ChatMessage, Source } from "@/lib/types";

export function ChatPageClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAwaitingReply, setIsAwaitingReply] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string>("");

  const handleSend = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      lastUserMessageRef.current = content.trim();

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: content.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsAwaitingReply(true);
      setIsStreaming(false);
      setError(null);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Format exactly how api expects it
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to generate response");
        }

        setIsAwaitingReply(false);
        setIsStreaming(true);

        const sourcesHeader = response.headers.get("X-Sources");
        let sources: Source[] = [];
        if (sourcesHeader) {
          try {
            sources = JSON.parse(sourcesHeader);
          } catch (e) {
            console.error("Failed to parse X-Sources", e);
          }
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body reader available");

        const decoder = new TextDecoder();
        let accumulatedText = "";

        const assistantMessageId = `${Date.now().toString()}-ai`;

        // Initialize assistant message
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            sources,
          },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;

          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg && lastMsg.id === assistantMessageId) {
              lastMsg.content = accumulatedText;
            }
            return newMessages;
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
        abortControllerRef.current = null;
        setIsAwaitingReply(false);
        setIsStreaming(false);
      }
    },
    [messages],
  );

  const handleRetry = useCallback(() => {
    if (lastUserMessageRef.current) {
      handleSend(lastUserMessageRef.current);
    }
  }, [handleSend]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsAwaitingReply(false);
    setIsStreaming(false);
  }, []);

  const suggestions = [
    "How do I apply for admission?",
    "What programs are offered?",
    "What is the campus fee structure?",
  ];

  return (
    <ChatWindow
      messages={messages}
      isSending={isAwaitingReply || isStreaming}
      isLoading={isAwaitingReply}
      error={error ? "Failed to get response. Please try again." : null}
      onSend={handleSend}
      onStop={handleStop}
      onRetry={handleRetry}
      suggestions={suggestions}
      onSuggestionSelect={handleSend}
    />
  );
}
