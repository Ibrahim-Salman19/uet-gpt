"use client";

import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SourceCard } from "./source-card";

interface SourceListProps {
  sources: Source[];
  className?: string;
}

export function SourceList({ sources, className }: SourceListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className={cn("px-1", className)}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Hide sources" : "Show sources"}
        className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors duration-[var(--duration-normal)]"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <BookOpen className="h-3.5 w-3.5" />
        <span>
          View {sources.length} source{sources.length > 1 ? "s" : ""}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {sources.map((source, i) => (
            <SourceCard key={source.chunkId} source={source} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
