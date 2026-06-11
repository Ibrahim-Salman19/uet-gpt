"use client";

import { useUser } from "@clerk/nextjs";
import { Bot, User } from "lucide-react";
import * as React from "react";
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

function Avatar({ isUser, initials }: { isUser: boolean; initials: string }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center shrink-0 rounded-[10px] transition-all duration-300 shadow-sm select-none border font-semibold text-xs tracking-wider font-sans",
        isUser
          ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]/30"
          : "bg-zinc-950/80 text-[var(--accent)] border-white/5",
      )}
    >
      {isUser ? (
        initials
      ) : (
        <span className="text-[10px] uppercase font-bold text-[var(--accent)]">UG</span>
      )}
    </div>
  );
}

function useScrambleText(message: ChatMessage, isLatest: boolean, isUser: boolean): string {
  const { typingAnimEnabled, typingSoundEnabled, playTypingSound } = usePreferences();
  const [scrambleContent, setScrambleContent] = React.useState(message.content);
  const hasScrambledRef = React.useRef(false);

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

  return scrambleContent;
}

function useTypingSound(message: ChatMessage, typingSoundEnabled: boolean): void {
  const { playTypingSound } = usePreferences();

  React.useEffect(() => {
    if (message.id === "streaming-message" && typingSoundEnabled) {
      playTypingSound();
    }
  }, [message.content, message.id, typingSoundEnabled, playTypingSound]);
}

export const ChatMessageBubble = React.memo(function ChatMessageBubble({
  message,
  onFeedback,
  isLatest = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const { user } = useUser();
  const { typingAnimEnabled, typingSoundEnabled } = usePreferences();

  const initials = user
    ? `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase()
    : "";
  const fallbackInitials = initials || "U";

  const scrambleContent = useScrambleText(message, isLatest, isUser);
  useTypingSound(message, typingSoundEnabled);

  return (
    <div
      className="flex items-start gap-3 lg:gap-5 px-3 py-3.5 md:px-5 md:py-4 lg:px-8 lg:py-5 xl:px-10 w-full border-b border-white/[0.02] last:border-b-0"
      id={message.id}
    >
      <Avatar isUser={isUser} initials={fallbackInitials} />

      <div className="group flex flex-1 flex-col gap-1 items-start min-w-0">
        <div className="flex items-center gap-2 font-mono text-[9px] tracking-widest text-zinc-500 uppercase select-none mb-1">
          <span className={cn(isUser ? "text-zinc-400" : "text-[var(--accent)] font-semibold")}>
            {isUser ? "USER" : "UETGPT // RESPONSE"}
          </span>
          <span className="opacity-40">//</span>
          <span>{isUser ? "SYNC_OK" : "STREAM_LIVE"}</span>
        </div>

        <div
          className={cn(
            "w-full text-zinc-100 leading-relaxed font-sans text-[var(--chat-font-size,0.925rem)] md:text-[var(--chat-font-size,0.875rem)]",
            isUser
              ? "bg-[#101012] border border-white/[0.04] rounded-xl px-4 py-3 md:px-5 md:py-3.5 shadow-sm"
              : "px-0 py-1",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <Markdown content={scrambleContent} />
          )}
        </div>

        {message.sources && message.sources.length > 0 && <SourceList sources={message.sources} />}

        <div className="flex items-center gap-3 mt-2">
          <MessageActions
            content={message.content}
            role={message.role}
            onFeedback={(type) => onFeedback?.(type)}
          />

          {message.tokenCount && (
            <span className="text-[9px] text-[var(--text-disabled)] font-mono opacity-50 tracking-wider">
              [{message.tokenCount.total} TOKENS]
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
