"use client";

import * as React from "react";
import { usePreferences } from "@/components/preferences-provider";
import { cn } from "@/lib/utils";

interface ChatInputNewProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  className?: string;
}

function SendButton({
  isLoading,
  onStop,
  canSend,
  onSubmit,
}: {
  isLoading?: boolean;
  onStop?: () => void;
  canSend: boolean;
  onSubmit: (e?: React.FormEvent) => void;
}) {
  if (isLoading && onStop) {
    return (
      <button
        type="button"
        onClick={onStop}
        className="shrink-0 w-10 h-10 rounded-[10px] bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 active:scale-95 transition-all duration-300 hover:bg-red-500/20 mb-0.5 mr-0.5 animate-pulse"
        aria-label="Stop generating"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      </button>
    );
  }
  return (
    <button
      type="submit"
      disabled={!canSend}
      className={cn(
        "shrink-0 w-10 h-10 rounded-[10px] flex items-center justify-center border active:scale-[0.98] active:translate-y-[1px] transition-all duration-300 ease-[var(--ease-spring)] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none mb-0.5 mr-0.5",
        canSend
          ? "bg-[var(--accent)] border-[var(--accent)]/50 text-[var(--accent-fg)] hover:opacity-90"
          : "bg-white/5 border-white/10 text-zinc-500",
      )}
      aria-label="Send query"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    </button>
  );
}

export function ChatInputNew({ onSend, onStop, isLoading, className }: ChatInputNewProps) {
  const [input, setInput] = React.useState("");
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const { playTypingSound, playChimeSound, setVoiceTranscriptCallback, setVoiceInputOpen } =
    usePreferences();
  const lastTypingSoundTime = React.useRef(0);

  // Register as the voice transcript receiver
  React.useEffect(() => {
    const receiveVoiceText = (text: string) => {
      setInput(text);
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.style.height = "auto";
          inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 144)}px`;
          inputRef.current.focus();
        }
      });
    };
    setVoiceTranscriptCallback(receiveVoiceText);
    return () => setVoiceTranscriptCallback(null);
  }, [setVoiceTranscriptCallback]);

  const handleSubmit = React.useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;
      playChimeSound();
      onSend(trimmed);
      setInput("");
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
    },
    [input, isLoading, onSend, playChimeSound],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (isLoading && onStop) {
          onStop();
        } else {
          handleSubmit();
        }
      }
    },
    [handleSubmit, isLoading, onStop],
  );

  const handleInput = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const now = Date.now();
      if (now - lastTypingSoundTime.current > 80) {
        lastTypingSoundTime.current = now;
        playTypingSound();
      }
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
    },
    [playTypingSound],
  );

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "bg-zinc-950/80 backdrop-blur-xl border-t border-[#1d1d21] p-4 md:p-5 relative z-20 flex flex-col gap-3",
        className,
      )}
    >
      <label htmlFor="chat-input-field" className="sr-only">
        Ask a question about UET Taxila admissions, fees, or departments
      </label>

      <div className="flex w-full items-end gap-2 rounded-2xl bg-[#0a0a0c]/80 p-1.5 border border-white/10 hover:border-white/20 focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-500/20 focus-within:bg-[#0a0a0c] transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
        {/* Multimodal Actions (Left) */}
        <div className="flex items-center gap-1 mb-0.5 ml-1 shrink-0">
          <button
            type="button"
            onClick={() => setVoiceInputOpen(true)}
            className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-white/5 rounded-xl transition-all duration-300 ease-[var(--ease-spring)] active:scale-[0.98] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none"
            aria-label="Voice input"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
        </div>

        {/* Textarea (Center) */}
        <div className="flex-1 flex flex-col min-w-0">
          <textarea
            id="chat-input-field"
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about UET Taxila…"
            rows={1}
            disabled={isLoading && !onStop}
            className="w-full resize-none bg-transparent px-3 py-3 text-[13px] text-zinc-100 placeholder:text-zinc-500 outline-none max-h-36 custom-scroll font-sans leading-relaxed disabled:opacity-50"
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        <SendButton
          isLoading={isLoading}
          onStop={onStop}
          canSend={canSend}
          onSubmit={handleSubmit}
        />
      </div>

      {/* Telemetry footer */}
      <div
        className="flex justify-between items-center px-2 text-[9px] font-mono text-zinc-600 select-none"
        aria-hidden="true"
      >
        <span>UET GPT may produce inaccurate information. Verify critical details.</span>
        <span
          className={cn(
            "transition-colors",
            isLoading ? "text-[var(--accent)]/60 animate-pulse" : "text-zinc-700",
          )}
        >
          {isLoading ? "GENERATING…" : "IDLE"}
        </span>
      </div>
    </form>
  );
}
