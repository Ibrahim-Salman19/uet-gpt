"use client";

import { useCallback, useState } from "react";

interface ThreadItem {
  _id: string;
  title: string;
  _creationTime: number;
}

const initialThreads: ThreadItem[] = [
  { _id: "1", title: "How do I apply for admission?", _creationTime: Date.now() - 3600000 },
  {
    _id: "2",
    title: "What programs are offered at UET Taxila?",
    _creationTime: Date.now() - 7200000,
  },
  { _id: "3", title: "Campus facilities and hostels", _creationTime: Date.now() - 10800000 },
];

export function useThreads() {
  const [threads, setThreads] = useState<ThreadItem[]>(initialThreads);
  const [isLoading, _setIsLoading] = useState(false);

  const sortedThreads = [...threads].sort((a, b) => b._creationTime - a._creationTime);

  const handleCreate = useCallback(async () => {
    try {
      const newId = crypto.randomUUID();
      setThreads((prev) => [{ _id: newId, title: "New Chat", _creationTime: Date.now() }, ...prev]);
      return newId;
    } catch {
      return null;
    }
  }, []);

  const handleDelete = useCallback(async (threadId: string) => {
    setThreads((prev) => prev.filter((t) => t._id !== threadId));
  }, []);

  const handleRename = useCallback(async (threadId: string, title: string) => {
    setThreads((prev) => prev.map((t) => (t._id === threadId ? { ...t, title } : t)));
  }, []);

  return {
    threads: sortedThreads,
    isLoading,
    createThread: handleCreate,
    deleteThread: handleDelete,
    renameThread: handleRename,
  };
}
