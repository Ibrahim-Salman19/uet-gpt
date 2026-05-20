import type * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-sm)] bg-[var(--surface-muted)] relative overflow-hidden",
        "before:absolute before:inset-0 before:bg-[linear-gradient(90deg,transparent,var(--surface-hover),transparent)] before:bg-[length:200%_100%] before:animate-[shimmer_1.5s_ease-in-out_infinite]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
