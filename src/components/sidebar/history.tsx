"use client";

import { History, MessageSquare, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ChatItem {
  id: string;
  title: string;
}

interface SidebarHistoryProps {
  chats: ChatItem[];
  onDelete: (e: React.MouseEvent, id: string) => void;
}

export function SidebarHistory({ chats, onDelete }: SidebarHistoryProps) {
  const pathname = usePathname();

  return (
    <div className="flex-1 px-2 py-2">
      <div className="flex items-center justify-between px-2 py-1.5">
        <div className="flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <span className="text-xs font-medium tracking-wide uppercase text-[var(--text-muted)]">
            Recent Chats
          </span>
        </div>
      </div>
      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="mt-1 space-y-0.5">
          {chats.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">
              No conversations yet
            </p>
          ) : (
            chats.map((chat) => {
              const isActive = pathname === `/chat/${chat.id}`;
              return (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-quart)]",
                    isActive
                      ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "text-[var(--text-sidebar)] hover:bg-white/5",
                  )}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  <span className="flex-1 truncate text-left leading-snug">{chat.title}</span>
                  <button
                    type="button"
                    onClick={(e) => onDelete(e, chat.id)}
                    className="opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-60 hover:!opacity-100"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                  </button>
                </Link>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
