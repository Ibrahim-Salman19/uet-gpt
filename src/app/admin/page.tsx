"use client";

import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";
import { Activity, Database, FileText, Globe, ThumbsDown, ThumbsUp, Users } from "lucide-react";
import { LoadingState } from "@/components/loading-state";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function DocumentsStatusBar({
  indexed,
  pending,
  failed,
  total,
}: {
  indexed: number;
  pending: number;
  failed: number;
  total: number;
}) {
  return (
    <div className="mt-4 pt-3 border-t border-white/[0.04] space-y-2">
      <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono">
        <span>INDEXED / PENDING / FAILED</span>
        <span>
          {indexed} / {pending} / {failed}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-950 overflow-hidden border border-white/5 flex">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${total > 0 ? (indexed / total) * 100 : 0}%` }}
        />
        <div
          className="h-full bg-amber-500 transition-all duration-500"
          style={{ width: `${total > 0 ? (pending / total) * 100 : 0}%` }}
        />
        <div
          className="h-full bg-red-500 transition-all duration-500"
          style={{ width: `${total > 0 ? (failed / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

function RecentCrawlsPanel({ crawls }: { crawls: any[] }) {
  return (
    <div className="border border-white/5 rounded-xl bg-[#101012]/40 backdrop-blur-sm p-6 flex flex-col h-[280px]">
      <div className="mb-4 pb-3 border-b border-white/5 flex justify-between items-center">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
          [ SYSTEM: RECENT CRAWLS ]
        </h3>
        <span className="text-[9px] text-zinc-500 font-mono">LIVE_FEED</span>
      </div>
      <div className="flex-1 overflow-hidden">
        {crawls.length === 0 ? (
          <p className="text-xs text-zinc-500 py-12 text-center font-sans">No crawl jobs yet</p>
        ) : (
          <ScrollArea className="h-full pr-2">
            <div className="space-y-3">
              {crawls.map((crawl: any) => (
                <div
                  key={crawl._id}
                  className="flex items-center justify-between py-2 border-b border-white/[0.02] last:border-0 hover:bg-white/[0.02] rounded px-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[8px] font-mono py-0.5 px-2 uppercase rounded border",
                        crawl.status === "completed"
                          ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/10"
                          : crawl.status === "failed"
                            ? "text-red-400 bg-red-500/5 border-red-500/10"
                            : "text-zinc-400 bg-zinc-900/60 border-white/5",
                      )}
                    >
                      {crawl.status}
                    </Badge>
                    <span className="text-xs text-zinc-300 font-mono max-w-[140px] truncate">
                      {crawl.trigger}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {new Date(crawl.startedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

function RecentFeedbackPanel({ feedback }: { feedback: any[] }) {
  return (
    <div className="border border-white/5 rounded-xl bg-[#101012]/40 backdrop-blur-sm p-6 flex flex-col h-[280px]">
      <div className="mb-4 pb-3 border-b border-white/5 flex justify-between items-center">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
          [ CUSTOMER: RECENT FEEDBACK ]
        </h3>
        <span className="text-[9px] text-zinc-500 font-mono">USER_ENGAGEMENT</span>
      </div>
      <div className="flex-1 overflow-hidden">
        {feedback.length === 0 ? (
          <p className="text-xs text-zinc-500 py-12 text-center font-sans">No feedback yet</p>
        ) : (
          <ScrollArea className="h-full pr-2">
            <div className="space-y-2">
              {feedback.map((fb: any) => (
                <div
                  key={fb._id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-zinc-950/20 px-3 py-2 hover:border-white/10 hover:bg-zinc-950/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {fb.rating === "thumbsUp" ? (
                      <ThumbsUp className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <ThumbsDown className="h-3 w-3 text-red-400" />
                    )}
                    {fb.category && (
                      <Badge
                        variant="outline"
                        className="text-[8px] uppercase tracking-wider bg-zinc-900/60 text-zinc-400 border border-white/5 font-mono py-0.5 px-1.5 rounded"
                      >
                        {fb.category}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[9px] text-zinc-500 font-mono">
                    {new Date(fb.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const docs = useQuery(api.admin.stats.documentStats, {});
  const users = useQuery(api.admin.stats.userStats, {});
  const feedbackCount = useQuery(api.admin.stats.feedbackCount, {});
  const feedbackRecent = useQuery(api.admin.stats.feedbackStats, {});
  const crawlCount = useQuery(api.admin.stats.crawlCount, {});
  const crawlRecent = useQuery(api.admin.stats.crawlStats, {});
  const cache = useQuery(api.admin.stats.cacheStats, {});

  const loading = docs === undefined || users === undefined || feedbackCount === undefined ||
    feedbackRecent === undefined || crawlCount === undefined || crawlRecent === undefined ||
    cache === undefined;

  if (loading) {
    return <LoadingState type="admin-overview" />;
  }

  return (
    <div className="space-y-6 animate-[slide-up_0.3s_ease-[var(--ease-out-expo)]_both]">
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
        <h2 className="text-sm font-semibold text-zinc-400 font-mono tracking-tight uppercase">
          [ ADMIN_SYSTEM: OVERVIEW ]
        </h2>
      </div>

      {/* Primary row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2 rounded-xl border border-white/5 bg-[#101012]/40 backdrop-blur-sm p-5 transition-all duration-300 hover:border-[var(--accent)]/30 hover:bg-[#101012]/60 active:scale-[0.99] ease-[var(--ease-spring)]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-sans">
              Total Documents
            </span>
            <div className="text-zinc-500 shrink-0"><FileText className="h-4 w-4 text-zinc-500" /></div>
          </div>
          <div className="mt-3 text-3xl font-bold text-zinc-100 tracking-tight font-mono">{docs.total}</div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] text-zinc-500 font-sans">{docs.indexed} indexed</span>
            <span className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full border font-mono",
              docs.failed === 0
                ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/10"
                : "text-red-400 bg-red-500/5 border-red-500/10",
            )}>
              {docs.pending} pending
            </span>
          </div>
          <DocumentsStatusBar
            indexed={docs.indexed}
            pending={docs.pending}
            failed={docs.failed}
            total={docs.total}
          />
        </div>
        <StatCard
          title="Active Users Today"
          value={users.activeLast24h}
          description={`${users.total} total users`}
          icon={<Users className="h-4 w-4 text-zinc-500" />}
        />
        <StatCard
          title="Crawl Jobs"
          value={crawlCount}
          description={`${crawlCount} total runs`}
          icon={<Globe className="h-4 w-4" />}
        />
      </div>

      {/* Secondary row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Feedback"
          value={feedbackCount}
          icon={<ThumbsUp className="h-4 w-4 text-zinc-500" />}
        />
        <StatCard
          title="Cache Entries"
          value={cache.total}
          description="Semantic cache"
          icon={<Database className="h-4 w-4" />}
        />
        <div className="lg:col-span-2 rounded-xl border border-white/5 bg-[#101012]/40 backdrop-blur-sm p-5 transition-all duration-300 hover:border-[var(--accent)]/30 hover:bg-[#101012]/60 active:scale-[0.99] ease-[var(--ease-spring)]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-sans">
              Document Issues
            </span>
            <div className="text-zinc-500 shrink-0"><Activity className="h-4 w-4 text-zinc-500" /></div>
          </div>
          <div className="mt-3 text-3xl font-bold text-zinc-100 tracking-tight font-mono">{docs.failed}</div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] text-zinc-500 font-sans">Failed documents</span>
            <span className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full border font-mono",
              docs.failed === 0
                ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/10"
                : "text-red-400 bg-red-500/5 border-red-500/10",
            )}>
              {docs.failed === 0 ? "All clear" : "Needs attention"}
            </span>
          </div>
          {docs.failed > 0 && (
            <div className="mt-4 pt-3 border-t border-white/[0.04] text-[9px] text-red-400 font-mono flex items-center gap-1.5 animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span>CRITICAL: CHECK PIPELINE LOGS FOR DETAILS</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent panels */}
      <div className="grid gap-4 md:grid-cols-2">
        <RecentCrawlsPanel crawls={crawlRecent.recent} />
        <RecentFeedbackPanel feedback={feedbackRecent.recent} />
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  className?: string;
  children?: React.ReactNode;
}

function StatCard({ title, value, description, icon, trend, className, children }: StatCardProps) {
  return (
    <div className={cn(
      "rounded-xl border border-white/5 bg-[#101012]/40 backdrop-blur-sm p-5 transition-all duration-300 hover:border-[var(--accent)]/30 hover:bg-[#101012]/60 active:scale-[0.99] ease-[var(--ease-spring)]",
      className,
    )}>
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
                : "text-red-400 bg-red-500/5 border-red-500/10",
            )}>
              {trend.value}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
