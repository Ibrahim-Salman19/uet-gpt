"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatSuggestionsProps {
  suggestions?: string[];
  onSelect: (suggestion: string) => void;
  className?: string;
}

const DEFAULT_SUGGESTIONS = [
  "What is the fee structure for BS programs?",
  "When do admissions open for 2026?",
  "How many departments does UET have?",
  "What transport routes are available?",
];

export function ChatSuggestions({
  suggestions = DEFAULT_SUGGESTIONS,
  onSelect,
  className,
}: ChatSuggestionsProps) {
  const hasSuggestions = suggestions.length > 0;

  if (!hasSuggestions) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        Try asking:
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            type="button"
            key={suggestion}
            onClick={() => onSelect(suggestion)}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-all duration-[var(--duration-fast)] hover:border-[var(--accent-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)] active:scale-[0.98]"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
