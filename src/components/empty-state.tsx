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
  description = "I can help with admissions, programs, campus life, faculty, departments, and more.",
  suggestions,
  onSuggestionSelect,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center px-6 text-center stagger-enter",
        className,
      )}
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[var(--radius-2xl)] bg-[var(--primary-muted)]">
        <GraduationCap className="h-8 w-8 text-[var(--primary)]" />
      </div>

      <h2 className="mb-2 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
        {title}
      </h2>

      <p className="mb-8 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        {description}
      </p>

      {suggestions && suggestions.length > 0 && (
        <ChatSuggestions suggestions={suggestions} onSelect={onSuggestionSelect} />
      )}
    </div>
  );
}
