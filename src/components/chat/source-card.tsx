"use client";

import { ExternalLink, Percent } from "lucide-react";
import { useMemo } from "react";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SourceCardProps {
  source: Source;
  index: number;
  className?: string;
}

export function SourceCard({ source, index, className }: SourceCardProps) {
  const hostname = useMemo(() => {
    try {
      return new URL(source.url).hostname;
    } catch {
      return source.url;
    }
  }, [source.url]);

  // Only treat the source as an external link when it has a real http(s) URL.
  // Internal RAG document chunks have no external URL, so we render a plain
  // container instead of a dead anchor pointing at "#".
  const isExternal = !!source.url && /^https?:\/\//i.test(source.url);

  const cardClassName = cn(
    "group flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-card)] p-3 transition-[border-color] duration-[var(--duration-fast)]",
    isExternal &&
      "hover:border-[var(--accent-muted)] hover:shadow-[var(--shadow-sm)] active:scale-[0.99]",
    className,
  );

  const cardBody = (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--primary-muted)] text-xs font-semibold text-[var(--primary)]">
        {index + 1}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors duration-[var(--duration-fast)]">
          {source.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{hostname}</p>
        {(() => {
          const excerpt = source.excerpt || source.providerOptions?.excerpt;
          if (excerpt) {
            return (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                {excerpt}
              </p>
            );
          }
          return null;
        })()}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {(() => {
          const score = source.relevanceScore ?? source.providerOptions?.relevanceScore;
          if (score !== undefined) {
            // Clamp to the expected 0–1 relevance range so out-of-range scores
            // (cosine > 1, already-percent values, negative dot products) never
            // render nonsense percentages.
            const pct = Math.round(Math.min(Math.max(score, 0), 1) * 100);
            return (
              <div className="flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                <Percent className="h-3 w-3" aria-hidden="true" focusable="false" />
                {pct}
              </div>
            );
          }
          return null;
        })()}
        {isExternal && (
          <ExternalLink
            className="h-3.5 w-3.5 text-[var(--text-disabled)] opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-60"
            aria-hidden="true"
            focusable="false"
          />
        )}
      </div>
    </>
  );

  if (isExternal) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cardClassName}
        aria-label={`${source.title} (opens in a new tab)`}
      >
        {cardBody}
      </a>
    );
  }

  return <div className={cardClassName}>{cardBody}</div>;
}
