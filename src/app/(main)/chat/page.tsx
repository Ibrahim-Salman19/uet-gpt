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
      {/* ── Welcome content: left-aligned, asymmetric (Rule 3: Anti-Center Bias) ── */}
      <div className="relative z-10 flex-1 flex flex-col items-start justify-center gap-4 px-6 py-10 max-w-4xl mx-auto w-full">
        {/* Logo mark - left aligned, compact */}
        <div className="flex items-center gap-3 w-full">
          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 shrink-0">
            <svg
              className="w-5 h-5 text-[var(--accent)]"
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
                r="2"
                fill="currentColor"
                fillOpacity="0.2"
                className="animate-[pulse-dot_2s_ease-in-out_infinite]"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tighter leading-none text-[var(--text-primary)] font-sans">
              UETGPT Admissions Advisor
            </h1>
            <p className="text-base text-[var(--text-muted)] mt-2 font-sans leading-relaxed max-w-[65ch]">
              Ask anything about UET Taxila — admissions, fees, departments, hostels, and more.
            </p>
          </div>
        </div>

        {isCreating && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] font-sans animate-pulse">
            <div className="w-3 h-3 rounded-full border-2 border-[var(--accent)]/30 border-t-[var(--accent)] animate-spin" />
            Starting your conversation…
          </div>
        )}

        {/* ── Suggestion Chips ── */}
        {!isCreating && (
          <div className="w-full pt-4 border-t border-[var(--border)] flex flex-wrap gap-2" aria-label="Quick suggestions">
            {DEFAULT_SUGGESTIONS.map((s, i) => (
              <button
                key={s.label}
                onClick={() => handleSend(s.prompt)}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-card)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition-all duration-200 ease-[var(--ease-spring)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--surface-hover)] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none shadow-[var(--shadow-sm)] font-sans cursor-pointer min-h-[44px] min-w-[44px]"
                aria-label={`Suggestion: ${s.label}`}
              >
                <span className="opacity-40 font-mono text-[10px] mr-2 select-none" aria-hidden="true">
                  [{i + 1}]
                </span>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Chat Input ── */}
        <div className="relative z-20 w-full pt-4 border-t border-[var(--border)]">
          <ChatInputNew onSend={handleSend} isLoading={isCreating} />
        </div>
      </div>
    </GlassPortal>
  );
}
