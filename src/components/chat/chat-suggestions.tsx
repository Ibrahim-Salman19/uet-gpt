"use client";

import { Sparkles } from "lucide-react";
import { DEFAULT_SUGGESTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ChatSuggestionsProps {
  suggestions?: string[];
  onSelect: (suggestion: string) => void;
  className?: string;
}

export function ChatSuggestions({ suggestions, onSelect, className }: ChatSuggestionsProps) {
  const finalSuggestions = suggestions ?? DEFAULT_SUGGESTIONS.map((s) => s.prompt);
  const hasSuggestions = finalSuggestions.length > 0;

  if (!hasSuggestions) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        Try asking:
      </p>
      <div className="flex flex-wrap gap-2">
        {finalSuggestions.map((suggestion) => (
          <button
            type="button"
            key={suggestion}
            onClick={() => onSelect(suggestion)}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-[border-color,background-color,color,transform] duration-[var(--duration-fast)] hover:border-[var(--accent-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)] active:scale-[0.98]"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
