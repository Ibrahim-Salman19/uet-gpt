"use client";

import { ChatWindow } from "@/components/chat/chat-window";
import { useChat } from "@/hooks/use-chat";
import { useMessages } from "@/hooks/use-messages";

interface ChatThreadClientProps {
  threadId: string;
}

export function ChatThreadClient({ threadId }: ChatThreadClientProps) {
  const { messages, isLoading } = useMessages(threadId);
  const { sendMessage, isLoading: isSending, stopGeneration } = useChat(threadId);

  return (
    <ChatWindow
      messages={messages}
      isLoading={isLoading}
      isSending={isSending}
      onSend={sendMessage}
      onStop={stopGeneration}
    />
  );
}
