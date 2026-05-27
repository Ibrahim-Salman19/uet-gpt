"use client";

import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import { useMutation, useConvex } from "convex/react";
import type { FunctionReference } from "convex/server";
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
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type DocumentDoc = Doc<"documents">;

const statusColors: Record<string, string> = {
  indexed: "bg-green-500/10 text-green-500",
  pending: "bg-yellow-500/10 text-yellow-500",
  processing: "bg-blue-500/10 text-blue-500",
  failed: "bg-red-500/10 text-red-500",
  stale: "bg-gray-500/10 text-gray-500",
};

const statusIcons: Record<string, React.ReactNode> = {
  indexed: <CheckCircle2 className="h-3 w-3" />,
  pending: <Clock className="h-3 w-3" />,
  processing: <RefreshCw className="h-3 w-3" />,
  failed: <XCircle className="h-3 w-3" />,
  stale: <AlertCircle className="h-3 w-3" />,
};

export default function AdminDocumentsPage() {
  const convex = useConvex();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [documents, setDocuments] = useState<DocumentDoc[] | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await convex.query(api.doc.list as unknown as FunctionReference<"query", "public">, {
        limit: 100,
        status: statusFilter !== "all" ? (statusFilter as any) : undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
      });
      setDocuments(data as DocumentDoc[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [statusFilter, categoryFilter]);

  const deleteDocument = useMutation(api.admin.stats.deleteDocument);

  const handleDelete = async (docId: unknown) => {
    if (confirm("Are you sure you want to delete this document?")) {
      try {
        await deleteDocument({ documentId: docId as any });
      } catch (error) {
        console.error("Failed to delete document:", error);
      }
    }
  };

  const filteredDocs = documents
    ? (documents as DocumentDoc[]).filter(
        (doc) =>
          !search ||
          String((doc as any).title ?? "")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          String((doc as any).url ?? "")
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Documents</h2>
          <p className="text-sm text-muted-foreground">Manage and monitor scraped documents</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDocuments} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="indexed">Indexed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="stale">Stale</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="admissions">Admissions</SelectItem>
            <SelectItem value="academics">Academics</SelectItem>
            <SelectItem value="departments">Departments</SelectItem>
            <SelectItem value="programs">Programs</SelectItem>
            <SelectItem value="campus">Campus</SelectItem>
            <SelectItem value="general">General</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Documents List */}
      {!documents ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-64 mb-2" />
                <Skeleton className="h-3 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (filteredDocs as DocumentDoc[]).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              {search || statusFilter !== "all" || categoryFilter !== "all"
                ? "No documents match your filters"
                : "No documents yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-2">
            {(filteredDocs as DocumentDoc[]).map((doc: DocumentDoc) => (
              <Card key={String(doc._id)}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={`flex items-center gap-1 text-xs ${
                          statusColors[String(doc.status)] || ""
                        }`}
                      >
                        {statusIcons[String(doc.status)]}
                        {String(doc.status)}
                      </Badge>
                      {doc.category && (
                        <Badge variant="secondary" className="text-xs">
                          {String(doc.category)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">
                      {String(doc.title ?? "Untitled")}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground truncate max-w-[400px]">
                        {String(doc.url)}
                      </span>
                      {doc.chunkCount != null && doc.chunkCount !== undefined && (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            {Number(doc.chunkCount)} chunks
                          </span>
                        </>
                      )}
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(Number(doc.crawledAt)).toLocaleDateString()}
                      </span>
                    </div>
                    {doc.error && <p className="text-xs text-red-500 mt-1">{String(doc.error)}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(String(doc.url), "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(doc._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
