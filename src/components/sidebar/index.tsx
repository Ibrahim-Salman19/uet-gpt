"use client";

import { useUser } from "@clerk/nextjs";
import { AlertCircle, Bookmark, Settings, User, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { LoadingState } from "@/components/loading-state";
import { usePreferences } from "@/components/preferences-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useThreads } from "@/hooks/use-threads";
import { copyToClipboard } from "@/lib/utils";
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
            className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-all duration-200"
          >
            <Bookmark className="h-3 w-3 shrink-0 text-[var(--accent)] opacity-70 group-hover:opacity-100" />
            <button
              type="button"
              className="flex-1 truncate text-left cursor-pointer font-sans"
              onClick={async () => {
                try {
                  const success = await copyToClipboard(pin.content);
                  if (success) {
                    toast.success("Copied to clipboard!");
                  } else {
                    toast.error("Failed to copy");
                  }
                } catch {
                  toast.error("Failed to copy");
                }
              }}
              title={pin.content}
            >
              {pin.query || pin.content}
            </button>
            <button
              onClick={() => onRemove(pin.id)}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5"
              aria-label="Remove pin"
            >
              <X className="h-3 w-3 text-[var(--text-muted)] hover:text-[var(--destructive)]" />
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
      <div className="text-[9px] font-mono text-[var(--text-secondary)] tracking-wider mb-3 mt-1 px-3 uppercase select-none">
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
      <AlertCircle className="w-8 h-8 text-[var(--destructive)]/80 mb-2" aria-hidden="true" />
      <span className="text-xs text-[var(--text-secondary)] font-medium">{message}</span>
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
    <div className="p-3 border-t border-[var(--surface-5)] flex items-center justify-between gap-2 shrink-0 bg-[var(--surface-1)]/60">
      <div className="flex items-center gap-3 min-w-0">
        {user?.imageUrl ? (
          <Image
            src={user.imageUrl}
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
            sizes="32px"
            className="h-8 w-8 rounded-full border border-[var(--accent)]/20 object-cover shrink-0"
          />
        ) : (
          <div
            aria-hidden="true"
            className="h-8 w-8 rounded-full bg-[var(--surface-3)] border border-[var(--surface-5)] flex items-center justify-center shrink-0"
          >
            <User className="w-4 h-4 text-[var(--text-secondary)]" aria-hidden="true" />
          </div>
        )}
        <button
          onClick={onOpenSettings}
          className="text-left min-w-0 hover:opacity-80 transition-opacity"
          aria-label="Open Preferences"
        >
          <div className="text-[13px] font-medium text-[var(--text-primary)] truncate select-none">
            {user?.fullName || user?.primaryEmailAddress?.emailAddress || "Guest User"}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] font-mono truncate hover:text-[var(--text-primary)] select-none">
            Preferences
          </div>
        </button>
      </div>
      <button
        onClick={onOpenSettings}
        className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/5 rounded-lg transition-all active:scale-95 shrink-0"
        aria-label="Open Settings"
      >
        <Settings className="w-4 h-4 transition-colors" aria-hidden="true" />
      </button>
    </div>
  );
}

export function Sidebar({ className }: SidebarProps) {
  const { threads, isLoading, error, deleteThread, createThread } = useThreads();
  const { query, debouncedQuery, setQuery } = useSidebarSearch();
  const { pinnedHighlights, removePin, setSettingsOpen } = usePreferences();
  const { user } = useUser();

  const chatItems: ChatItem[] = useMemo(
    () =>
      threads.map((t) => ({
        id: t._id,
        title: t.title ?? "New Chat",
      })),
    [threads],
  );

  const filteredChats = useMemo(
    () =>
      debouncedQuery
        ? chatItems.filter((c) => c.title.toLowerCase().includes(debouncedQuery.toLowerCase()))
        : chatItems,
    [chatItems, debouncedQuery],
  );

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
