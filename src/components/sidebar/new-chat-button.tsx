"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

interface NewChatButtonProps {
  onCreateThread?: () => Promise<string | null>;
}

export function NewChatButton({ onCreateThread }: NewChatButtonProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleClick = useCallback(async () => {
    if (isCreating) return;

    if (onCreateThread) {
      setIsCreating(true);
      try {
        const threadId = await onCreateThread();
        if (threadId) {
          router.push(`/chat/${threadId}`);
        } else {
          toast.error("Failed to start conversation. Please try again.");
        }
      } catch {
        toast.error("Failed to start conversation. Please try again.");
      } finally {
        setTimeout(() => setIsCreating(false), 500);
      }
    } else {
      // Fallback: navigate to thread-less chat if no creation function
      router.push("/chat");
    }
  }, [onCreateThread, router, isCreating]);

  return (
    <div className="p-3">
      <Button
        variant="outline"
        size="default"
        onClick={handleClick}
        disabled={isCreating}
        className="w-full justify-start gap-2 border-[var(--border)] bg-transparent text-[var(--text-sidebar)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-sidebar)]"
      >
        <Plus className="h-4 w-4" />
        {isCreating ? "Creating..." : "New Chat"}
      </Button>
    </div>
  );
}
