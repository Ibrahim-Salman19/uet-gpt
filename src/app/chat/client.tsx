"use client";

import { useCallback, useState } from "react";
import { ChatWindow } from "@/components/chat/chat-window";
import type { ChatMessage } from "@/lib/types";

export function ChatPageClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  const handleSend = useCallback(async (content: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "This is a placeholder response. Connect to Convex backend for real responses.",
    };

    setTimeout(() => {
      setMessages((prev) => [...prev, assistantMsg]);
      setIsSending(false);
    }, 1000);
  }, []);

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      handleSend(suggestion);
    },
    [handleSend],
  );

  const suggestions = [
    "How do I apply for admission?",
    "What programs are offered?",
    "What is the campus fee structure?",
  ];

  return (
    <ChatWindow
      messages={messages}
      isSending={isSending}
      onSend={handleSend}
      suggestions={suggestions}
      onSuggestionSelect={handleSuggestionSelect}
    />
  );
}
