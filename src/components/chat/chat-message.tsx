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
        "flex h-8 w-8 items-center justify-center shrink-0 rounded-[10px] transition-transform duration-300 shadow-sm select-none border font-semibold text-[11px] tracking-widest font-mono",
        isUser
          ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]/30"
          : "bg-[var(--surface-elevated)] text-[var(--accent)] border-[var(--accent)]/10 shadow-inner",
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

  const playTypingSoundRef = React.useRef(playTypingSound);
  const typingSoundEnabledRef = React.useRef(typingSoundEnabled);

  React.useEffect(() => {
    playTypingSoundRef.current = playTypingSound;
  }, [playTypingSound]);

  React.useEffect(() => {
    typingSoundEnabledRef.current = typingSoundEnabled;
  }, [typingSoundEnabled]);

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

      if (iterations % 4 === 0 && typingSoundEnabledRef.current) {
        playTypingSoundRef.current();
      }

      if (iterations >= length) {
        clearInterval(interval);
        setScrambleContent(targetText);
      }
      iterations += Math.max(2, Math.floor(length / 40));
    }, 12);

    return () => clearInterval(interval);
  }, [message.content, isUser, message.id, isLatest, typingAnimEnabled]);

  return scrambleContent;
}

export const ChatMessageBubble = React.memo(function ChatMessageBubble({
  message,
  onFeedback,
  isLatest = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const { user } = useUser();
  const { typingAnimEnabled } = usePreferences();

  const initials = user
    ? `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase()
    : "";
  const fallbackInitials = initials || "U";

  const scrambleContent = useScrambleText(message, isLatest, isUser);

  return (
    <div
      className={cn(
        "flex items-start gap-4 lg:gap-6 px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-7 xl:px-10 w-full transition-colors duration-200",
        isUser ? "bg-transparent" : "bg-[var(--surface-base)]/20",
      )}
      id={message.id}
    >
      <Avatar isUser={isUser} initials={fallbackInitials} />

      <div className="group flex flex-1 flex-col gap-2 items-start min-w-0">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.15em] text-zinc-500 uppercase select-none mb-0.5">
          <span className={cn(isUser ? "text-zinc-400" : "text-[var(--accent)] font-medium")}>
            {isUser ? "USER" : "UETGPT // RESPONSE"}
          </span>
          <span className="opacity-30">//</span>
          <span className="opacity-70">{isUser ? "SYNC_OK" : "STREAM_LIVE"}</span>
        </div>

        <div
          className={cn(
            "w-full text-zinc-100 leading-relaxed font-sans text-[15px] md:text-base",
            isUser
              ? "bg-[var(--surface-elevated)] border border-[var(--border)]/40 rounded-[14px] px-5 py-4 shadow-sm"
              : "px-0 py-1",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <Markdown content={scrambleContent} />
          )}
        </div>

        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 w-full">
            <SourceList sources={message.sources} />
          </div>
        )}

        <div className="flex items-center gap-4 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <MessageActions content={message.content} role={message.role} onFeedback={onFeedback} />

          {message.tokenCount && (
            <span className="text-[10px] text-zinc-600 font-mono tracking-wider">
              [{message.tokenCount.total} TOKENS]
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
