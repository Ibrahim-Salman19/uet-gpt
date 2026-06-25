"use client";

import { api } from "convex/_generated/api";
import { BookOpen, ExternalLink, Grid3X3, List, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/use-debounce";
import { useStableQuery } from "@/hooks/use-stable-query";
import { cn } from "@/lib/utils";

interface ExploreDoc {
  _id: string;
  title: string;
  url: string;
  category: string;
  subcategory?: string;
  status: string;
  chunkCount?: number;
  crawledAt: number;
  updatedAt: number;
  metadata?: {
    wordCount?: number;
  };
}

const CATEGORIES = [
  "all",
  "academic",
  "admissions",
  "campus",
  "administrative",
  "research",
  "general",
  "departments",
  "programs",
] as const;

function ExploreCard({ doc }: { doc: ExploreDoc }) {
  return (
    <a
      href={doc.url?.startsWith("http") ? doc.url : "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-white/5 bg-[var(--surface-3)]/40 backdrop-blur-sm p-4 transition-all duration-300 hover:border-[var(--accent)]/30 hover:bg-[var(--surface-3)]/80 hover:-translate-y-0.5 active:scale-[0.99] hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] relative overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-zinc-200 group-hover:text-[var(--accent)] transition-colors truncate font-sans">
            {doc.title || "Untitled Document"}
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="text-[9px] uppercase tracking-wider bg-zinc-900/60 text-zinc-400 border border-white/5 font-mono py-0.5 px-1.5 rounded-md"
            >
              {doc.category}
            </Badge>
            {doc.subcategory && (
              <span className="text-[10px] text-zinc-500 font-sans">{doc.subcategory}</span>
            )}
            <span className="text-[10px] text-zinc-500 font-sans">
              {new Date(doc.crawledAt).toLocaleDateString()}
            </span>
            {doc.chunkCount != null && doc.chunkCount > 0 && (
              <>
                <span className="text-[10px] text-zinc-500 font-sans">·</span>
                <span className="text-[10px] text-zinc-500 font-sans">{doc.chunkCount} chunks</span>
              </>
            )}
          </div>
        </div>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p className="mt-2.5 line-clamp-1 text-[10px] leading-relaxed text-zinc-500 font-mono select-all">
        {doc.url}
      </p>
    </a>
  );
}

function ExploreTabContent({
  cat,
  documents,
  currentDocs,
  searchQuery,
  viewMode,
}: {
  cat: string;
  documents: ExploreDoc[] | undefined;
  currentDocs: ExploreDoc[];
  searchQuery: string;
  viewMode: "grid" | "list";
}) {
  return (
    <TabsContent key={cat} value={cat} className="m-0 mt-0 outline-none">
      <div className="mx-auto max-w-5xl 2xl:max-w-6xl px-3 py-4 md:px-6 md:py-6 pb-20 md:pb-6">
        {!documents ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
          </div>
        ) : currentDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-[slide-up_0.3s_ease-[var(--ease-out-expo)]_both]">
            <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 mb-4">
              <BookOpen className="h-5 w-5 text-[var(--accent)]" />
            </div>
            <p className="text-sm font-medium text-zinc-300">No documents found</p>
            {searchQuery && (
              <p className="text-xs text-zinc-500 mt-1.5 font-sans">
                Try adjusting your search or filters
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 animate-[slide-up_0.3s_ease-[var(--ease-out-expo)]_both]">
              <p className="text-[10px] font-mono text-zinc-500">
                SHOWING {currentDocs.length} DOCUMENT{currentDocs.length !== 1 ? "S" : ""}
                {documents.length !== currentDocs.length ? ` OF ${documents.length} TOTAL` : ""}
              </p>
            </div>
            <div
              className={cn(
                "stagger-enter",
                viewMode === "grid" && documents && currentDocs.length > 0
                  ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
                  : documents && currentDocs.length > 0
                    ? "flex flex-col gap-2"
                    : "",
              )}
            >
              {currentDocs.map((doc: ExploreDoc) => (
                <ExploreCard key={doc._id} doc={doc} />
              ))}
            </div>
          </>
        )}
      </div>
    </TabsContent>
  );
}

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const setDebounced = useDebounce((val: string) => {
    setDebouncedQuery(val);
  }, 300);

  useEffect(() => {
    setDebounced(searchQuery);
  }, [searchQuery, setDebounced]);

  // Pass category to backend when filtered — avoids the 50-doc client-side truncation bug
  const category = activeCategory === "all" ? undefined : activeCategory;
  const trimmedQuery = debouncedQuery.trim();
  const isSearching = trimmedQuery.length > 0;

  // Branch the query call itself so each reference keeps its precise generated
  // arg/return types (no `as unknown as FunctionReference` cast). The inactive
  // query is skipped, so only one runs at a time.
  const searchResults = useStableQuery(
    api.doc.search,
    isSearching ? { query: trimmedQuery, category } : "skip",
  );
  const listResults = useStableQuery(api.doc.list, isSearching ? "skip" : { category });

  const documents = isSearching ? searchResults : listResults;

  return (
    <Tabs
      value={activeCategory}
      onValueChange={setActiveCategory}
      className="flex h-full flex-col w-full"
    >
      <div className="border-b border-[var(--surface-5)] bg-[var(--surface-1)]/60 backdrop-blur-md px-3 py-3 md:px-6 md:py-5 sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl 2xl:max-w-6xl flex-col gap-3 md:gap-4">
          <div>
            <h1 className="text-base font-semibold text-zinc-100 font-sans tracking-tight">
              Explore UET Taxila
            </h1>
            <p className="text-xs text-zinc-500 mt-1 font-sans">
              Browse all indexed documents and pages
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                aria-hidden="true"
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents…"
                aria-label="Search documents"
                className="pl-9 text-base md:text-xs bg-zinc-950/60 border border-white/10 rounded-xl text-zinc-200 placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
              />
            </div>
            <div
              role="group"
              aria-label="View mode"
              className="flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-950/60 p-0.5 shrink-0"
            >
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
                className={cn(
                  "rounded-lg p-1.5 transition-colors cursor-pointer",
                  viewMode === "grid"
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                <Grid3X3 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                aria-pressed={viewMode === "list"}
                className={cn(
                  "rounded-lg p-1.5 transition-colors cursor-pointer",
                  viewMode === "list"
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto pb-2 scrollbar-none -mb-2">
            <TabsList className="inline-flex w-max justify-start bg-transparent border-none p-0 gap-1">
              {CATEGORIES.map((cat) => (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className={cn(
                    "capitalize text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer font-sans",
                    activeCategory === cat
                      ? "bg-white/10 text-white border border-white/10"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {cat === "all" ? "All" : cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 bg-transparent">
        {CATEGORIES.map((cat) => {
          if (cat !== activeCategory) return null;
          return (
            <ExploreTabContent
              key={cat}
              cat={cat}
              documents={documents}
              currentDocs={documents ?? []}
              searchQuery={debouncedQuery}
              viewMode={viewMode}
            />
          );
        })}
      </ScrollArea>
    </Tabs>
  );
}
