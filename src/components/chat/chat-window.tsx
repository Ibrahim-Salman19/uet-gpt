"use client";

import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import type { ChatMessage } from "@/lib/types";

interface ChatWindowProps {
  messages: ChatMessage[];
  isSending: boolean;
  onSend: (message: string) => void;
  onStop?: () => void;
  suggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function ChatWindow({
  messages,
  isSending,
  onSend,
  onStop,
  suggestions,
  onSuggestionSelect,
  isLoading,
  error,
  onRetry,
}: ChatWindowProps) {
  return (
    <div className="flex h-full flex-col">
      <ChatMessages
        messages={messages}
        isSending={isSending}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        suggestions={suggestions}
        onSuggestionSelect={onSuggestionSelect}
      />
      <ChatInput onSend={onSend} onStop={onStop} isLoading={isSending} />
    </div>
  );
}
