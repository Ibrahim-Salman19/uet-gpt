"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface NewChatButtonProps {
  onCreateThread?: () => Promise<string | null>;
}

export function NewChatButton({ onCreateThread }: NewChatButtonProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const creatingRef = useRef(false);

  const handleClick = useCallback(async () => {
    if (creatingRef.current) return;

    if (onCreateThread) {
      creatingRef.current = true;
      setIsCreating(true);
      try {
        const threadId = await onCreateThread();
        if (threadId) {
          router.push(`/chat/${threadId}`);
        } else {
          creatingRef.current = false;
          setIsCreating(false);
          toast.error("Failed to start conversation. Please try again.");
        }
      } catch {
        creatingRef.current = false;
        setIsCreating(false);
        toast.error("Failed to start conversation. Please try again.");
      } finally {
        setTimeout(() => {
          creatingRef.current = false;
          setIsCreating(false);
        }, 500);
      }
    } else {
      // Fallback: navigate to thread-less chat if no creation function
      router.push("/chat");
    }
  }, [onCreateThread, router]);

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
