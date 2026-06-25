"use client";

import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Filter, MessageSquare, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

type FeedbackDoc = Doc<"feedback">;

export default function AdminFeedbackPage() {
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const feedback = useQuery(api.feedback.list, {});
  const deleteFeedback = useMutation(api.admin.stats.deleteFeedback);

  const handleDelete = async (feedbackId: Id<"feedback">) => {
    if (confirm("Are you sure you want to delete this feedback entry?")) {
      try {
        await deleteFeedback({ feedbackId });
        toast.success("Feedback deleted successfully");
      } catch (error) {
        console.error("Failed to delete feedback:", error);
        toast.error("Failed to delete feedback. Please try again.");
      }
    }
  };

  const filteredFeedback = useMemo(() => {
    if (!feedback) return [];
    const all = feedback as FeedbackDoc[];
    return ratingFilter === "all" ? all : all.filter((f) => f.rating === ratingFilter);
  }, [feedback, ratingFilter]);

  const { positiveCount, negativeCount } = useMemo(() => {
    if (!feedback) return { positiveCount: 0, negativeCount: 0 };
    const all = feedback as FeedbackDoc[];
    return {
      positiveCount: all.filter((f) => f.rating === "thumbsUp").length,
      negativeCount: all.filter((f) => f.rating === "thumbsDown").length,
    };
  }, [feedback]);

  if (feedback === undefined) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Summary skeleton row */}
        <div className="grid gap-4 md:grid-cols-3">
          {["skele-sum-1", "skele-sum-2", "skele-sum-3"].map((id) => (
            <Card
              key={id}
              className="rounded-xl border border-white/5 bg-[var(--surface-3)]/40 p-5 space-y-4"
            >
              <Skeleton className="h-3.5 w-24 bg-white/5 rounded" />
              <Skeleton className="h-8 w-16 bg-white/10 rounded" />
            </Card>
          ))}
        </div>
        {/* Divider */}
        <Separator />
        {/* List skeleton */}
        <div className="space-y-3">
          {["skele-row-1", "skele-row-2", "skele-row-3", "skele-row-4", "skele-row-5"].map((id) => (
            <Card
              key={id}
              className="p-4 bg-[var(--surface-3)]/40 border-white/5 relative overflow-hidden"
            >
              <div className="space-y-2">
                <Skeleton className="h-4 w-48 mb-2 bg-white/10 rounded" />
                <Skeleton className="h-3 w-32 bg-white/5 rounded" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-[slide-up_0.3s_ease-[var(--ease-out-expo)]_both]">
      {/* Bento Summary Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border border-white/5 bg-[var(--surface-3)]/40 p-5 hover:border-white/10 hover:bg-[var(--surface-3)]/60 transition-colors">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-sans">
            Total Feedback
          </span>
          <div className="mt-3 text-3xl font-bold text-zinc-100 font-mono tracking-tight">
            {feedback.length}
          </div>
        </Card>

        <Card className="rounded-xl border border-green-500/10 bg-[var(--surface-3)]/40 p-5 hover:border-green-500/20 hover:bg-[var(--surface-3)]/60 transition-colors">
          <span className="text-xs font-semibold text-green-500 uppercase tracking-wider font-sans flex items-center gap-2">
            <ThumbsUp className="h-3.5 w-3.5" />
            Positive
          </span>
          <div className="mt-3 text-3xl font-bold text-green-400 font-mono tracking-tight">
            {positiveCount}
          </div>
        </Card>

        <Card className="rounded-xl border border-red-500/10 bg-[var(--surface-3)]/40 p-5 hover:border-red-500/20 hover:bg-[var(--surface-3)]/60 transition-colors">
          <span className="text-xs font-semibold text-red-500 uppercase tracking-wider font-sans flex items-center gap-2">
            <ThumbsDown className="h-3.5 w-3.5" />
            Negative
          </span>
          <div className="mt-3 text-3xl font-bold text-red-400 font-mono tracking-tight">
            {negativeCount}
          </div>
        </Card>
      </div>

      {/* Header and Filters */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.04] mt-8">
        <div className="flex items-center gap-2">
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger className="w-[170px] h-9 bg-black/40 border-white/5 text-xs font-mono rounded text-zinc-300">
              <Filter className="h-3.5 w-3.5 mr-2 text-zinc-500" />
              <SelectValue placeholder="Filter by rating" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--surface-3)] border-white/10 text-xs font-mono text-zinc-300">
              <SelectItem value="all">ALL_FEEDBACK</SelectItem>
              <SelectItem value="thumbsUp">POSITIVE</SelectItem>
              <SelectItem value="thumbsDown">NEGATIVE</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
          FEEDBACK_INDEX
        </span>
      </div>

      <Separator />

      {/* Feedback List Container */}
      {filteredFeedback.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 border border-white/5 rounded-xl bg-[var(--surface-3)]/20">
          <MessageSquare className="h-10 w-10 text-zinc-500 mb-4" />
          <p className="text-xs text-zinc-400 font-mono tracking-wider">
            {ratingFilter !== "all" ? "No feedback matches your filter" : "No feedback yet"}
          </p>
        </Card>
      ) : (
        <div className="border border-white/5 rounded-xl bg-[var(--surface-3)]/20 overflow-hidden">
          <ScrollArea className="h-[calc(100dvh-360px)]">
            <div className="divide-y divide-white/[0.04]">
              {filteredFeedback.map((fb) => (
                <Card
                  key={String(fb._id)}
                  className="group flex items-start justify-between p-4 bg-transparent border-0 hover:bg-white/[0.02] transition-colors relative rounded-none"
                >
                  <CardContent className="flex-1 min-w-0 pr-4 p-0 bg-transparent">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {fb.rating === "thumbsUp" ? (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1.5 text-[8px] font-mono uppercase rounded px-1.5 py-0.5 border text-emerald-400 bg-emerald-500/5 border-emerald-500/10"
                        >
                          <ThumbsUp className="h-3 w-3" />
                          Positive
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1.5 text-[8px] font-mono uppercase rounded px-1.5 py-0.5 border text-red-400 bg-red-500/5 border-red-500/10"
                        >
                          <ThumbsDown className="h-3 w-3" />
                          Negative
                        </Badge>
                      )}
                      {fb.category && (
                        <Badge
                          variant="secondary"
                          className="text-[8px] font-mono bg-zinc-950 border border-white/5 text-zinc-400 px-1.5 py-0.5 rounded"
                        >
                          {String(fb.category)}
                        </Badge>
                      )}
                    </div>
                    {fb.comment && (
                      <p className="text-xs text-zinc-300 mt-2 font-sans leading-relaxed">
                        {String(fb.comment)}
                      </p>
                    )}
                    <p className="text-[9px] text-zinc-500 font-mono mt-2 uppercase">
                      SUBMITTED: {new Date(Number(fb.createdAt)).toLocaleString()}
                    </p>
                  </CardContent>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:bg-red-500/10 hover:text-red-400 rounded shrink-0 transition-colors active:scale-[0.98]"
                    onClick={() => handleDelete(fb._id)}
                    title="Delete feedback"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
