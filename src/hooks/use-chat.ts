"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export function useChat(_threadId?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastMessageRef = useRef<string>("");
  const isLoadingRef = useRef(false);

  const handleSend = useCallback(async (content: string) => {
    if (!content.trim() || isLoadingRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    lastMessageRef.current = content.trim();

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      setError(message);
      toast.error(message);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const handleStop = useCallback(() => {
    isLoadingRef.current = false;
    setIsLoading(false);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    if (lastMessageRef.current) {
      handleSend(lastMessageRef.current);
    }
  }, [handleSend]);

  return {
    isLoading,
    error,
    sendMessage: handleSend,
    stopGeneration: handleStop,
    retry: handleRetry,
  };
}
