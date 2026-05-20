"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface StreamingMessageProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export function StreamingMessage({ content, isStreaming, className }: StreamingMessageProps) {
  const [displayedContent, setDisplayedContent] = useState("");
  const indexRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedContent(content);
      return;
    }

    indexRef.current = 0;
    setDisplayedContent("");

    const CHARS_PER_FRAME = 3;

    function animate() {
      if (indexRef.current < content.length) {
        const next = Math.min(indexRef.current + CHARS_PER_FRAME, content.length);
        setDisplayedContent(content.slice(0, next));
        indexRef.current = next;
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [content, isStreaming]);

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {displayedContent}
      {isStreaming && (
        <span className="inline-flex h-[1em] w-[2px] animate-pulse bg-[var(--accent)] ml-0.5 align-text-bottom" />
      )}
    </span>
  );
}
