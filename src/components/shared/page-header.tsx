import type * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Page title */
  title: string;
  /** Optional description text below the title */
  description?: string;
  /** Optional actions to render on the right side */
  actions?: React.ReactNode;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

const titleSizeClasses: Record<string, string> = {
  sm: "text-lg sm:text-xl",
  md: "text-xl sm:text-2xl",
  lg: "text-2xl sm:text-3xl",
};

const descriptionSizeClasses: Record<string, string> = {
  sm: "text-sm",
  md: "text-sm sm:text-base",
  lg: "text-base sm:text-lg",
};

/**
 * Standard page header with title, optional description, and action buttons.
 */
export function PageHeader({
  title,
  description,
  actions,
  size = "md",
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="space-y-1">
        <h1
          className={cn(
            "font-semibold tracking-tight text-[var(--text-primary)]",
            titleSizeClasses[size],
          )}
        >
          {title}
        </h1>
        {description && (
          <p className={cn("text-[var(--text-secondary)]", descriptionSizeClasses[size])}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 mt-2 sm:mt-0">{actions}</div>}
    </div>
  );
}
