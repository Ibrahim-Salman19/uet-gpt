"use client";

import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { LoadingState } from "@/components/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusColors: Record<string, string> = {
  indexed: "bg-green-500/10 text-green-500 border-green-500/10",
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/10",
  processing: "bg-blue-500/10 text-blue-500 border-blue-500/10",
  failed: "bg-red-500/10 text-red-500 border-red-500/10",
  stale: "bg-gray-500/10 text-gray-500 border-gray-500/10",
};

const statusIcons: Record<string, React.ReactNode> = {
  indexed: <CheckCircle2 className="h-3 w-3" />,
  pending: <Clock className="h-3 w-3" />,
  processing: <RefreshCw className="h-3 w-3 animate-spin" />,
  failed: <XCircle className="h-3 w-3" />,
  stale: <AlertCircle className="h-3 w-3" />,
};

export default function AdminDocumentsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const documents = useQuery(api.doc.list.list, {
    limit: 100,
    status:
      statusFilter === "all"
        ? undefined
        : (statusFilter as "pending" | "processing" | "indexed" | "failed" | "stale"),
    category: categoryFilter === "all" ? undefined : categoryFilter,
  });

  const deleteDocument = useMutation(api.admin.stats.deleteDocument);

  const handleDelete = async (docId: Id<"documents">) => {
    if (confirm("Are you sure you want to delete this document?")) {
      try {
        await deleteDocument({ documentId: docId });
        toast.success("Document deleted successfully");
      } catch (error) {
        console.error("Failed to delete document:", error);
        toast.error("Failed to delete document. Please try again.");
      }
    }
  };

  const filteredDocs: Doc<"documents">[] = documents
    ? documents.filter(
        (doc) =>
          !search ||
          (doc.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (doc.url ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : [];

  return (
    <div className="space-y-6 animate-[slide-up_0.3s_ease-[var(--ease-out-expo)]_both]">
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 font-mono tracking-tight uppercase">
            [ DATA_VAULT: SCRAPED DOCUMENTS ]
          </h2>
          <p className="text-xs text-zinc-500 font-sans mt-0.5">
            Index, filter and manage ingested university datasets
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.refresh()}
          className="h-8 border-white/5 bg-[var(--surface-3)]/40 text-xs font-mono tracking-wider hover:bg-white/5 hover:text-white transition-all active:scale-[0.98]"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-2 text-zinc-400" />
          REFRESH
        </Button>
      </div>

      {/* Filters Pane */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-black/40 border-white/5 text-xs font-sans rounded focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9 bg-black/40 border-white/5 text-xs font-mono rounded">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--surface-3)] border-white/10 text-xs font-mono">
              <SelectItem value="all">ALL_STATUS</SelectItem>
              <SelectItem value="indexed">INDEXED</SelectItem>
              <SelectItem value="pending">PENDING</SelectItem>
              <SelectItem value="processing">PROCESSING</SelectItem>
              <SelectItem value="failed">FAILED</SelectItem>
              <SelectItem value="stale">STALE</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px] h-9 bg-black/40 border-white/5 text-xs font-mono rounded">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--surface-3)] border-white/10 text-xs font-mono">
              <SelectItem value="all">ALL_CATEGORIES</SelectItem>
              <SelectItem value="admissions">ADMISSIONS</SelectItem>
              <SelectItem value="academics">ACADEMICS</SelectItem>
              <SelectItem value="departments">DEPARTMENTS</SelectItem>
              <SelectItem value="programs">PROGRAMS</SelectItem>
              <SelectItem value="campus">CAMPUS</SelectItem>
              <SelectItem value="general">GENERAL</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {documents && documents.length >= 100 && (
        <p className="text-[10px] text-amber-400/90 font-mono tracking-wide">
          Showing the first 100 documents. Text search only matches within this window — narrow by
          status or category to reach the rest.
        </p>
      )}

      {documents === undefined ? (
        <LoadingState type="admin-list" />
      ) : filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-white/5 rounded-xl bg-[var(--surface-3)]/20">
          <FileText className="h-10 w-10 text-zinc-500 mb-4" />
          <p className="text-xs text-zinc-400 font-mono tracking-wider">
            {search || statusFilter !== "all" || categoryFilter !== "all"
              ? "NO MATCHING DOCUMENTS FOUND"
              : "NO SYSTEM DOCUMENTS INGESTED"}
          </p>
        </div>
      ) : (
        <div className="border border-white/5 rounded-xl bg-[var(--surface-3)]/20 overflow-hidden">
          <ScrollArea className="h-[calc(100dvh-230px)]">
            <div className="divide-y divide-white/[0.04]">
              {filteredDocs.map((doc) => (
                <div
                  key={String(doc._id)}
                  className="group flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors relative"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`flex items-center gap-1 text-[8px] font-mono uppercase rounded px-1.5 py-0.5 border ${
                          statusColors[String(doc.status)] || ""
                        }`}
                      >
                        {statusIcons[String(doc.status)]}
                        {String(doc.status)}
                      </Badge>
                      {doc.category && (
                        <Badge
                          variant="secondary"
                          className="text-[8px] font-mono bg-zinc-950 border border-white/5 text-zinc-400 px-1.5 py-0.5 rounded"
                        >
                          {String(doc.category)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-zinc-200 truncate font-sans">
                      {String(doc.title ?? "Untitled")}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 mt-1 text-[9px] text-zinc-500 font-mono">
                      <span className="truncate max-w-[320px] text-zinc-400 group-hover:text-zinc-300 transition-colors">
                        {String(doc.url)}
                      </span>
                      {doc.chunkCount != null && doc.chunkCount !== undefined && (
                        <>
                          <span>·</span>
                          <span>{Number(doc.chunkCount)} CHUNKS</span>
                        </>
                      )}
                      <span>·</span>
                      <span>INGESTED: {new Date(Number(doc.crawledAt)).toLocaleDateString()}</span>
                    </div>
                    {doc.error && (
                      <p className="text-[9px] text-red-400 mt-1 font-mono bg-red-950/10 border border-red-950/20 px-2 py-1 rounded inline-block">
                        {String(doc.error)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-white/5 hover:text-white rounded active:scale-[0.98]"
                      onClick={() => {
                        try {
                          const u = new URL(String(doc.url));
                          if (u.protocol === "http:" || u.protocol === "https:") {
                            // fallow-ignore-next-line security-sink
                            window.open(u.href, "_blank", "noopener,noreferrer");
                          }
                        } catch {
                          // ignore invalid URLs
                        }
                      }}
                      aria-label="Open source link"
                      title="Open source link"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-200" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-red-500/10 hover:text-red-400 rounded active:scale-[0.98]"
                      onClick={() => handleDelete(doc._id)}
                      aria-label="Delete document"
                      title="Delete document"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
