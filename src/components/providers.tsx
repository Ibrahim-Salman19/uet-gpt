"use client";

import { ClerkProvider, useAuth, useUser } from "@clerk/nextjs";
import { api } from "convex/_generated/api";
import { ConvexReactClient, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import * as React from "react";
import { PreferencesProvider } from "@/components/preferences-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { retryWithBackoff } from "@/lib/retry";
import { ConvexConnectionMonitor } from "@/components/ConvexConnectionMonitor";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

interface ProvidersProps {
  children: React.ReactNode;
}

function UserSync() {
  const { user, isLoaded, isSignedIn } = useUser();
  const createUser = useMutation(api.users.getOrCreate);

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const primary = user.primaryEmailAddress;
    retryWithBackoff(
      () =>
        createUser({
          clerkId: user.id,
          name: user.fullName || user.username || "Unknown",
          email: primary?.emailAddress ?? "",
          imageUrl: user.imageUrl || undefined,
        }),
      {
        maxRetries: 3,
        baseDelayMs: 1000,
        onRetry: (attempt, err) => console.warn(`User sync retry ${attempt}:`, err),
      },
    ).catch((err) => console.error("Failed to sync user after retries:", err));
  }, [isLoaded, isSignedIn, user, createUser]);

  return null;
}

export function Providers({ children }: ProvidersProps) {
  const [convexClient] = React.useState(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  });

  const content = (
    <TooltipProvider delayDuration={300} skipDelayDuration={100}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "border border-[var(--border)] shadow-[var(--shadow-lg)]",
          duration: 4000,
        }}
      />
    </TooltipProvider>
  );

  return (
    <ClerkProvider
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
      {convexClient ? (
        <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
          <ThemeProvider>
            <PreferencesProvider>
              <UserSync />
              <ConvexConnectionMonitor />
              {content}
            </PreferencesProvider>
          </ThemeProvider>
        </ConvexProviderWithClerk>
      ) : (
        <ThemeProvider>
          <PreferencesProvider>{content}</PreferencesProvider>
        </ThemeProvider>
      )}
    </ClerkProvider>
  );
}
