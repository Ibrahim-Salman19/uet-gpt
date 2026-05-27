"use client";

import { useCallback, useState } from "react";
import type { Source } from "@/lib/types";

interface UseSourcesReturn {
  /** All sources from the current response */
  sources: Source[];
  /** Whether the source panel is expanded */
  isExpanded: boolean;
  /** Toggle source panel expansion */
  toggleExpanded: () => void;
  /** Expand sources */
  expand: () => void;
  /** Collapse sources */
  collapse: () => void;
  /** Number of unique documents represented */
  uniqueDocumentCount: number;
  /** Top N most relevant sources */
  topSources: (n: number) => Source[];
  /** Set sources (called when streaming completes or response arrives) */
  setSources: (sources: Source[]) => void;
}

/**
 * Hook for managing source citations display in chat messages.
 *
 * Provides expand/collapse state, relevance sorting, and dedup counting.
 */
export function useSources(initialSources: Source[] = []): UseSourcesReturn {
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const expand = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const collapse = useCallback(() => {
    setIsExpanded(false);
  }, []);

  /** Count unique documents (by URL) */
  const uniqueDocumentCount = new Set(sources.map((s) => s.url)).size;

  /** Get top N sources by relevance score */
  const topSources = useCallback(
    (n: number): Source[] => {
      return [...sources].sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, n);
    },
    [sources],
  );

  return {
    sources,
    isExpanded,
    toggleExpanded,
    expand,
    collapse,
    uniqueDocumentCount,
    topSources,
    setSources,
  };
}
