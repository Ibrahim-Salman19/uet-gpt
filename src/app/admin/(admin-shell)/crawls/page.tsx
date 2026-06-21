"use client";

import { api } from "convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, CheckCircle2, Clock, Globe, Loader2, Play, XCircle } from "lucide-react";
import { useState } from "react";
import { LoadingState } from "@/components/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UET_CRAWL_CONFIG } from "@/lib/constants";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/10",
  running: "bg-blue-500/10 text-blue-500 border-blue-500/10",
  completed: "bg-green-500/10 text-green-500 border-green-500/10",
  failed: "bg-red-500/10 text-red-500 border-red-500/10",
  cancelled: "bg-gray-500/10 text-gray-500 border-gray-500/10",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  running: <Loader2 className="h-3 w-3 animate-spin" />,
  completed: <CheckCircle2 className="h-3 w-3" />,
  failed: <XCircle className="h-3 w-3" />,
  cancelled: <AlertTriangle className="h-3 w-3" />,
};

export default function AdminCrawlsPage() {
  const [isTriggering, setIsTriggering] = useState(false);
  const crawls = useQuery(api.crawl.list.list, {});

  const triggerCrawl = useMutation(api.crawl.trigger.trigger);

  const handleTriggerCrawl = async () => {
    setIsTriggering(true);
    try {
      await triggerCrawl({
        url: "https://web.uettaxila.edu.pk/",
        maxPages: 500,
        maxDepth: UET_CRAWL_CONFIG.maxDepth,
      });
    } catch (error) {
      console.error("Failed to trigger crawl:", error);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-6 animate-[slide-up_0.3s_ease-[var(--ease-out-expo)]_both]">
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 font-mono tracking-tight uppercase">
            [ CRITICAL_SYSTEM: CRAWL JOBS ]
          </h2>
          <p className="text-xs text-zinc-500 font-sans mt-0.5">
            Manage and monitor website crawling engines
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled
            className="h-8 border-white/5 bg-[var(--surface-3)]/40 text-xs font-mono tracking-wider text-zinc-500"
            title="Data updates automatically"
          >
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse mr-2" />
            LIVE
          </Button>
          <Button
            size="sm"
            onClick={handleTriggerCrawl}
            disabled={isTriggering}
            className="h-8 bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] font-mono text-xs font-semibold tracking-wider transition-all active:scale-[0.98] ease-[var(--ease-spring)]"
          >
            {isTriggering ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 mr-2" />
            )}
            NEW CRAWL
          </Button>
        </div>
      </div>

      {crawls === undefined ? (
        <LoadingState type="admin-list" />
      ) : crawls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-white/5 rounded-xl bg-[var(--surface-3)]/20">
          <Globe className="h-10 w-10 text-zinc-500 mb-4" />
          <p className="text-xs text-zinc-400 font-mono tracking-wider">
            NO ACTIVE CRAWL RECORDS FOUND
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-6 h-8 border-white/5 bg-[var(--surface-3)]/40 text-xs font-mono tracking-wider hover:bg-white/5 hover:text-white transition-all active:scale-[0.98]"
            onClick={handleTriggerCrawl}
            disabled={isTriggering}
          >
            START FIRST CRAWL ENGINE
          </Button>
        </div>
      ) : (
        <div className="border border-white/5 rounded-xl bg-[var(--surface-3)]/20 overflow-hidden">
          <ScrollArea className="h-[calc(100dvh-220px)]">
            <div className="divide-y divide-white/[0.04]">
              {crawls.map((crawl: any) => (
                <div
                  key={crawl._id}
                  className="group flex flex-col p-4 bg-transparent hover:bg-white/[0.02] transition-all duration-200 relative overflow-hidden"
                >
                  {/* Subtle active indicator bar */}
                  {crawl.status === "running" && (
                    <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-blue-500 animate-pulse" />
                  )}

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`flex items-center gap-1.5 text-[9px] font-mono uppercase rounded border px-2 py-0.5 ${
                            statusColors[crawl.status] || ""
                          }`}
                        >
                          {statusIcons[crawl.status]}
                          {crawl.status}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="text-[9px] font-mono bg-zinc-950 border border-white/5 text-zinc-400 px-2 py-0.5 rounded"
                        >
                          {crawl.trigger}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-zinc-500 font-mono mt-1">
                        <span>STARTED: {new Date(crawl.startedAt).toLocaleString()}</span>
                        {crawl.completedAt && (
                          <>
                            <span>·</span>
                            <span>COMPLETED: {new Date(crawl.completedAt).toLocaleString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {crawl.error && (
                      <p className="text-[10px] text-red-400 max-w-sm md:text-right font-mono bg-red-950/20 border border-red-900/30 px-3 py-1.5 rounded">
                        {crawl.error}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-zinc-950/20 border border-white/5 rounded-lg py-3 px-4 group-hover:bg-zinc-950/40 transition-colors">
                    <div className="text-center sm:text-left">
                      <p className="text-sm font-bold text-zinc-200 font-mono">
                        {crawl.stats.successfulPages}
                      </p>
                      <p className="text-[9px] text-zinc-500 font-mono uppercase">Success</p>
                    </div>
                    <div className="text-center sm:text-left border-l border-white/5 pl-2 sm:border-l sm:pl-4">
                      <p className="text-sm font-bold text-zinc-200 font-mono">
                        {crawl.stats.failedPages}
                      </p>
                      <p className="text-[9px] text-zinc-500 font-mono uppercase">Failed</p>
                    </div>
                    <div className="text-center sm:text-left border-l border-white/5 pl-2 sm:border-l sm:pl-4">
                      <p className="text-sm font-bold text-zinc-200 font-mono">
                        {crawl.stats.totalChunks}
                      </p>
                      <p className="text-[9px] text-zinc-500 font-mono uppercase">Chunks</p>
                    </div>
                    <div className="text-center sm:text-left border-l border-white/5 pl-2 sm:border-l sm:pl-4">
                      <p className="text-sm font-bold text-zinc-200 font-mono">
                        {(crawl.stats.totalTokens / 1000).toFixed(1)}k
                      </p>
                      <p className="text-[9px] text-zinc-500 font-mono uppercase">Tokens</p>
                    </div>
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
