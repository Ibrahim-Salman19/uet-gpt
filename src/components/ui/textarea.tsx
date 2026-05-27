import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-[60px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out-quart)] placeholder:text-[var(--text-disabled)] hover:border-[var(--accent-muted)] focus-visible:outline-none focus-visible:border-[var(--accent)] focus-visible:shadow-[0_0_0_3px_var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
