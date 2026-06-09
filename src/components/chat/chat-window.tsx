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
    <GlassPortal className="pointer-events-none">
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
        <div className="relative z-10 px-4 md:px-6 py-3 border-t border-white/5 bg-zinc-950/50 backdrop-blur-md">
          <div className="flex flex-wrap gap-3 stagger-enter" aria-label="Quick suggestions">
            {DEFAULT_SUGGESTIONS.map((s, i) => (
              <button
                key={s.label}
                onClick={() => onSuggestionSelect?.(s.prompt)}
                className="rounded-[var(--radius-md)] border border-white/5 bg-white/5 px-4 py-2 text-[11px] tracking-wide text-zinc-400 transition-all duration-300 ease-[var(--ease-spring)] hover:border-zinc-500 hover:text-white hover:bg-white/10 active:scale-[0.98] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none shadow-[var(--shadow-sm)] font-sans cursor-pointer"
                aria-label={`Suggestion: ${s.label}`}
              >
                <span
                  className="opacity-40 font-mono tabular-nums text-[9px] mr-2 select-none"
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
      <div className="relative z-20">
        <ChatInputNew onSend={onSend} onStop={onStop} isLoading={isSending} />
      </div>
    </GlassPortal>
  );
}
