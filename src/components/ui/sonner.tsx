"use client";

import { Toaster as SonnerToaster } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

function Toaster({ ...props }: ToasterProps) {
  return (
    <SonnerToaster
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--surface-card)] group-[.toaster]:text-[var(--text-primary)] group-[.toaster]:border group-[.toaster]:border-[var(--border)] group-[.toaster]:shadow-[var(--shadow-lg)] group-[.toaster]:rounded-[var(--radius-md)]",
          description: "group-[.toast]:text-[var(--text-secondary)]",
          actionButton:
            "group-[.toast]:bg-[var(--primary)] group-[.toast]:text-[var(--primary-fg)] group-[.toast]:rounded-[var(--radius-xs)]",
          cancelButton:
            "group-[.toast]:bg-[var(--surface-muted)] group-[.toast]:text-[var(--text-primary)] group-[.toast]:rounded-[var(--radius-xs)]",
          success: "group-[.toaster]:!border-[var(--semantic-success)]",
          error: "group-[.toaster]:!border-[var(--destructive)]",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
