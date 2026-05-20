"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  type?: "messages" | "sidebar" | "page";
  className?: string;
}

function MessageSkeleton({ isUser }: { isUser: boolean }) {
  return (
    <div
      className={cn("flex items-start gap-3 px-4 py-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <Skeleton className="h-8 w-8 shrink-0 rounded-[var(--radius-sm)]" />
      <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
        <Skeleton className={cn("h-16 rounded-[var(--radius-lg)]", isUser ? "w-64" : "w-80")} />
        <Skeleton className="h-4 w-24 rounded-[var(--radius-sm)]" />
      </div>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-[var(--radius-sm)]" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-20 rounded-[var(--radius-sm)]" />
          <Skeleton className="h-3 w-32 rounded-[var(--radius-sm)]" />
        </div>
      </div>
      <Skeleton className="mt-2 h-10 w-full rounded-[var(--radius-md)]" />
      <div className="mt-4 flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => `sidebar-skeleton-${i}`).map((key) => (
          <Skeleton key={key} className="h-10 w-full rounded-[var(--radius-sm)]" />
        ))}
      </div>
    </div>
  );
}

export function LoadingState({ type = "messages", className }: LoadingStateProps) {
  if (type === "sidebar") {
    return <SidebarSkeleton />;
  }

  if (type === "page") {
    return (
      <div className={cn("flex flex-col gap-4 p-6", className)}>
        <Skeleton className="h-8 w-48 rounded-[var(--radius-md)]" />
        <Skeleton className="h-4 w-96 rounded-[var(--radius-sm)]" />
        <div className="mt-4 grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => `page-skeleton-${i}`).map((key) => (
            <Skeleton key={key} className="h-32 w-full rounded-[var(--radius-lg)]" />
          ))}
        </div>
        <Skeleton className="mt-4 h-64 w-full rounded-[var(--radius-lg)]" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <MessageSkeleton isUser />
      <MessageSkeleton isUser={false} />
      <MessageSkeleton isUser={false} />
      <MessageSkeleton isUser />
      <MessageSkeleton isUser={false} />
    </div>
  );
}
