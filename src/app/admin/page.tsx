"use client";

import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";
import { Activity, Database, FileText, Globe, ThumbsDown, ThumbsUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
}

function StatCard({ title, value, description, icon, trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#101012]/40 backdrop-blur-sm p-5 hover:border-[var(--accent)]/30 hover:bg-[#101012]/60 transition-all duration-300">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-sans">{title}</span>
        <div className="text-zinc-500 shrink-0">{icon}</div>
      </div>
      <div className="mt-3 text-3xl font-bold text-zinc-100 tracking-tight font-mono">{value}</div>
      {(description || trend) && (
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {description && <span className="text-[10px] text-zinc-500 font-sans">{description}</span>}
          {trend && (
            <span className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full border font-mono",
              trend.positive 
                ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/10" 
                : "text-red-400 bg-red-500/5 border-red-500/10"
            )}>
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminOverviewPage() {
  const stats = useQuery(api.admin.stats.dashboardStats, {});

  if (stats === undefined) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 stagger-enter">
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={i} className="rounded-xl border border-white/5 bg-[#101012]/40 backdrop-blur-sm p-5 space-y-3">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-[slide-up_0.3s_ease-[var(--ease-out-expo)]_both]">
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-base font-semibold text-zinc-100 font-sans tracking-tight">Overview</h2>
      </div>

      {/* Primary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Documents"
          value={stats.totalDocuments}
          description={`${stats.indexedDocuments} indexed`}
          icon={<FileText className="h-4 w-4" />}
          trend={{
            value: `${stats.pendingDocuments} pending`,
            positive: stats.failedDocuments === 0,
          }}
        />
        <StatCard
          title="Active Users Today"
          value={stats.activeUsersLast24h}
          description={`${stats.totalUsers} total users`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          title="Crawl Jobs"
          value={stats.totalCrawlJobs}
          description={`${stats.totalCrawlJobs} total runs`}
          icon={<Globe className="h-4 w-4" />}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Feedback"
          value={stats.totalFeedback}
          icon={<ThumbsUp className="h-4 w-4" />}
        />
        <StatCard
          title="Cache Entries"
          value={stats.totalCacheEntries}
          description="Semantic cache"
          icon={<Database className="h-4 w-4" />}
        />
        <StatCard
          title="Document Issues"
          value={stats.failedDocuments}
          description="Failed documents"
          icon={<Activity className="h-4 w-4" />}
          trend={{
            value: stats.failedDocuments > 0 ? "Needs attention" : "All clear",
            positive: stats.failedDocuments === 0,
          }}
        />
      </div>

      {/* Document Status Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="border border-white/5 rounded-2xl bg-[#101012]/40 backdrop-blur-sm p-6">
          <div className="mb-4 pb-3 border-b border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-sans">Document Status</h3>
          </div>
          <div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-sans">Indexed</span>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-32 rounded-full bg-zinc-900 overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{
                        width: `${
                          stats.totalDocuments > 0
                            ? (stats.indexedDocuments / stats.totalDocuments) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold font-mono text-zinc-300 w-8 text-right">
                    {stats.indexedDocuments}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-sans">Pending</span>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-32 rounded-full bg-zinc-900 overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all duration-500"
                      style={{
                        width: `${
                          stats.totalDocuments > 0
                            ? (stats.pendingDocuments / stats.totalDocuments) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold font-mono text-zinc-300 w-8 text-right">
                    {stats.pendingDocuments}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-sans">Failed</span>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-32 rounded-full bg-zinc-900 overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full bg-red-500 transition-all duration-500"
                      style={{
                        width: `${
                          stats.totalDocuments > 0
                            ? (stats.failedDocuments / stats.totalDocuments) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold font-mono text-zinc-300 w-8 text-right">
                    {stats.failedDocuments}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Crawls */}
        <div className="border border-white/5 rounded-2xl bg-[#101012]/40 backdrop-blur-sm p-6">
          <div className="mb-4 pb-3 border-b border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-sans">Recent Crawl Jobs</h3>
          </div>
          <div>
            {stats.recentCrawls.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center font-sans">No crawl jobs yet</p>
            ) : (
              <ScrollArea className="h-[140px]">
                <div className="space-y-3">
                  {stats.recentCrawls.map((crawl: any) => (
                    <div key={crawl._id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] font-mono py-0.5 px-2 uppercase rounded-md border",
                            crawl.status === "completed"
                              ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/10"
                              : crawl.status === "failed"
                                ? "text-red-400 bg-red-500/5 border-red-500/10"
                                : "text-zinc-400 bg-zinc-900/60 border-white/5"
                          )}
                        >
                          {crawl.status}
                        </Badge>
                        <span className="text-xs text-zinc-400 font-sans">{crawl.trigger}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-sans">
                        {new Date(crawl.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>

      {/* Recent Feedback */}
      <div className="border border-white/5 rounded-2xl bg-[#101012]/40 backdrop-blur-sm p-6">
        <div className="mb-4 pb-3 border-b border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-sans">Recent Feedback</h3>
        </div>
        <div>
          {stats.recentFeedback.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center font-sans">No feedback yet</p>
          ) : (
            <div className="space-y-2">
              {stats.recentFeedback.map((fb: any) => (
                <div
                  key={fb._id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-950/20 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    {fb.rating === "thumbsUp" ? (
                      <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <ThumbsDown className="h-3.5 w-3.5 text-red-400" />
                    )}
                    {fb.category && (
                      <Badge variant="outline" className="text-[9px] uppercase tracking-wider bg-zinc-900/60 text-zinc-400 border border-white/5 font-mono py-0.5 px-2">
                        {fb.category}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500 font-sans">
                    {new Date(fb.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
