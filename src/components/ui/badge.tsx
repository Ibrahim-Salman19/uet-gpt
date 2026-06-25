import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-quart)]",
  {
    variants: {
      variant: {
        default: "bg-[var(--primary)] text-[var(--primary-fg)]",
        secondary: "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
        destructive: "bg-[var(--destructive)] text-[var(--destructive-fg)]",
        outline: "border border-[var(--border)] text-[var(--text-primary)]",
        success: "bg-[var(--semantic-success)]/15 text-[var(--semantic-success)]",
        warning: "bg-[var(--semantic-warning)]/15 text-[var(--semantic-warning)]",
        accent: "bg-[var(--accent)] text-[var(--accent-fg)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
