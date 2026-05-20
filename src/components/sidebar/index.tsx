"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
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

const mockChats: ChatItem[] = [
  { id: "1", title: "How do I apply for admission?" },
  { id: "2", title: "What programs are offered at UET Taxila?" },
  { id: "3", title: "Campus facilities and hostels" },
];

export function Sidebar({ className }: SidebarProps) {
  const [chats, setChats] = useState<ChatItem[]>(mockChats);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChats = searchQuery
    ? chats.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : chats;

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setChats((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <aside
      className={cn(
        "flex w-72 flex-col border-r border-[var(--border)] bg-[var(--surface-sidebar)] text-[var(--text-sidebar)]",
        className,
      )}
    >
      <SidebarHeader />
      <NewChatButton />
      <Separator className="bg-[var(--border)]" />
      <SidebarSearch value={searchQuery} onChange={setSearchQuery} />
      <SidebarHistory chats={filteredChats} onDelete={handleDelete} />
    </aside>
  );
}
