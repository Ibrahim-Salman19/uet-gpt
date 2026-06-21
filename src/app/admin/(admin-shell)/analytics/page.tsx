"use client";

import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";
import {
  Activity,
  Database,
  HardDrive,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {["skele-1", "skele-2", "skele-3", "skele-4", "skele-5", "skele-6"].map((id) => (
          <Card
            key={id}
            className="rounded-xl border border-white/5 bg-[var(--surface-3)]/40 p-5 space-y-3"
          >
            <CardHeader className="pb-2 p-0">
              <Skeleton className="h-4 w-24 bg-white/5" />
            </CardHeader>
            <CardContent className="p-0">
              <Skeleton className="h-8 w-16 mb-2 bg-white/10" />
              <Skeleton className="h-3 w-32 bg-white/5" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="pb-2 border-b border-white/[0.04]">
      <h2 className="text-sm font-semibold text-zinc-300 font-sans tracking-tight flex items-center gap-2">
        <span>{title}</span>
        <span className="text-[10px] text-zinc-500 font-mono font-normal">{subtitle}</span>
      </h2>
    </div>
  );
}

function UsageMetricsSection({
  activeUsers,
  totalUsers,
  satisfactionRate,
  positiveFeedback,
  negativeFeedback,
}: {
  activeUsers: number;
  totalUsers: number;
  satisfactionRate: number;
  positiveFeedback: number;
  negativeFeedback: number;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Usage Metrics" subtitle="[ METRICS: USER UTILITY ]" />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2 rounded-xl border border-white/5 bg-[var(--surface-3)]/40 p-6 hover:border-[var(--accent)]/20 hover:bg-[var(--surface-3)]/60 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-sans flex items-center gap-2">
              <Users className="h-4 w-4 text-zinc-400" />
              Active Users Today
            </span>
            <span className="text-[9px] font-mono text-zinc-500">REAL_TIME</span>
          </div>
          <div className="mt-4 flex items-baseline gap-4">
            <div className="text-4xl font-bold text-zinc-100 font-mono tracking-tight">
              {activeUsers}
            </div>
            <div className="text-xs text-zinc-500 font-mono">
              <span className="text-zinc-600 mr-1">/</span>
              {totalUsers.toLocaleString()} total users
            </div>
          </div>
        </Card>

        <Card className="rounded-xl border border-white/5 bg-[var(--surface-3)]/40 p-6 hover:border-[var(--accent)]/20 hover:bg-[var(--surface-3)]/60 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-sans flex items-center gap-2">
              <Activity className="h-4 w-4 text-zinc-400" />
              Satisfaction Rate
            </span>
            <span className="text-[9px] font-mono text-zinc-500">KPI</span>
          </div>
          <div className="mt-4 text-4xl font-bold text-zinc-100 font-mono tracking-tight">
            {satisfactionRate}%
          </div>
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.04]">
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
              <ThumbsUp className="h-3 w-3" /> {positiveFeedback}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-red-400">
              <ThumbsDown className="h-3 w-3" /> {negativeFeedback}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SystemMetricsSection({
  storageUsed,
  totalDocuments,
  totalCacheEntries,
}: {
  storageUsed: { documents: number; cache: number; total: number };
  totalDocuments: number;
  totalCacheEntries: number;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader title="System Metrics" subtitle="[ STORAGE: DATA CORE ]" />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border border-white/5 bg-[var(--surface-3)]/40 p-5 hover:border-[var(--accent)]/20 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-sans flex items-center gap-2">
              <Database className="h-4 w-4 text-zinc-400" />
              Document Storage
            </span>
          </div>
          <div className="mt-4 text-2xl font-bold text-zinc-100 font-mono tracking-tight">
            {(storageUsed.documents / 1024).toFixed(1)} KB
          </div>
          <div className="mt-1 text-[10px] text-zinc-500 font-mono">
            {totalDocuments.toLocaleString()} documents
          </div>
        </Card>

        <Card className="rounded-xl border border-white/5 bg-[var(--surface-3)]/40 p-5 hover:border-[var(--accent)]/20 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-sans flex items-center gap-2">
              <Database className="h-4 w-4 text-zinc-400" />
              Cache Storage
            </span>
          </div>
          <div className="mt-4 text-2xl font-bold text-zinc-100 font-mono tracking-tight">
            {(storageUsed.cache / 1024).toFixed(1)} KB
          </div>
          <div className="mt-1 text-[10px] text-zinc-500 font-mono">
            {totalCacheEntries.toLocaleString()} cache entries
          </div>
        </Card>

        <Card className="rounded-xl border border-white/5 bg-[var(--surface-3)]/40 p-5 hover:border-[var(--accent)]/20 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-sans flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-zinc-400" />
              Total Storage
            </span>
          </div>
          <div className="mt-4 text-2xl font-bold text-zinc-100 font-mono tracking-tight">
            {(storageUsed.total / 1024).toFixed(1)} KB
          </div>
          <div className="mt-1 text-[10px] text-zinc-500 font-mono">
            Combined document + cache storage
          </div>
        </Card>
      </div>
    </div>
  );
}

function DocumentHealthSection({
  indexedDocuments,
  pendingDocuments,
  failedDocuments,
  totalDocuments,
}: {
  indexedDocuments: number;
  pendingDocuments: number;
  failedDocuments: number;
  totalDocuments: number;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Document Health" subtitle="[ PIPELINE: INDEXER HEALTH ]" />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border border-green-500/10 bg-[var(--surface-3)]/40 p-5 hover:border-green-500/20 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-green-500 uppercase tracking-wider font-sans flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Indexed
            </span>
          </div>
          <div className="mt-4 text-3xl font-bold text-zinc-100 font-mono">{indexedDocuments}</div>
          <div className="mt-1 text-[10px] text-zinc-500 font-mono uppercase">
            {totalDocuments > 0
              ? `${Math.round((indexedDocuments / totalDocuments) * 100)}% of total`
              : "No documents"}
          </div>
        </Card>

        <Card className="rounded-xl border border-yellow-500/10 bg-[var(--surface-3)]/40 p-5 hover:border-yellow-500/20 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-sans flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Pending
            </span>
          </div>
          <div className="mt-4 text-3xl font-bold text-zinc-100 font-mono">{pendingDocuments}</div>
          <div className="mt-1 text-[10px] text-zinc-500 font-mono">Awaiting processing</div>
        </Card>

        <Card
          className={`rounded-xl p-5 transition-all duration-300 border ${
            failedDocuments > 0
              ? "border-red-500/20 bg-red-950/5 hover:border-red-500/30"
              : "border-gray-500/20 bg-[var(--surface-3)]/40 hover:border-white/10"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold uppercase tracking-wider font-sans flex items-center gap-2 ${
                failedDocuments > 0 ? "text-red-500" : "text-zinc-500"
              }`}
            >
              <TrendingDown className="h-4 w-4" />
              Failed
            </span>
          </div>
          <div
            className={`mt-4 text-3xl font-bold font-mono ${
              failedDocuments > 0 ? "text-red-400" : "text-zinc-100"
            }`}
          >
            {failedDocuments}
          </div>
          <div className="mt-1 text-[10px] text-zinc-500 font-mono">
            {failedDocuments > 0 ? "Needs investigation" : "No issues detected"}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const docs = useQuery(api.admin.stats.documentStats, {});
  const users = useQuery(api.admin.stats.userStats, {});
  const feedbackCount = useQuery(api.admin.stats.feedbackCount, {});
  const feedbackRecent = useQuery(api.admin.stats.feedbackStats, {});
  const cache = useQuery(api.admin.stats.cacheStats, {});

  const loading =
    docs === undefined ||
    users === undefined ||
    feedbackCount === undefined ||
    feedbackRecent === undefined ||
    cache === undefined;

  if (loading) {
    return <AnalyticsLoadingSkeleton />;
  }

  const positiveFeedback = feedbackRecent.recent.filter((f: any) => f.rating === "thumbsUp").length;
  const negativeFeedback = feedbackRecent.recent.filter(
    (f: any) => f.rating === "thumbsDown",
  ).length;
  const totalRecent = positiveFeedback + negativeFeedback;
  const satisfactionRate = totalRecent > 0 ? Math.round((positiveFeedback / totalRecent) * 100) : 0;

  const avgDocSize = 250;
  const avgCacheSize = 1000;
  const storageUsed = {
    documents: docs.total * avgDocSize,
    cache: cache.total * avgCacheSize,
    total: docs.total * avgDocSize + cache.total * avgCacheSize,
  };

  return (
    <div className="space-y-8 animate-[slide-up_0.3s_ease-[var(--ease-out-expo)]_both]">
      <UsageMetricsSection
        activeUsers={users.activeLast24h}
        totalUsers={users.total}
        satisfactionRate={satisfactionRate}
        positiveFeedback={positiveFeedback}
        negativeFeedback={negativeFeedback}
      />

      <Separator />

      <SystemMetricsSection
        storageUsed={storageUsed}
        totalDocuments={docs.total}
        totalCacheEntries={cache.total}
      />

      <Separator />

      <DocumentHealthSection
        indexedDocuments={docs.indexed}
        pendingDocuments={docs.pending}
        failedDocuments={docs.failed}
        totalDocuments={docs.total}
      />
    </div>
  );
}
