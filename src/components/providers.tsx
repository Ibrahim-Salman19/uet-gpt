"use client";

import { ClerkProvider, useAuth, useUser } from "@clerk/nextjs";
import { api } from "convex/_generated/api";
import { ConvexReactClient, useConvexAuth, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import * as React from "react";
import { ConvexConnectionMonitor } from "@/components/ConvexConnectionMonitor";
import { PreferencesProvider } from "@/components/preferences-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { retryWithBackoff } from "@/lib/retry";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

interface ProvidersProps {
  children: React.ReactNode;
}

function UserSync() {
  const { user, isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const createUser = useMutation(api.users.getOrCreate);
  // Id of the user that has been *successfully* synced; null until a sync lands.
  const syncedId = React.useRef<string | null>(null);
  // Guards against launching a second concurrent attempt while one is in flight
  // (the effect can re-run on dep changes before the async work resolves).
  const inFlight = React.useRef(false);

  React.useEffect(() => {
    if (
      !isClerkLoaded ||
      !isSignedIn ||
      !user ||
      !isConvexAuthenticated ||
      syncedId.current === user.id ||
      inFlight.current
    )
      return;

    inFlight.current = true;
    const primary = user.primaryEmailAddress;
    const targetId = user.id;
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
    )
      .then(() => {
        // Mark as synced only on success so a transient failure does not
        // permanently suppress sync for the session.
        syncedId.current = targetId;
      })
      .catch((err) => {
        console.error("Failed to sync user after retries:", err);
        // Leave syncedId unset so a later reconnect (isConvexAuthenticated
        // toggling back to true) re-arms the effect and retries. The inFlight
        // guard plus the effect's dependency gating prevent a tight loop.
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [isClerkLoaded, isSignedIn, user, isConvexAuthenticated, createUser]);

  return null;
}

export function Providers({ children }: ProvidersProps) {
  const [convexClient] = React.useState(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  });

  // Close the client on unmount to release the WebSocket. This is a root,
  // app-lifetime provider so this only fires on full teardown.
  React.useEffect(() => {
    return () => {
      convexClient?.close().catch((err) => console.error("Failed to close Convex client:", err));
    };
  }, [convexClient]);

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
        <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-900 text-slate-100 font-sans">
          <div className="max-w-md w-full p-8 border border-red-500/30 rounded-xl bg-slate-950/80 shadow-2xl text-center space-y-4">
            <h1 className="text-2xl font-bold text-red-400">Configuration Error</h1>
            <p className="text-slate-400 text-sm">
              The environment variable{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-800 text-red-300 font-mono text-xs">
                NEXT_PUBLIC_CONVEX_URL
              </code>{" "}
              is missing. Please set it in your local environment files or Vercel dashboard.
            </p>
          </div>
        </div>
      )}
    </ClerkProvider>
  );
}
