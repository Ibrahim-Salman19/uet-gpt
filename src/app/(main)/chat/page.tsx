"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { useThreads } from "@/hooks/use-threads";

export default function ChatPage() {
  const router = useRouter();
  const { createThread } = useThreads();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const threadId = await createThread();
      if (!cancelled && threadId) {
        router.replace(`/chat/${threadId}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createThread, router]);

  return (
    <div className="flex h-full items-center justify-center">
      <LoadingSpinner size="lg" label="Starting new chat..." />
    </div>
  );
}
