"use client";

import { GraduationCap } from "lucide-react";
import { ChatSuggestions } from "@/components/chat/chat-suggestions";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  suggestions?: string[];
  onSuggestionSelect: (suggestion: string) => void;
  className?: string;
}

export function EmptyState({
  title = "Ask me anything about UET Taxila",
  description = "Admissions, programs, campus life, faculty, departments, and more.",
  suggestions,
  onSuggestionSelect,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center px-4 md:px-8 text-center stagger-enter",
        className,
      )}
    >
      {/* Icon */}
      <div className="mb-4 md:mb-6 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-[var(--radius-2xl)] bg-[var(--primary-muted)] border border-white/5 shadow-[var(--shadow-md)]">
        <GraduationCap className="h-7 w-7 md:h-8 md:w-8 text-[var(--accent)]" />
      </div>

      {/* Heading */}
      <h2 className="mb-2 text-lg md:text-xl font-semibold tracking-tight text-[var(--text-primary)] max-w-[280px] md:max-w-none">
        {title}
      </h2>

      {/* Description */}
      <p className="mb-6 md:mb-8 max-w-xs md:max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        {description}
      </p>

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <ChatSuggestions suggestions={suggestions} onSelect={onSuggestionSelect} />
      )}
    </div>
  );
}
