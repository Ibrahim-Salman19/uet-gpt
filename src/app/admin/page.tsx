"use client";

import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";
import { Activity, Database, FileText, Globe, ThumbsDown, ThumbsUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
}

function StatCard({ title, value, description, icon, trend }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || trend) && (
          <div className="flex items-center gap-2 mt-1">
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            {trend && (
              <span className={trend.positive ? "text-xs text-green-500" : "text-xs text-red-500"}>
                {trend.value}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const stats = useQuery(api.admin.stats.dashboardStats);

  if (stats === undefined) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Document Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Indexed</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{
                        width: `${
                          stats.totalDocuments > 0
                            ? (stats.indexedDocuments / stats.totalDocuments) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">
                    {stats.indexedDocuments}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pending</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-yellow-500 transition-all"
                      style={{
                        width: `${
                          stats.totalDocuments > 0
                            ? (stats.pendingDocuments / stats.totalDocuments) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">
                    {stats.pendingDocuments}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Failed</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-500 transition-all"
                      style={{
                        width: `${
                          stats.totalDocuments > 0
                            ? (stats.failedDocuments / stats.totalDocuments) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">
                    {stats.failedDocuments}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Crawls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Crawl Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentCrawls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No crawl jobs yet</p>
            ) : (
              <ScrollArea className="h-[140px]">
                <div className="space-y-2">
                  {stats.recentCrawls.map((crawl: any) => (
                    <div key={crawl._id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            crawl.status === "completed"
                              ? "default"
                              : crawl.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {crawl.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{crawl.trigger}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(crawl.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentFeedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feedback yet</p>
          ) : (
            <div className="space-y-2">
              {stats.recentFeedback.map((fb: any) => (
                <div
                  key={fb._id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-2">
                    {fb.rating === "thumbsUp" ? (
                      <ThumbsUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <ThumbsDown className="h-4 w-4 text-red-500" />
                    )}
                    {fb.category && (
                      <Badge variant="outline" className="text-xs">
                        {fb.category}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(fb.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
