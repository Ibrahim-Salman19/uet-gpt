"use client";

import { ExternalLink, Percent } from "lucide-react";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SourceCardProps {
  source: Source;
  index: number;
  className?: string;
}

export function SourceCard({ source, index, className }: SourceCardProps) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-card)] p-3 transition-all duration-[var(--duration-fast)]",
        "hover:border-[var(--accent-muted)] hover:shadow-[var(--shadow-sm)]",
        "active:scale-[0.99]",
        className,
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--primary-muted)] text-xs font-semibold text-[var(--primary)]">
        {index + 1}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors duration-[var(--duration-fast)]">
          {source.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
          {(() => {
            try {
              return new URL(source.url).hostname;
            } catch {
              return source.url;
            }
          })()}
        </p>
        {source.excerpt && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            {source.excerpt}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
          <Percent className="h-3 w-3" />
          {Math.round(source.relevanceScore * 100)}
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-[var(--text-disabled)] opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-60" />
      </div>
    </a>
  );
}
