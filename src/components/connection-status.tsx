"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Show "reconnected" briefly
        setTimeout(() => setWasOffline(false), 3000);
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  if (isOnline && !wasOffline) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[999] text-center py-1.5 text-xs font-medium transition-all duration-500",
        isOnline
          ? "bg-green-500/10 text-green-400 border-b border-green-500/20"
          : "bg-amber-500/10 text-amber-400 border-b border-amber-500/20 animate-pulse"
      )}
      role="status"
      aria-live="polite"
    >
      {isOnline ? "Reconnected" : "You are offline — messages will be sent when you reconnect"}
    </div>
  );
}
