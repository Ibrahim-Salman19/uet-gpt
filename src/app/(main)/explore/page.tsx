"use client";

import { BookOpen, ExternalLink, FileText, Grid3X3, List, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ExploreDoc {
  id: string;
  title: string;
  url: string;
  category: string;
  excerpt: string;
  lastUpdated: string;
}

const CATEGORIES = [
  "all",
  "academic",
  "admissions",
  "campus",
  "administrative",
  "research",
] as const;

const mockDocs: ExploreDoc[] = [
  {
    id: "1",
    title: "BS Computer Science - Program Overview",
    url: "https://web.uettaxila.edu.pk/programs/bs-cs",
    category: "academic",
    excerpt: "The BS Computer Science program at UET Taxila is a 4-year degree...",
    lastUpdated: "2026-01-15",
  },
  {
    id: "2",
    title: "Admission Guidelines 2026",
    url: "https://web.uettaxila.edu.pk/admissions/2026",
    category: "admissions",
    excerpt: "Find all the information you need to apply for admission to UET Taxila...",
    lastUpdated: "2026-02-01",
  },
  {
    id: "3",
    title: "Campus Facilities and Hostels",
    url: "https://web.uettaxila.edu.pk/campus/hostels",
    category: "campus",
    excerpt: "UET Taxila provides modern hostel facilities for both male and female students...",
    lastUpdated: "2025-11-20",
  },
];

function ExploreCard({ doc }: { doc: ExploreDoc }) {
  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-card)] p-4 transition-all duration-[var(--duration-fast)] hover:border-[var(--accent-muted)] hover:shadow-[var(--shadow-md)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors duration-[var(--duration-fast)] truncate">
            {doc.title}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[var(--primary-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--primary)] uppercase tracking-wider">
              {doc.category}
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">{doc.lastUpdated}</span>
          </div>
        </div>
        <ExternalLink className="h-4 w-4 shrink-0 text-[var(--text-disabled)] opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-60" />
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
        {doc.excerpt}
      </p>
    </a>
  );
}

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredDocs = mockDocs.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "all" || doc.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Explore UET Taxila</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Browse all indexed documents and pages
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "rounded-[var(--radius-sm)] p-1.5 transition-colors duration-[var(--duration-fast)]",
                  viewMode === "grid"
                    ? "bg-[var(--surface-muted)] text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                )}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "rounded-[var(--radius-sm)] p-1.5 transition-colors duration-[var(--duration-fast)]",
                  viewMode === "list"
                    ? "bg-[var(--surface-muted)] text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList>
              {CATEGORIES.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="capitalize">
                  {cat === "all" ? "All" : cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="mb-4 h-12 w-12 text-[var(--text-disabled)]" />
              <p className="text-sm text-[var(--text-muted)]">No documents found</p>
            </div>
          ) : (
            <div
              className={cn(
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  : "flex flex-col gap-2",
              )}
            >
              {filteredDocs.map((doc) => (
                <ExploreCard key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
