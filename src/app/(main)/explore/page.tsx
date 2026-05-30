"use client";

import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { BookOpen, ExternalLink, Grid3X3, List, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      href={doc.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
            {doc.title || "Untitled Document"}
          </p>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
              {doc.category}
            </Badge>
            {doc.subcategory && (
              <span className="text-[11px] text-muted-foreground">{doc.subcategory}</span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {new Date(doc.crawledAt).toLocaleDateString()}
            </span>
            {doc.chunkCount && (
              <>
                <span className="text-[11px] text-muted-foreground">·</span>
                <span className="text-[11px] text-muted-foreground">{doc.chunkCount} chunks</span>
              </>
            )}
          </div>
        </div>
        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-60" />
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{doc.url}</p>
    </a>
  );
}

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const documents = useQuery(api.doc.list as unknown as FunctionReference<"query", "public">, {});

  const getFilteredDocs = (cat: string) => {
    return documents
      ? documents.filter((doc: ExploreDoc) => {
          const matchesSearch =
            !searchQuery ||
            doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.url?.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesCategory = cat === "all" || doc.category === cat;
          return matchesSearch && matchesCategory;
        })
      : [];
  };

  return (
    <Tabs
      value={activeCategory}
      onValueChange={setActiveCategory}
      className="flex h-full flex-col w-full"
    >
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Explore UET Taxila</h1>
            <p className="text-sm text-muted-foreground">Browse all indexed documents and pages</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "rounded-sm p-1.5 transition-colors",
                  viewMode === "grid"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "rounded-sm p-1.5 transition-colors",
                  viewMode === "list"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto pb-2 scrollbar-none -mb-2">
            <TabsList className="inline-flex w-max justify-start">
              {CATEGORIES.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="capitalize">
                  {cat === "all" ? "All" : cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {CATEGORIES.map((cat) => {
          const currentDocs = getFilteredDocs(cat);
          return (
            <TabsContent key={cat} value={cat} className="m-0 mt-0 outline-none">
              <div className="mx-auto max-w-5xl px-6 py-6">
                {!documents ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : currentDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No documents found</p>
                    {searchQuery && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Try adjusting your search or filters
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-muted-foreground">
                      Showing {currentDocs.length} document{currentDocs.length !== 1 ? "s" : ""}
                      {documents.length !== currentDocs.length
                        ? ` of ${documents.length} total`
                        : ""}
                    </p>
                  </div>
                )}
                <div
                  className={cn(
                    viewMode === "grid" && documents && currentDocs.length > 0
                      ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                      : documents && currentDocs.length > 0
                        ? "flex flex-col gap-2"
                        : "",
                  )}
                >
                  {currentDocs.map((doc: ExploreDoc) => (
                    <ExploreCard key={doc._id} doc={doc} />
                  ))}
                </div>
              </div>
            </TabsContent>
          );
        })}
      </ScrollArea>
    </Tabs>
  );
}
