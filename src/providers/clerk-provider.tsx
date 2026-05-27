"use client";

import { ClerkProvider as Clerk } from "@clerk/nextjs";
import type * as React from "react";

interface ClerkProviderProps {
  children: React.ReactNode;
}

/**
 * Provider that wraps the app with Clerk authentication.
 * Customized with UET Taxila brand colors and styling.
 */
export function ClerkProvider({ children }: ClerkProviderProps) {
  return (
    <Clerk
      appearance={{
        variables: {
          colorPrimary: "oklch(0.35 0.07 265)",
          colorText: "oklch(0.15 0.01 265)",
          borderRadius: "10px",
          fontFamily: "Geist, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        },
        elements: {
          card: "shadow-[var(--shadow-lg)] border border-[var(--border)]",
          socialButtonsBlockButton:
            "border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors duration-150",
        },
      }}
    >
      {children}
    </Clerk>
  );
}
