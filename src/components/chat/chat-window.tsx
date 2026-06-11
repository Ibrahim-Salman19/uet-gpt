"use client";

import * as React from "react";
import { ChatInputNew } from "@/components/chat/chat-input-new";
import { ChatMessages } from "@/components/chat/chat-messages";
import { GlassPortal } from "@/components/chat/glass-portal";
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

const DEFAULT_SUGGESTIONS = [
  { label: "BS Fee Structure", prompt: "What is the fee structure for BS programs?" },
  { label: "2026 Admissions", prompt: "When do admissions open for 2026?" },
  { label: "Departments", prompt: "How many departments does UET have?" },
  { label: "Hostel Allotment", prompt: "Explain the hostel allotment process." },
];

export function ChatWindow({
  messages,
  isSending,
  onSend,
  onStop,
  onSuggestionSelect,
  isLoading,
  error,
  onRetry,
}: ChatWindowProps) {
  const hasMessages = messages.length > 0;
  const showSuggestions = !hasMessages && !isSending;

  return (
    <GlassPortal>
      {/* ── Message feed ── */}
      <div className="relative z-10 flex-1 overflow-hidden">
        <ChatMessages
          messages={messages}
          isAwaitingReply={isSending}
          isLoading={isLoading}
          error={error}
          onRetry={onRetry}
        />
      </div>

      {/* ── Suggestion Chips ── */}
      {showSuggestions && (
        <div
          className="relative z-10 px-3 md:px-6 py-2.5 md:py-3 border-t border-[var(--border)] overflow-x-auto scrollbar-none -webkit-overflow-scrolling-touch stagger-enter"
          aria-label="Quick suggestions"
        >
          <div className="flex gap-2 min-w-max md:min-w-0 md:flex-wrap">
            {DEFAULT_SUGGESTIONS.map((s, i) => (
              <button
                key={s.label}
                onClick={() => onSuggestionSelect?.(s.prompt)}
                className="shrink-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2 md:px-4 md:py-2.5 text-xs md:text-sm font-medium text-[var(--text-muted)] transition-all duration-200 ease-[var(--ease-spring)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--surface-hover)] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none shadow-[var(--shadow-sm)] font-sans cursor-pointer min-h-[38px] whitespace-nowrap"
                aria-label={`Suggestion: ${s.label}`}
              >
                <span
                  className="opacity-40 font-mono text-[10px] mr-1.5 select-none hidden md:inline"
                  aria-hidden="true"
                >
                  [{i + 1}]
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat Input ── */}
      <div className="relative z-20 pt-4 border-t border-[var(--border)]">
        <ChatInputNew onSend={onSend} onStop={onStop} isLoading={isSending} />
      </div>
    </GlassPortal>
  );
}
