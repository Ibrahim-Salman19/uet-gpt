import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-[var(--shadow-sm)] transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-quart)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] hover:border-[var(--accent-muted)] focus-visible:outline-none focus-visible:border-[var(--accent)] focus-visible:shadow-[0_0_0_3px_var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
