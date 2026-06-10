"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { ChatMessageBubble } from "@/components/chat/chat-message";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  isAwaitingReply?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSuggestionSelect?: (suggestion: string) => void;
  suggestions?: string[];
  className?: string;
}

function ErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="mx-4 mb-4 flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-4">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--destructive)]" />
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--destructive)]">Something went wrong</p>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{error}</p>
      </div>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} aria-label="Retry">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function useAutoScroll(messages: ChatMessage[], isAwaitingReply?: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLDivElement;
    if (viewport) {
      const isNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 150;
      const isNewMessage = messages.length > prevLengthRef.current;

      if (isNearBottom || isNewMessage) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages, isAwaitingReply]);

  return scrollRef;
}

function EmptyContent({
  suggestions,
  onSuggestionSelect,
}: {
  suggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
}) {
  return (
    <EmptyState suggestions={suggestions} onSuggestionSelect={(s) => onSuggestionSelect?.(s)} />
  );
}

function LoadingContent({ className }: { className?: string }) {
  return <LoadingState className={className} />;
}

function AwaitingReplyIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--primary-muted)]">
        <span className="text-xs font-semibold text-[var(--primary)]">AI</span>
      </div>
      <div className="flex items-center gap-1.5 pt-2">
        <span className="h-2 w-2 animate-[pulse-dot_1.4s_ease-in-out_infinite] rounded-full bg-[var(--primary)]" />
        <span className="h-2 w-2 animate-[pulse-dot_1.4s_ease-in-out_0.2s_infinite] rounded-full bg-[var(--primary)]" />
        <span className="h-2 w-2 animate-[pulse-dot_1.4s_ease-in-out_0.4s_infinite] rounded-full bg-[var(--primary)]" />
      </div>
    </div>
  );
}

export function ChatMessages({
  messages,
  isLoading,
  isAwaitingReply,
  error,
  onRetry,
  onSuggestionSelect,
  suggestions,
  className,
}: ChatMessagesProps) {
  const scrollRef = useAutoScroll(messages, isAwaitingReply);

  if (messages.length === 0 && !isLoading && !isAwaitingReply && !error) {
    return <EmptyContent suggestions={suggestions} onSuggestionSelect={onSuggestionSelect} />;
  }

  if ((isLoading || isAwaitingReply) && messages.length === 0) {
    return <LoadingContent className={className} />;
  }

  return (
    <ScrollArea ref={scrollRef} className={cn("h-full w-full", className)}>
      <div className="mx-auto flex max-w-5xl w-full flex-col gap-1 pt-4 pb-32 md:pb-40">
        {messages.map((message, index) => (
          <div
            key={message.id}
            className="animate-[slide-up_0.3s_ease-[var(--ease-out-expo)]_both]"
          >
            <ChatMessageBubble message={message} isLatest={index === messages.length - 1} />
          </div>
        ))}

        {error && <ErrorBanner error={error} onRetry={onRetry} />}

        {isAwaitingReply && <AwaitingReplyIndicator />}
      </div>
    </ScrollArea>
  );
}
