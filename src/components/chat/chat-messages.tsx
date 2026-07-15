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
  onFeedback?: (messageId: string, rating: "thumbsUp" | "thumbsDown") => void;
  className?: string;
}

function ErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="mx-4 mb-4 flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-4">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(75%_0.14_35)]" />
      <div className="flex-1">
        <p className="text-sm font-medium text-[oklch(75%_0.14_35)]">Something went wrong</p>
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
  // Track the streaming content length so follow-scrolling works while the last
  // message grows token-by-token (message count stays constant during a stream).
  const lastContentLength = messages[messages.length - 1]?.content.length ?? 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: lastContentLength and isAwaitingReply are reactive values intentionally driving follow-scroll on streaming ticks; refs are intentionally omitted.
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLDivElement | null;
    if (viewport) {
      const isNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 180;
      const isNewMessage = messages.length > prevLengthRef.current;

      // Always follow a brand-new outgoing message; otherwise only auto-follow
      // (streaming text / awaiting indicator) when the user is already near the
      // bottom, so we never yank the view away from someone scrolled up reading.
      if (isNewMessage || isNearBottom) {
        requestAnimationFrame(() => {
          viewport.scrollTop = viewport.scrollHeight;
        });
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages.length, lastContentLength, isAwaitingReply]);

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
    <div
      className="flex items-start gap-4 lg:gap-6 px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-7 xl:px-10 w-full bg-[var(--surface-base)]/20"
      role="status"
    >
      <span className="sr-only">Generating response…</span>
      <div className="flex h-8 w-8 items-center justify-center shrink-0 rounded-[10px] bg-[var(--surface-elevated)] text-[var(--accent)] border border-[var(--accent)]/10 shadow-inner select-none font-semibold text-[10px] tracking-widest font-mono">
        UG
      </div>
      <div className="flex flex-1 flex-col gap-2 items-start min-w-0">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.15em] text-[var(--text-muted)] uppercase select-none mb-0.5">
          <span className="text-[var(--accent)] font-medium">UETGPT // RESPONSE</span>
          <span className="opacity-30">//</span>
          <span className="opacity-70 animate-pulse">THINKING</span>
        </div>
        <div className="flex items-center gap-1.5 py-2" aria-hidden="true">
          <span className="h-2 w-2 animate-[pulse-dot_1.4s_ease-in-out_infinite] rounded-full bg-[var(--accent)]" />
          <span className="h-2 w-2 animate-[pulse-dot_1.4s_ease-in-out_0.2s_infinite] rounded-full bg-[var(--accent)]" />
          <span className="h-2 w-2 animate-[pulse-dot_1.4s_ease-in-out_0.4s_infinite] rounded-full bg-[var(--accent)]" />
        </div>
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
  onFeedback,
  className,
}: ChatMessagesProps) {
  const scrollRef = useAutoScroll(messages, isAwaitingReply);
  const hasError = error != null && error !== "";

  if (messages.length === 0 && !isLoading && !isAwaitingReply && !hasError) {
    return <EmptyContent suggestions={suggestions} onSuggestionSelect={onSuggestionSelect} />;
  }

  if ((isLoading || isAwaitingReply) && messages.length === 0) {
    return <LoadingContent className={className} />;
  }

  // No messages yet but a request failed — show the error explicitly instead of
  // falling through to an empty scroll area.
  if (messages.length === 0 && hasError) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="w-full max-w-md">
          <ErrorBanner error={error} onRetry={onRetry} />
        </div>
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollRef} className={cn("h-full w-full scroll-momentum", className)}>
      <div
        className="mx-auto flex w-full flex-col gap-1 pt-6 pb-32 md:pb-12 max-w-none md:max-w-3xl lg:max-w-4xl xl:max-w-5xl px-0"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={isAwaitingReply || isLoading || false}
      >
        {messages.map((message, index) => (
          <div
            key={message.id}
            className="animate-[slide-up_0.4s_ease-[var(--ease-out-expo)]_both]"
          >
            <ChatMessageBubble
              message={message}
              isLatest={index === messages.length - 1}
              onFeedback={onFeedback ? (rating) => onFeedback(message.id, rating) : undefined}
            />
          </div>
        ))}

        {hasError && <ErrorBanner error={error} onRetry={onRetry} />}

        {isAwaitingReply && <AwaitingReplyIndicator />}
      </div>
    </ScrollArea>
  );
}
