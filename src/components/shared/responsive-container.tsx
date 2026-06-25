import type * as React from "react";
import { cn } from "@/lib/utils";

interface ResponsiveContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Maximum width variant */
  size?: "sm" | "md" | "lg" | "xl" | "full";
  /** Whether to add horizontal padding */
  padded?: boolean;
  /** Whether to center the container */
  centered?: boolean;
  as?: "div" | "section" | "article" | "main";
}

const sizeClasses: Record<NonNullable<ResponsiveContainerProps["size"]>, string> = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-7xl",
  xl: "max-w-[1440px]",
  full: "max-w-full",
};

/**
 * Responsive container with configurable max-width breakpoints.
 * Uses Tailwind's responsive utilities for automatic mobile adaptation.
 */
export function ResponsiveContainer({
  size = "lg",
  padded = true,
  centered = true,
  as: Component = "div",
  className,
  children,
  ...props
}: ResponsiveContainerProps) {
  return (
    <Component
      className={cn(
        "w-full",
        sizeClasses[size],
        padded && "px-4 sm:px-6 lg:px-8",
        centered && "mx-auto",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
