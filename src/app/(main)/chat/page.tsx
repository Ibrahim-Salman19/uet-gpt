"use client";

import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ChatInputNew } from "@/components/chat/chat-input-new";
import { GlassPortal } from "@/components/chat/glass-portal";
import { usePreferences } from "@/components/preferences-provider";

const DEFAULT_SUGGESTIONS = [
  { label: "BS Fee Structure", prompt: "What is the fee structure for BS programs?" },
  { label: "2026 Admissions", prompt: "When do admissions open for 2026?" },
  { label: "Departments", prompt: "How many departments does UET have?" },
  { label: "Hostel Allotment", prompt: "Explain the hostel allotment process." },
];

export default function ChatPage() {
  const router = useRouter();
  const createThread = useMutation(api.threads.create);
  const [isCreating, setIsCreating] = useState(false);

  const handleSend = useCallback(
    async (message: string) => {
      if (isCreating) return;
      setIsCreating(true);
      try {
        const threadId = await createThread({ title: "New Chat" });
        if (threadId) {
          // Brief delay to allow Convex mutation to propagate
          // This prevents the thread page from loading with undefined data
          await new Promise((resolve) => setTimeout(resolve, 150));
          router.push(`/chat/${threadId}?q=${encodeURIComponent(message)}`);
        } else {
          setIsCreating(false);
          toast.error("Failed to start conversation. Please try again.");
        }
      } catch {
        setIsCreating(false);
        toast.error("Failed to start conversation. Please try again.");
      }
    },
    [createThread, isCreating, router],
  );

  return (
    <GlassPortal>
      {/* ── Welcome content ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        {/* Logo mark */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20">
            <svg
              className="w-6 h-6 text-[var(--accent)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 2v20M2 12h20" strokeDasharray="2 2" />
              <circle cx="12" cy="12" r="8" strokeDasharray="4 2" />
              <circle
                cx="12"
                cy="12"
                r="2.5"
                fill="currentColor"
                fillOpacity="0.2"
                className="animate-[pulse-dot_2s_ease-in-out_infinite]"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 font-sans tracking-tight">
              UETGPT Admissions Advisor
            </h2>
            <p className="text-xs text-zinc-400 mt-1 font-sans max-w-xs leading-relaxed">
              Ask anything about UET Taxila — admissions, fees, departments, hostels, and more.
            </p>
          </div>
        </div>

        {isCreating && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-sans animate-pulse">
            <div className="w-3 h-3 rounded-full border-2 border-[var(--accent)]/30 border-t-[var(--accent)] animate-spin" />
            Starting your conversation…
          </div>
        )}
      </div>

      {/* ── Suggestion Chips ── */}
      {!isCreating && (
        <div className="relative z-10 px-4 md:px-6 py-3 border-t border-white/5 bg-zinc-950/50 backdrop-blur-md">
          <div className="flex flex-wrap gap-2" aria-label="Quick suggestions">
            {DEFAULT_SUGGESTIONS.map((s, i) => (
              <button
                key={s.label}
                onClick={() => handleSend(s.prompt)}
                className="rounded-[var(--radius-md)] border border-white/5 bg-white/5 px-4 py-2 text-[11px] text-zinc-400 transition-all duration-200 hover:border-zinc-300 hover:text-white hover:bg-white/10 active:scale-95 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none shadow-sm font-sans cursor-pointer"
              >
                <span
                  className="opacity-40 font-mono text-[9px] mr-2 select-none"
                  aria-hidden="true"
                >
                  [{i + 1}]
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat Input ── */}
      <div className="relative z-20">
        <ChatInputNew onSend={handleSend} isLoading={isCreating} />
      </div>
    </GlassPortal>
  );
}
