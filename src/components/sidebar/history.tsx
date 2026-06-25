"use client";

import { History, MessageSquare, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo } from "react";
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

export const SidebarHistory = memo(function SidebarHistory({
  chats,
  onDelete,
}: SidebarHistoryProps) {
  const pathname = usePathname();

  return (
    <div className="space-y-0.5 px-2">
      {chats.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-[var(--text-muted)] font-medium">
          No conversations yet
        </p>
      ) : (
        chats.map((chat) => {
          const isActive = pathname === `/chat/${chat.id}`;
          return (
            <div
              key={chat.id}
              className={cn(
                "group flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-[13px] md:text-sm font-medium transition-all duration-300 ease-[var(--ease-spring)]",
                isActive
                  ? "bg-[var(--accent)]/10 text-[var(--accent)] shadow-[inset_0_1px_0_rgba(212,168,74,0.1)]"
                  : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]",
              )}
            >
              <Link
                href={`/chat/${chat.id}`}
                className="flex flex-1 items-center gap-2.5 min-w-0 py-0.5"
              >
                <MessageSquare
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-colors",
                    isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)]",
                  )}
                />
                <span className="flex-1 truncate text-left leading-snug">{chat.title}</span>
              </Link>
              <button
                type="button"
                onClick={(e) => onDelete(e, chat.id)}
                className="opacity-0 transition-all duration-200 group-hover:opacity-60 hover:!opacity-100 hover:text-[var(--destructive)] hover:scale-110 ml-2 p-0.5"
                aria-label="Delete chat"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
});
