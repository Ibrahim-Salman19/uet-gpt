"use client";

import { Bot, User } from "lucide-react";
import { MessageActions } from "@/components/chat/message-actions";
import { SourceList } from "@/components/chat/source-list";
import { Markdown } from "@/components/markdown";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessage;
  onFeedback?: (rating: "thumbsUp" | "thumbsDown") => void;
}

export function ChatMessageBubble({ message, onFeedback }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className="flex items-start gap-4 px-4 py-4 w-full max-w-4xl mx-auto">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] shrink-0",
          isUser ? "bg-[var(--accent)]" : "bg-[var(--primary-muted)]",
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-[var(--accent-fg)]" />
        ) : (
          <Bot className="h-4 w-4 text-[var(--primary)]" />
        )}
      </div>

      <div className="group flex flex-1 flex-col gap-1.5 items-start min-w-0">
        <div
          className={cn(
            "rounded-[var(--radius-lg)] px-4 py-2.5",
            isUser
              ? "bg-[var(--primary)] text-[var(--primary-fg)]"
              : "bg-[var(--surface-muted)] text-[var(--text-primary)]",
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed">{message.content}</p>
          ) : (
            <Markdown content={message.content} />
          )}
        </div>

        {message.sources && message.sources.length > 0 && <SourceList sources={message.sources} />}

        <div className="flex items-center gap-2">
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
