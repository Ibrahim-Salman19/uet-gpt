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

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Drives the one-shot "typewriter" scramble for the freshly-settled assistant
 * message. Returns both the (plain-text) animation frame and a flag indicating
 * whether the animation is still running. The caller renders plain text while
 * animating and only mounts <Markdown> once the animation settles — this keeps
 * the heavy Markdown + highlight.js pipeline off the per-frame render path and
 * prevents transient markdown corruption / random garbage from being shown.
 *
 * The animation is gated by message.id (NOT message.content) so a given message
 * never re-animates when its content reference changes, and it short-circuits
 * for streaming messages, users who set prefers-reduced-motion, and when the
 * typing animation preference is disabled.
 */
function useScrambleText(
  message: ChatMessage,
  isLatest: boolean,
  isUser: boolean,
): { text: string; isAnimating: boolean } {
  const { typingAnimEnabled, typingSoundEnabled, playTypingSound } = usePreferences();
  const [scrambleContent, setScrambleContent] = React.useState(message.content);
  const [isAnimating, setIsAnimating] = React.useState(false);
  // Gate the one-shot on the message id so the same message never re-animates.
  const animatedIdRef = React.useRef<string | null>(null);

  const playTypingSoundRef = React.useRef(playTypingSound);
  const typingSoundEnabledRef = React.useRef(typingSoundEnabled);

  React.useEffect(() => {
    playTypingSoundRef.current = playTypingSound;
  }, [playTypingSound]);

  React.useEffect(() => {
    typingSoundEnabledRef.current = typingSoundEnabled;
  }, [typingSoundEnabled]);

  const isStreaming = message.id === "streaming-message";
  const shouldBypassAnimation =
    isUser ||
    isStreaming ||
    !isLatest ||
    !typingAnimEnabled ||
    prefersReducedMotion() ||
    animatedIdRef.current === message.id;

  // biome-ignore lint/correctness/useExhaustiveDependencies: refs (animatedIdRef, *Ref) and stable setters are intentionally omitted; all reactive inputs (message.id, message.content, isUser, isLatest, typingAnimEnabled) are listed.
  React.useEffect(() => {
    if (shouldBypassAnimation) {
      setScrambleContent(message.content);
      setIsAnimating(false);
      return;
    }

    animatedIdRef.current = message.id;
    const targetText = message.content;
    const chars = "0101A,^^+A^`A #%&+?-=";
    let iterations = 0;
    const length = targetText.length;
    setIsAnimating(true);

    const interval = setInterval(() => {
      // Scramble plain text only — Markdown is rendered once on completion.
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
        setIsAnimating(false);
      }
      iterations += Math.max(2, Math.floor(length / 40));
    }, 12);

    return () => clearInterval(interval);
    // Re-runs on content changes so streaming text (which keeps a constant id)
    // updates live; the animatedIdRef guard below prevents re-animating a message
    // that has already played its scramble animation.
  }, [message.id, message.content, isUser, isLatest, typingAnimEnabled]);

  return { text: shouldBypassAnimation ? message.content : scrambleContent, isAnimating };
}

export const ChatMessageBubble = React.memo(function ChatMessageBubble({
  message,
  onFeedback,
  isLatest = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const { user } = useUser();

  const initials = user
    ? `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase()
    : "";
  const fallbackInitials = initials || "U";

  const { text: scrambleContent, isAnimating } = useScrambleText(message, isLatest, isUser);

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
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.15em] text-[var(--text-muted)] uppercase select-none mb-0.5">
          <span
            className={cn(
              isUser ? "text-[var(--text-secondary)]" : "text-[var(--accent)] font-medium",
            )}
          >
            {isUser ? "USER" : "UETGPT // RESPONSE"}
          </span>
          <span className="opacity-30">//</span>
          <span className="opacity-70">{isUser ? "SYNC_OK" : "STREAM_LIVE"}</span>
        </div>

        <div
          className={cn(
            "w-full text-[var(--text-primary)] leading-relaxed font-sans text-[15px] md:text-base",
            isUser
              ? "bg-[var(--surface-elevated)] border border-[var(--border)]/40 rounded-[14px] px-5 py-4 shadow-sm"
              : "px-0 py-1",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : isAnimating ? (
            // While the typewriter animation runs we render plain text so the
            // heavy Markdown/highlight.js pipeline is not re-executed every
            // frame and transient markdown control characters cannot corrupt
            // the output. Markdown is mounted once the animation settles.
            <p className="whitespace-pre-wrap">{scrambleContent}</p>
          ) : (
            <Markdown content={scrambleContent} />
          )}
        </div>

        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 w-full">
            <SourceList sources={message.sources} />
          </div>
        )}

        <div className="flex items-center gap-4 mt-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
          <MessageActions
            messageId={message.id}
            content={message.content}
            role={message.role}
            onFeedback={onFeedback}
          />

          {message.tokenCount?.total ? (
            <span className="text-[10px] text-[var(--text-muted)] font-mono tracking-wider">
              [{message.tokenCount.total} TOKENS]
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
});
