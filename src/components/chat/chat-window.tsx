"use client";

import { ChatInputNew } from "@/components/chat/chat-input-new";
import { ChatMessages } from "@/components/chat/chat-messages";
import { GlassPortal } from "@/components/chat/glass-portal";
import { DEFAULT_SUGGESTIONS } from "@/lib/constants";
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
        <nav
          className="relative z-10 px-4 md:px-6 py-4 md:py-5 border-t border-[var(--border)]/60 bg-[var(--surface-base)]/40 backdrop-blur-md overflow-x-auto scrollbar-none scroll-momentum stagger-enter"
          aria-label="Quick suggestions"
        >
          <ul className="flex gap-2.5 min-w-max md:min-w-0 md:flex-wrap items-center justify-center list-none m-0 p-0">
            {DEFAULT_SUGGESTIONS.map((s, i) => (
              <li key={s.label} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSuggestionSelect?.(s.prompt)}
                  onFocus={(e) =>
                    e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })
                  }
                  className="w-full rounded-full border border-[var(--border)]/50 bg-[var(--surface-elevated)] px-4 py-2 md:px-5 md:py-2.5 text-[13px] md:text-sm font-medium text-[var(--text-secondary)] transition-all duration-300 ease-[var(--ease-spring)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--surface-hover)] active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none shadow-sm hover:shadow-[0_0_12px_rgba(212,168,74,0.15)] font-sans cursor-pointer whitespace-nowrap"
                  aria-label={`Suggestion: ${s.label}`}
                >
                  <span
                    className="opacity-40 font-mono text-[10px] mr-2 select-none hidden md:inline tracking-wider"
                    aria-hidden="true"
                  >
                    0{i + 1}
                  </span>
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* ── Chat Input ── */}
      <div className="relative z-20">
        <ChatInputNew onSend={onSend} onStop={onStop} isLoading={isSending} />
      </div>
    </GlassPortal>
  );
}
