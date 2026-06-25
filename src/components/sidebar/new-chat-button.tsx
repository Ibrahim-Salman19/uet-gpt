"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

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
          // Keep the button disabled while navigation completes; the component
          // unmounts on route change so no manual reset is needed on success.
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
      }
    } else {
      // Fallback: navigate to thread-less chat if no creation function
      router.push("/chat");
    }
  }, [onCreateThread, router]);

  return (
    <div className="p-4 md:p-5 pb-3">
      <button
        onClick={handleClick}
        disabled={isCreating}
        className="group relative flex w-full items-center justify-start gap-2.5 rounded-[12px] border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] transition-all duration-300 ease-[var(--ease-spring)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 hover:text-[var(--accent)] hover:shadow-[0_0_12px_rgba(212,168,74,0.1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50 min-h-[44px]"
      >
        <Plus className="h-4 w-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-90" />
        {isCreating ? "Starting…" : "New Chat"}
      </button>
    </div>
  );
}
