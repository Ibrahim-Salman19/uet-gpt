"use client";

import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { Filter, MessageSquare, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const feedback = useQuery(
    api.feedback.list as unknown as FunctionReference<"query", "public">,
    {},
  );
  const deleteFeedback = useMutation(api.admin.stats.deleteFeedback);

  const handleDelete = async (feedbackId: unknown) => {
    if (confirm("Are you sure you want to delete this feedback entry?")) {
      try {
        await deleteFeedback({ feedbackId: feedbackId as any });
      } catch (error) {
        console.error("Failed to delete feedback:", error);
      }
    }
  };

  const filteredFeedback: FeedbackDoc[] = feedback
    ? ratingFilter === "all"
      ? (feedback as FeedbackDoc[])
      : (feedback as FeedbackDoc[]).filter((f) => f.rating === ratingFilter)
    : [];

  const positiveCount = feedback
    ? (feedback as FeedbackDoc[]).filter((f) => f.rating === "thumbsUp").length
    : 0;
  const negativeCount = feedback
    ? (feedback as FeedbackDoc[]).filter((f) => f.rating === "thumbsDown").length
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {feedback !== undefined ? feedback.length : <Skeleton className="h-8 w-16" />}
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-500 flex items-center gap-2">
              <ThumbsUp className="h-4 w-4" />
              Positive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {feedback !== undefined ? positiveCount : <Skeleton className="h-8 w-16" />}
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-500 flex items-center gap-2">
              <ThumbsDown className="h-4 w-4" />
              Negative
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {feedback !== undefined ? negativeCount : <Skeleton className="h-8 w-16" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Feedback</SelectItem>
            <SelectItem value="thumbsUp">Positive</SelectItem>
            <SelectItem value="thumbsDown">Negative</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Feedback List */}
      {!feedback ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredFeedback.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              {ratingFilter !== "all" ? "No feedback matches your filter" : "No feedback yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-400px)]">
          <div className="space-y-2">
            {filteredFeedback.map((fb) => (
              <Card key={String(fb._id)}>
                <CardContent className="flex items-start justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {fb.rating === "thumbsUp" ? (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 text-green-500 border-green-500/20"
                        >
                          <ThumbsUp className="h-3 w-3" />
                          Positive
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 text-red-500 border-red-500/20"
                        >
                          <ThumbsDown className="h-3 w-3" />
                          Negative
                        </Badge>
                      )}
                      {fb.category && (
                        <Badge variant="secondary" className="text-xs">
                          {String(fb.category)}
                        </Badge>
                      )}
                    </div>
                    {fb.comment && (
                      <p className="text-sm text-muted-foreground mt-2">{String(fb.comment)}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Submitted {new Date(Number(fb.createdAt)).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 ml-4 shrink-0"
                    onClick={() => handleDelete(fb._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
