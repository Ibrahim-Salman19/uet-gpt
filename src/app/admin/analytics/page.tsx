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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminAnalyticsPage() {
  const stats = useQuery(api.admin.stats.dashboardStats, {});

  if (!stats) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const positiveFeedback = stats.recentFeedback.filter((f: any) => f.rating === "thumbsUp").length;
  const negativeFeedback = stats.recentFeedback.filter(
    (f: any) => f.rating === "thumbsDown",
  ).length;
  const totalRecent = positiveFeedback + negativeFeedback;
  const satisfactionRate = totalRecent > 0 ? Math.round((positiveFeedback / totalRecent) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Usage Metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Usage Metrics</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Active Users Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeUsersLast24h}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalUsers.toLocaleString()} total users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Satisfaction Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{satisfactionRate}%</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <ThumbsUp className="h-3 w-3" /> {positiveFeedback}
                </span>
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <ThumbsDown className="h-3 w-3" /> {negativeFeedback}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* System Metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">System Metrics</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Database className="h-4 w-4" />
                Document Storage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.storageUsed.documents / 1024).toFixed(1)} KB
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalDocuments.toLocaleString()} documents
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Database className="h-4 w-4" />
                Cache Storage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.storageUsed.cache / 1024).toFixed(1)} KB
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalCacheEntries.toLocaleString()} cache entries
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Total Storage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats.storageUsed.total / 1024).toFixed(1)} KB
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Combined document + cache storage
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Document Health */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Document Health</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-green-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-500 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Indexed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.indexedDocuments}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalDocuments > 0
                  ? `${Math.round((stats.indexedDocuments / stats.totalDocuments) * 100)}% of total`
                  : "No documents"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-500 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingDocuments}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting processing</p>
            </CardContent>
          </Card>

          <Card className={stats.failedDocuments > 0 ? "border-red-500/20" : "border-gray-500/20"}>
            <CardHeader className="pb-2">
              <CardTitle
                className={`text-sm font-medium flex items-center gap-2 ${
                  stats.failedDocuments > 0 ? "text-red-500" : "text-muted-foreground"
                }`}
              >
                <TrendingDown className="h-4 w-4" />
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failedDocuments}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.failedDocuments > 0 ? "Needs investigation" : "No issues detected"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
