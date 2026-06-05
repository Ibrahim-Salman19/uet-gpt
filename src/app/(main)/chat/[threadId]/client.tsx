"use client";

import { useEffect, useRef } from "react";
import { ChatWindow } from "@/components/chat/chat-window";
import { useChat } from "@/hooks/use-chat";
import { useMessages } from "@/hooks/use-messages";

interface ChatThreadClientProps {
  threadId: string;
  initialMessage?: string;
}

export function ChatThreadClient({ threadId, initialMessage }: ChatThreadClientProps) {
  const { messages, isLoading } = useMessages(threadId);
  const { sendMessage, isLoading: isSending, stopGeneration } = useChat(threadId);
  const firedRef = useRef(false);

  // If navigated here with an initial message (from /chat landing), fire it once
  useEffect(() => {
    if (initialMessage && !firedRef.current && !isSending) {
      firedRef.current = true;
      sendMessage(initialMessage);
    }
  }, [initialMessage, isSending, sendMessage]);

  return (
    <ChatWindow
      messages={messages}
      isLoading={isLoading}
      isSending={isSending}
      onSend={sendMessage}
      onStop={stopGeneration}
      onSuggestionSelect={sendMessage}
    />
  );
}
