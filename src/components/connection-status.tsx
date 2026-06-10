"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOfflineRef = useRef(false);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    if (wasOfflineRef.current) {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        setWasOffline(false);
        wasOfflineRef.current = false;
      }, 3000);
    }
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setWasOffline(true);
    wasOfflineRef.current = true;
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [handleOnline, handleOffline]);

  if (isOnline && !wasOffline) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[999] text-center py-1.5 text-xs font-medium transition-all duration-500",
        isOnline
          ? "bg-green-500/10 text-green-400 border-b border-green-500/20"
          : "bg-amber-500/10 text-amber-400 border-b border-amber-500/20 animate-pulse",
      )}
      role="status"
      aria-live="polite"
    >
      {isOnline ? "Reconnected" : "You are offline — messages will be sent when you reconnect"}
    </div>
  );
}
