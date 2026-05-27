import type * as React from "react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size variant */
  size?: "sm" | "md" | "lg" | "xl";
  /** Optional label shown below the spinner */
  label?: string;
}

const sizeClasses: Record<
  NonNullable<LoadingSpinnerProps["size"]>,
  { container: string; icon: string }
> = {
  sm: { container: "h-6 w-6", icon: "h-4 w-4" },
  md: { container: "h-10 w-10", icon: "h-6 w-6" },
  lg: { container: "h-14 w-14", icon: "h-8 w-8" },
  xl: { container: "h-20 w-20", icon: "h-12 w-12" },
};

/**
 * Loading spinner component with animated rotation.
 * Uses CSS border-based spinner for maximum performance.
 */
export function LoadingSpinner({ size = "md", label, className, ...props }: LoadingSpinnerProps) {
  const dimensions = sizeClasses[size] ?? sizeClasses.md;

  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-label={label ?? "Loading"}
      {...props}
    >
      <div
        className={cn(
          "animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]",
          dimensions.container,
        )}
      >
        <span className="sr-only">{label ?? "Loading..."}</span>
      </div>
      {label && <p className="text-sm text-[var(--text-muted)] animate-pulse">{label}</p>}
    </div>
  );
}
