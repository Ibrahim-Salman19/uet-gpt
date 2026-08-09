"use client";

import { GraduationCap } from "lucide-react";
import * as React from "react";
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
  const titleId = React.useId();
  const descriptionId = React.useId();

  return (
    <section
      className={cn(
        "stagger-enter flex h-full flex-col items-center justify-center px-4 text-center md:px-8 motion-reduce:animate-none",
        className,
      )}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-2xl)] border border-white/5 bg-[var(--primary-muted)] shadow-[var(--shadow-md)] md:mb-6 md:h-16 md:w-16"
        aria-hidden="true"
      >
        <GraduationCap className="h-7 w-7 text-[var(--accent)] md:h-8 md:w-8" />
      </div>

      <h2
        id={titleId}
        className="mb-2 max-w-[280px] text-lg font-semibold tracking-tight text-[var(--text-primary)] md:max-w-none md:text-xl"
      >
        {title}
      </h2>

      <p
        id={descriptionId}
        className="mb-6 max-w-xs text-sm leading-relaxed text-[var(--text-secondary)] md:mb-8 md:max-w-md"
      >
        {description}
      </p>

      {suggestions?.length ? (
        <ChatSuggestions suggestions={suggestions} onSelect={onSuggestionSelect} />
      ) : null}
    </section>
  );
}
