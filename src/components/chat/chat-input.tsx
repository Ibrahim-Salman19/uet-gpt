"use client";

import { Send, Sparkles, StopCircle } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInput({
  onSend,
  onStop,
  isLoading,
  placeholder = "Ask a question about UET Taxila...",
  className,
}: ChatInputProps) {
  const [input, setInput] = React.useState("");
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSubmit = React.useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [input, isLoading, onSend]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleInput = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <div
      className={cn(
        "border-t border-[var(--border)] bg-[var(--surface-card)] px-4 py-3",
        className,
      )}
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={isLoading}
            className="w-full resize-none rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-base)] px-4 py-2.5 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] outline-none transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-quart)] hover:border-[var(--accent-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-muted)] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Chat input"
          />
          {!isLoading && (
            <Sparkles
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-disabled)] pointer-events-none"
              aria-hidden="true"
            />
          )}
        </div>

        {isLoading && onStop ? (
          <Button
            variant="destructive"
            size="icon"
            onClick={onStop}
            aria-label="Stop generating"
            className="shrink-0"
          >
            <StopCircle className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canSend}
            size="icon"
            aria-label="Send message"
            className={cn(
              "shrink-0 transition-all duration-[var(--duration-fast)]",
              !canSend && "opacity-50",
            )}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-[var(--text-disabled)]">
        UET GPT may produce inaccurate information. Verify critical details with official sources.
      </p>
    </div>
  );
}
