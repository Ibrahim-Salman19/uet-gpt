"use client";

import { Bot, User } from "lucide-react";
import * as React from "react";
import { useUser } from "@clerk/nextjs";
import { MessageActions } from "@/components/chat/message-actions";
import { SourceList } from "@/components/chat/source-list";
import { Markdown } from "@/components/markdown";
import { usePreferences } from "@/components/preferences-provider";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessage;
  onFeedback?: (rating: "thumbsUp" | "thumbsDown") => void;
  isLatest?: boolean;
}

export const ChatMessageBubble = React.memo(function ChatMessageBubble({
  message,
  onFeedback,
  isLatest = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const { user } = useUser();
  const { typingAnimEnabled, typingSoundEnabled, playTypingSound } = usePreferences();

  const initials = user
    ? `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase()
    : "";
  const fallbackInitials = initials || "U";

  const [scrambleContent, setScrambleContent] = React.useState(message.content);
  const hasScrambledRef = React.useRef(false);

  // Scramble text effect on completed message mount
  React.useEffect(() => {
    if (
      isUser ||
      message.id === "streaming-message" ||
      !isLatest ||
      !typingAnimEnabled ||
      hasScrambledRef.current
    ) {
      setScrambleContent(message.content);
      return;
    }

    hasScrambledRef.current = true;
    const targetText = message.content;
    const chars = "0101A,^^+A^`A #%&+?-=";
    let iterations = 0;
    const length = targetText.length;

    const interval = setInterval(() => {
      setScrambleContent(
        targetText
          .split("")
          .map((char, index) => {
            if (index < iterations) return targetText[index];
            if (char === " " || char === "\n") return char;
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join(""),
      );

      if (iterations % 4 === 0 && typingSoundEnabled) {
        playTypingSound();
      }

      if (iterations >= length) {
        clearInterval(interval);
        setScrambleContent(targetText);
      }
      iterations += Math.max(2, Math.floor(length / 40));
    }, 12);

    return () => clearInterval(interval);
  }, [
    message.content,
    isUser,
    message.id,
    isLatest,
    typingAnimEnabled,
    typingSoundEnabled,
    playTypingSound,
  ]);

  // Audio typing sound trigger on message stream content changes
  React.useEffect(() => {
    if (message.id === "streaming-message" && typingSoundEnabled) {
      playTypingSound();
    }
  }, [message.content, message.id, typingSoundEnabled, playTypingSound]);

  return (
    <div className="flex items-start gap-4 px-4 py-4 w-full max-w-4xl mx-auto" id={message.id}>
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center shrink-0 rounded-[10px] transition-all duration-300 shadow-sm select-none border font-semibold text-xs tracking-wider font-sans",
          isUser
            ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]/30"
            : "bg-zinc-950/80 text-[var(--accent)] border-white/5",
        )}
      >
        {isUser ? (
          fallbackInitials
        ) : (
          <span className="text-[10px] uppercase font-bold text-[var(--accent)]">UG</span>
        )}
      </div>

      <div className="group flex flex-1 flex-col gap-1.5 items-start min-w-0">
        <div
          className={cn(
            "rounded-[var(--radius-lg)] px-4 py-2.5 transition-all duration-300 shadow-md",
            isUser
              ? "bg-[var(--accent)]/15 border border-[var(--accent)]/25 text-zinc-100 backdrop-blur-md"
              : "bg-zinc-900/40 border border-white/5 text-zinc-100 backdrop-blur-md",
          )}
        >
          {isUser ? (
            <p className="text-[var(--chat-font-size,0.875rem)] leading-relaxed">{message.content}</p>
          ) : (
            <Markdown content={scrambleContent} />
          )}
        </div>

        {message.sources && message.sources.length > 0 && <SourceList sources={message.sources} />}

        <div className="flex items-center gap-2">
          <MessageActions
            content={message.content}
            role={message.role}
            onFeedback={(type) => onFeedback?.(type)}
          />

          {message.tokenCount && (
            <span className="text-[10px] text-[var(--text-disabled)]">
              {message.tokenCount.total} tokens
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
