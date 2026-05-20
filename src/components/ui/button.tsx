import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-quart)] focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-[var(--primary-fg)] shadow-[var(--shadow-sm)] hover:bg-[var(--primary-hover)] hover:shadow-[var(--shadow-md)] active:bg-[var(--primary-active)]",
        destructive:
          "bg-[var(--destructive)] text-[var(--destructive-fg)] shadow-[var(--shadow-sm)] hover:bg-[var(--destructive-hover)] active:scale-[0.97]",
        outline:
          "border border-[var(--border)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-[var(--shadow-sm)] hover:bg-[var(--surface-hover)] hover:border-[var(--accent)] active:bg-[var(--surface-muted)]",
        secondary:
          "bg-[var(--surface-muted)] text-[var(--text-primary)] shadow-[var(--shadow-sm)] hover:bg-[var(--surface-hover)] active:bg-[var(--surface-muted)]",
        ghost:
          "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] active:bg-[var(--surface-muted)]",
        link: "text-[var(--primary)] underline-offset-4 hover:underline hover:text-[var(--primary-hover)]",
      },
      size: {
        default: "h-9 rounded-[var(--radius-sm)] px-4 py-2 gap-2",
        sm: "h-8 rounded-[var(--radius-xs)] px-3 text-xs gap-1.5",
        lg: "h-11 rounded-[var(--radius-md)] px-6 text-base gap-2.5",
        xl: "h-13 rounded-[var(--radius-md)] px-8 text-base gap-3",
        icon: "h-9 w-9 rounded-[var(--radius-sm)]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        data-touch-target
        {...props}
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary-fg)] border-t-transparent" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
