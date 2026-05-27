"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";

function q<Args extends Record<string, any> = any>(
  ref: unknown,
): FunctionReference<"query", "public", Args> {
  return ref as FunctionReference<"query", "public", Args>;
}
function m<Args extends Record<string, any> = any>(
  ref: unknown,
): FunctionReference<"mutation", "public", Args> {
  return ref as FunctionReference<"mutation", "public", Args>;
}

/**
 * Hook for admin dashboard data.
 * Wraps Convex queries for stats, crawl management, and admin actions.
 */
export function useAdminStats() {
  const stats = useQuery(api.admin.stats.dashboardStats, {});

  return {
    stats,
    isLoading: stats === undefined,
  };
}

/**
 * Hook for admin crawl management actions.
 */
export function useAdminCrawl() {
  const crawlJobs = useQuery(q(api.crawl.list), {});
  const triggerCrawl = useMutation(m(api.crawl.trigger));

  const handleTriggerCrawl = useCallback(
    async (config?: Record<string, unknown>) => {
      try {
        await triggerCrawl(config ?? {});
      } catch (error) {
        console.error("Failed to trigger crawl:", error);
        throw error;
      }
    },
    [triggerCrawl],
  );

  return {
    crawlJobs,
    isLoading: crawlJobs === undefined,
    triggerCrawl: handleTriggerCrawl,
  };
}

/**
 * Hook for admin document management.
 */
export function useAdminDocuments() {
  const documents = useQuery(q(api.doc.list), {});
  const deleteDocument = useMutation(m(api.admin.stats.deleteDocument));

  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      try {
        await deleteDocument({ documentId: documentId as any });
      } catch (error) {
        console.error("Failed to delete document:", error);
        throw error;
      }
    },
    [deleteDocument],
  );

  return {
    documents,
    isLoading: documents === undefined,
    deleteDocument: handleDeleteDocument,
  };
}

/**
 * Hook for admin feedback management.
 */
export function useAdminFeedback() {
  const feedbackList = useQuery(q(api.feedback.list), {});
  const deleteFeedback = useMutation(m(api.admin.stats.deleteFeedback));

  const handleDismissFeedback = useCallback(
    async (feedbackId: string) => {
      try {
        await deleteFeedback({ feedbackId: feedbackId as any });
      } catch (error) {
        console.error("Failed to dismiss feedback:", error);
        throw error;
      }
    },
    [deleteFeedback],
  );

  return {
    feedbackList,
    isLoading: feedbackList === undefined,
    dismissFeedback: handleDismissFeedback,
  };
}
