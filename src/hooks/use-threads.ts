"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";

interface ThreadItem {
  _id: string;
  title: string;
  _creationTime: number;
}

export function useThreads() {
  const threadsData = useQuery(api.threads.list, {});
  const createMutation = useMutation(api.threads.create);
  // rename is not in generated api types, so we use a minimal cast
  const renameMutation = useMutation((api.threads as any).rename);
  const deleteMutation = useMutation(api.threads.remove);

  const isLoading = threadsData === undefined;

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
      const threadId = await createMutation({ title: "New Chat" });
      return threadId;
    } catch (error) {
      console.error("Failed to create thread:", error);
      return null;
    }
  }, [createMutation]);

  const handleDelete = useCallback(
    async (threadId: string) => {
      try {
        await deleteMutation({ id: threadId });
      } catch (error) {
        console.error("Failed to delete thread:", error);
      }
    },
    [deleteMutation],
  );

  const handleRename = useCallback(
    async (threadId: string, title: string) => {
      if (!title.trim()) return;
      try {
        await renameMutation({ id: threadId, title });
      } catch (error) {
        console.error("Failed to rename thread:", error);
      }
    },
    [renameMutation],
  );

  return {
    threads,
    isLoading,
    createThread: handleCreate,
    deleteThread: handleDelete,
    renameThread: handleRename,
  };
}
