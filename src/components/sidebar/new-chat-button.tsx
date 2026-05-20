"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function NewChatButton() {
  const router = useRouter();

  return (
    <div className="p-3">
      <Button
        variant="outline"
        size="default"
        onClick={() => router.push("/chat")}
        className="w-full justify-start gap-2 border-[var(--border)] bg-transparent text-[var(--text-sidebar)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-sidebar)]"
      >
        <Plus className="h-4 w-4" />
        New Chat
      </Button>
    </div>
  );
}
