import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useStableQuery } from "@/hooks/use-stable-query";
import { api } from "../../convex/_generated/api";

interface ThreadItem {
  _id: string;
  title: string;
  _creationTime: number;
}

export function useThreads() {
  const threadsData = useStableQuery(api.threads.list, {});
  const createMutation = useMutation(api.threads.create);
  const renameMutation = useMutation(api.threads.rename);
  const deleteMutation = useMutation(api.threads.remove);

  const [error, setError] = useState<string | null>(null);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  const isLoading = threadsData === undefined;

  // Timeout: if threads don't load in 8s, show error state
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setLoadingTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Map and sort the Convex threads
  const threads: ThreadItem[] = (threadsData ?? [])
    .map((t: any) => ({
      _id: t._id,
      title: t.title ?? "New Chat",
      _creationTime: t._creationTime,
    }))
    .sort((a: any, b: any) => b._creationTime - a._creationTime);

  const handleCreate = useCallback(async () => {
    try {
      setError(null);
      const threadId = await createMutation({ title: "New Chat" });
      return threadId;
    } catch (err) {
      setError("Failed to create conversation");
      toast.error("Failed to create conversation");
      console.error("Failed to create thread:", err);
      return null;
    }
  }, [createMutation]);

  const handleDelete = useCallback(
    async (threadId: string) => {
      try {
        await deleteMutation({ id: threadId });
      } catch (err) {
        toast.error("Failed to delete conversation");
        console.error("Failed to delete thread:", err);
      }
    },
    [deleteMutation],
  );

  const handleRename = useCallback(
    async (threadId: string, title: string) => {
      if (!title.trim()) return;
      try {
        await renameMutation({ id: threadId, title });
      } catch (err) {
        toast.error("Failed to rename conversation");
        console.error("Failed to rename thread:", err);
      }
    },
    [renameMutation],
  );

  return {
    threads,
    isLoading: isLoading && !loadingTimedOut,
    error: error || (loadingTimedOut ? "Unable to load conversations" : null),
    createThread: handleCreate,
    deleteThread: handleDelete,
    renameThread: handleRename,
  };
}
