"use client";

import { useUser } from "@clerk/nextjs";
import { Bookmark, X } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { LoadingState } from "@/components/loading-state";
import { usePreferences } from "@/components/preferences-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useThreads } from "@/hooks/use-threads";
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

import { useDebounce } from "@/hooks/use-debounce";

// ── Sidebar Search Hook ──

function useSidebarSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const debounceSearch = useDebounce((val: string) => {
    setDebouncedQuery(val);
  }, 200);

  const handleChange = (val: string) => {
    setQuery(val);
    debounceSearch(val);
  };

  return { query, debouncedQuery, setQuery: handleChange };
}

// ── Pinned Highlights Section ──

function PinnedSection({
  pins,
  onRemove,
}: {
  pins: { id: string; content: string; query?: string }[];
  onRemove: (id: string) => void;
}) {
  if (pins.length === 0) return null;

  return (
    <div className="mt-6 border-t border-white/5 pt-4 px-2">
      <div className="flex items-center gap-2 mb-2 text-[10px] font-mono tracking-wider uppercase text-[var(--accent)] select-none">
        <Bookmark className="h-3 w-3 shrink-0" />
        <span>Pinned Highlights</span>
      </div>
      <div className="space-y-1">
        {pins.map((pin) => (
          <div
            key={pin.id}
            className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-all duration-200"
          >
            <Bookmark className="h-3 w-3 shrink-0 text-[var(--accent)] opacity-70 group-hover:opacity-100" />
            <span
              className="flex-1 truncate cursor-pointer font-sans"
              onClick={() => {
                navigator.clipboard.writeText(pin.content);
                toast.success("Copied to clipboard!");
              }}
              title={pin.content}
            >
              {pin.query || pin.content}
            </span>
            <button
              onClick={() => onRemove(pin.id)}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5"
              aria-label="Remove pin"
            >
              <X className="h-3 w-3 text-zinc-500 hover:text-red-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── History Section ──

function HistorySection({
  chats,
  onDelete,
}: {
  chats: ChatItem[];
  onDelete: (e: React.MouseEvent, id: string) => void;
}) {
  return (
    <>
      <div className="text-[9px] font-mono text-zinc-400 tracking-wider mb-3 mt-1 px-3 uppercase select-none">
        Recent
      </div>
      <SidebarHistory chats={chats} onDelete={onDelete} />
    </>
  );
}

// ── Error State ──

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden items-center justify-center p-4 text-center">
      <svg
        className="w-8 h-8 text-red-500/80 mb-2"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span className="text-xs text-zinc-400 font-medium">{message}</span>
    </div>
  );
}

// ── User Profile Footer ──

function UserProfileFooter({
  user,
  onOpenSettings,
}: {
  user: {
    imageUrl?: string | null;
    fullName?: string | null;
    primaryEmailAddress?: { emailAddress: string } | null;
  } | null;
  onOpenSettings: () => void;
}) {
  return (
    <div className="p-3 border-t border-[#222226] flex items-center justify-between gap-2 shrink-0 bg-[#0a0a0c]/60">
      <div className="flex items-center gap-3 min-w-0">
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt="User profile"
            className="h-8 w-8 rounded-full border border-[var(--accent)]/20 object-cover shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={onOpenSettings}
          />
        ) : (
          <div
            className="h-8 w-8 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center shrink-0 cursor-pointer"
            onClick={onOpenSettings}
          >
            <svg
              className="w-4 h-4 text-zinc-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        )}
        <button
          onClick={onOpenSettings}
          className="text-left min-w-0 hover:opacity-80 transition-opacity"
          aria-label="Open Preferences"
        >
          <div className="text-[13px] font-medium text-zinc-200 truncate select-none">
            {user?.fullName || user?.primaryEmailAddress?.emailAddress || "Guest User"}
          </div>
          <div className="text-[10px] text-zinc-400 font-mono truncate hover:text-zinc-300 select-none">
            Preferences
          </div>
        </button>
      </div>
      <button
        onClick={onOpenSettings}
        className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-lg transition-all active:scale-95 shrink-0"
        aria-label="Open Settings"
      >
        <svg
          className="w-4 h-4 transition-colors"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}

export function Sidebar({ className }: SidebarProps) {
  const { threads, isLoading, error, deleteThread, createThread } = useThreads();
  const { query, debouncedQuery, setQuery } = useSidebarSearch();
  const { pinnedHighlights, removePin, setSettingsOpen } = usePreferences();
  const { user } = useUser();

  const chatItems: ChatItem[] = threads.map((t) => ({
    id: t._id,
    title: t.title ?? "New Chat",
  }));

  const filteredChats = debouncedQuery
    ? chatItems.filter((c) => c.title.toLowerCase().includes(debouncedQuery.toLowerCase()))
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
      <div className="flex-1 flex flex-col overflow-hidden">
        <LoadingState type="sidebar" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <NewChatButton onCreateThread={createThread} />

      <div className="px-3 py-2 border-t border-white/[0.04]">
        <SidebarSearch value={query} onChange={setQuery} />
      </div>

      <ScrollArea className="flex-1 px-2 py-2">
        <HistorySection chats={filteredChats} onDelete={handleDelete} />
        <PinnedSection pins={pinnedHighlights} onRemove={removePin} />
      </ScrollArea>

      <UserProfileFooter user={user || null} onOpenSettings={() => setSettingsOpen(true)} />
    </div>
  );
}
