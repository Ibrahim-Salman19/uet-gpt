"use client";

import { MessageActions } from "@/components/chat/message-actions";
import { SourceList } from "@/components/chat/source-list";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessage;
  onFeedback?: (rating: "thumbsUp" | "thumbsDown") => void;
}

export function ChatMessageBubble({ message, onFeedback }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex items-start gap-3 px-4 py-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] shrink-0",
          isUser ? "bg-[var(--accent)]" : "bg-[var(--primary-muted)]",
        )}
      >
        <span
          className={cn(
            "text-xs font-semibold",
            isUser ? "text-[var(--accent-fg)]" : "text-[var(--primary)]",
          )}
        >
          {isUser ? "U" : "AI"}
        </span>
      </div>

      <div
        className={cn("flex max-w-[85%] flex-col gap-1.5", isUser ? "items-end" : "items-start")}
      >
        <div
          className={cn(
            "rounded-[var(--radius-lg)] px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-[var(--primary)] text-[var(--primary-fg)]"
              : "bg-[var(--surface-muted)] text-[var(--text-primary)]",
          )}
        >
          {message.content}
        </div>

        {message.sources && message.sources.length > 0 && <SourceList sources={message.sources} />}

        <div className={cn("flex items-center gap-2", isUser && "flex-row-reverse")}>
          <MessageActions
            content={message.content}
            role={message.role}
            onFeedback={(type) => onFeedback?.(type)}
          />

          {message.tokenCount && (
            <span className="text-[10px] text-[var(--text-disabled)]">
              {message.tokenCount.total} tokens
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
