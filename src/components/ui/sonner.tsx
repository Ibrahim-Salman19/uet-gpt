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
            "group toast group-[.toaster]:bg-[var(--surface-elevated)] group-[.toaster]:text-[var(--text-primary)] group-[.toaster]:border group-[.toaster]:border-[var(--border)] group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl font-sans",
          description: "group-[.toast]:text-[var(--text-secondary)]",
          actionButton:
            "group-[.toast]:bg-[var(--primary)] group-[.toast]:text-[var(--primary-fg)] group-[.toast]:rounded-md font-medium",
          cancelButton:
            "group-[.toast]:bg-[var(--surface-muted)] group-[.toast]:text-[var(--text-primary)] group-[.toast]:rounded-md",
          success:
            "group-[.toaster]:!border-[var(--semantic-success)] group-[.toaster]:!bg-[var(--semantic-success)]/10",
          error:
            "group-[.toaster]:!border-[var(--destructive)] group-[.toaster]:!bg-[var(--destructive)]/10",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
