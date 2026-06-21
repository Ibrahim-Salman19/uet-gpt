"use client";

import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const creatingRef = useRef(false);

  const handleSend = useCallback(
    async (message: string) => {
      if (creatingRef.current) return;
      creatingRef.current = true;
      setIsCreating(true);
      try {
        const threadId = await createThread({ title: "New Chat" });
        if (threadId) {
          router.push(`/chat/${threadId}?q=${encodeURIComponent(message)}`);
        } else {
          creatingRef.current = false;
          setIsCreating(false);
          toast.error("Failed to start conversation. Please try again.");
        }
      } catch {
        creatingRef.current = false;
        setIsCreating(false);
        toast.error("Failed to start conversation. Please try again.");
      } finally {
        timeoutRef.current = setTimeout(() => {
          creatingRef.current = false;
          setIsCreating(false);
        }, 500);
      }
    },
    [createThread, router],
  );

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <GlassPortal>
      {/* ── Welcome content ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        {/* Logo mark */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-[var(--accent)]/8 border border-[var(--accent)]/15">
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
                r="3"
                fill="currentColor"
                fillOpacity="0.2"
                className="animate-[pulse-dot_2s_ease-in-out_infinite]"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-[var(--text-primary)] font-sans">
              Ask me anything about UET Taxila
            </h1>
            <p className="text-sm md:text-base text-[var(--text-muted)] mt-2 font-sans leading-relaxed max-w-[65ch]">
              I can help with admissions, programs, campus life, faculty, departments, and more.
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
          <div
            className="w-full max-w-3xl flex flex-wrap justify-center gap-2.5 mt-2 stagger-enter"
            aria-label="Quick suggestions"
          >
            {DEFAULT_SUGGESTIONS.map((s, i) => (
              <button
                key={s.label}
                onClick={() => handleSend(s.prompt)}
                className="shrink-0 rounded-full border border-[var(--border)]/50 bg-[var(--surface-elevated)] px-4 py-2 md:px-5 md:py-2.5 text-[13px] md:text-sm font-medium text-[var(--text-secondary)] transition-all duration-300 ease-[var(--ease-spring)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--surface-hover)] active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none shadow-sm hover:shadow-[0_0_12px_rgba(212,168,74,0.15)] font-sans cursor-pointer whitespace-nowrap"
                aria-label={`Suggestion: ${s.label}`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span
                  className="opacity-40 font-mono text-[10px] mr-2 select-none hidden md:inline tracking-wider"
                  aria-hidden="true"
                >
                  0{i + 1}
                </span>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Chat Input ── */}
        <div className="relative z-20 w-full max-w-3xl pt-2">
          <ChatInputNew onSend={handleSend} isLoading={isCreating} flat />
        </div>
      </div>
    </GlassPortal>
  );
}
