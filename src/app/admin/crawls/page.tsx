"use client";

import { api } from "convex/_generated/api";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  Play,
  RotateCw,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  running: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
  cancelled: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  running: <Loader2 className="h-3 w-3 animate-spin" />,
  completed: <CheckCircle2 className="h-3 w-3" />,
  failed: <XCircle className="h-3 w-3" />,
  cancelled: <AlertTriangle className="h-3 w-3" />,
};

export default function AdminCrawlsPage() {
  const convex = useConvex();
  const [crawls, setCrawls] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);

  const triggerCrawl = useMutation(
    api.crawl.trigger as unknown as FunctionReference<"mutation", "public">,
  );

  const loadCrawls = async () => {
    setLoading(true);
    try {
      const data = await convex.query(
        api.crawl.list as unknown as FunctionReference<"query", "public">,
        {},
      );
      setCrawls(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    loadCrawls();
  }, []);

  const handleTriggerCrawl = async () => {
    setIsTriggering(true);
    try {
      await triggerCrawl({ url: "https://web.uettaxila.edu.pk/", maxPages: 500, maxDepth: 5 });
      await loadCrawls();
    } catch (error) {
      console.error("Failed to trigger crawl:", error);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Crawl Jobs</h2>
          <p className="text-sm text-muted-foreground">Manage and monitor website crawling jobs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadCrawls} disabled={loading}>
            <RotateCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleTriggerCrawl} disabled={isTriggering}>
            {isTriggering ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            New Crawl
          </Button>
        </div>
      </div>

      <Separator />

      {!crawls ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : crawls.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">No crawl jobs yet</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={handleTriggerCrawl}
              disabled={isTriggering}
            >
              Start your first crawl
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="space-y-3">
            {crawls.map((crawl: any) => (
              <Card key={crawl._id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`flex items-center gap-1 ${statusColors[crawl.status] || ""}`}
                        >
                          {statusIcons[crawl.status]}
                          {crawl.status}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {crawl.trigger}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Started {new Date(crawl.startedAt).toLocaleString()}
                      </p>
                      {crawl.completedAt && (
                        <p className="text-xs text-muted-foreground">
                          Completed {new Date(crawl.completedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {crawl.error && (
                      <p className="text-xs text-red-500 max-w-xs text-right">{crawl.error}</p>
                    )}
                  </div>

                  <Separator className="my-3" />

                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-lg font-semibold">{crawl.stats.successfulPages}</p>
                      <p className="text-xs text-muted-foreground">Success</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{crawl.stats.failedPages}</p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{crawl.stats.totalChunks}</p>
                      <p className="text-xs text-muted-foreground">Chunks</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">
                        {(crawl.stats.totalTokens / 1000).toFixed(1)}k
                      </p>
                      <p className="text-xs text-muted-foreground">Tokens</p>
                    </div>
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
