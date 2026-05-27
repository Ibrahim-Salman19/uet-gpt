"use client";

import { useCallback, useState } from "react";
import { LoadingState } from "@/components/loading-state";
import { Separator } from "@/components/ui/separator";
import { useThreads } from "@/hooks/use-threads";
import { cn } from "@/lib/utils";
import { SidebarHeader } from "./header";
import { SidebarHistory } from "./history";
import { NewChatButton } from "./new-chat-button";
import { SidebarSearch } from "./search";

interface SidebarProps {
  className?: string;
}

interface ChatItem {
  id: string;
  title: string;
}

export function Sidebar({ className }: SidebarProps) {
  const { threads, isLoading, deleteThread, createThread } = useThreads();
  const [searchQuery, setSearchQuery] = useState("");

  // Map Convex thread data to the sidebar ChatItem format
  const chatItems: ChatItem[] = threads.map((t) => ({
    id: t._id,
    title: t.title ?? "New Chat",
  }));

  const filteredChats = searchQuery
    ? chatItems.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : chatItems;

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      deleteThread(id);
    },
    [deleteThread],
  );

  if (isLoading) {
    return (
      <aside
        className={cn(
          "flex w-72 flex-col border-r border-[var(--border)] bg-[var(--surface-sidebar)] text-[var(--text-sidebar)]",
          className,
        )}
      >
        <SidebarHeader />
        <LoadingState type="sidebar" />
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "flex w-72 flex-col border-r border-[var(--border)] bg-[var(--surface-sidebar)] text-[var(--text-sidebar)]",
        className,
      )}
    >
      <SidebarHeader />
      <NewChatButton onCreateThread={createThread} />
      <Separator className="bg-[var(--border)]" />
      <SidebarSearch value={searchQuery} onChange={setSearchQuery} />
      <SidebarHistory chats={filteredChats} onDelete={handleDelete} />
    </aside>
  );
}
