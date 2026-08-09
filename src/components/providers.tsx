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
import { uetClerkAppearance } from "@/lib/clerk-theme";
import { retryWithBackoff } from "@/lib/retry";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const USER_SYNC_RETRY_MS = 30_000;

interface ProvidersProps {
  children: React.ReactNode;
  /** Optional CSP nonce forwarded to the pre-hydration theme bootstrap. */
  themeNonce?: string;
}

function isValidConvexUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    const localHost =
      url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    return url.protocol === "https:" || (url.protocol === "http:" && localHost);
  } catch {
    return false;
  }
}

// Keep exactly one Convex client per browser module instance. This matches the
// official App Router integration pattern and avoids constructing disposable
// clients during React Strict Mode development checks.
function createConvexClient(): ConvexReactClient | null {
  if (!isValidConvexUrl(convexUrl)) return null;
  try {
    return new ConvexReactClient(convexUrl);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Convex client initialization failed", error);
    }
    return null;
  }
}

const convexClient = createConvexClient();

function UserSync() {
  const { user, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { isAuthenticated: convexAuthenticated } = useConvexAuth();
  const createUser = useMutation(api.users.getOrCreate);

  const syncedKeyRef = React.useRef<string | null>(null);
  const mountedRef = React.useRef(false);
  const inFlightRef = React.useRef<{ key: string; promise: Promise<unknown> } | null>(null);
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSyncKeyRef = React.useRef<string | null>(null);
  const [retryGeneration, setRetryGeneration] = React.useState(0);

  const userId = user?.id ?? null;
  const userName = user?.fullName || user?.username || "UETGPT user";
  const userEmail =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? "";
  const userImageUrl = user?.imageUrl || undefined;
  const syncKey = userId ? JSON.stringify([userId, userName, userEmail, userImageUrl ?? ""]) : null;
  activeSyncKeyRef.current = syncKey;

  const scheduleRetry = React.useCallback((delayMs = USER_SYNC_RETRY_MS) => {
    if (!mountedRef.current || retryTimerRef.current !== null) return;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setRetryGeneration((generation) => generation + 1);
    }, delayMs);
  }, []);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (isSignedIn) return;
    syncedKeyRef.current = null;
    activeSyncKeyRef.current = null;
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [isSignedIn]);

  React.useEffect(() => {
    if (
      !clerkLoaded ||
      !isSignedIn ||
      !userId ||
      !syncKey ||
      !convexAuthenticated ||
      syncedKeyRef.current === syncKey
    ) {
      return;
    }

    // Serialize profile writes. If Clerk data changes while a write is in
    // flight, the finally block immediately schedules another pass using the
    // newest profile snapshot instead of allowing stale writes to race.
    if (inFlightRef.current !== null) return;

    const targetKey = syncKey;
    const operation = retryWithBackoff(
      () =>
        createUser({
          clerkId: userId,
          name: userName,
          email: userEmail,
          imageUrl: userImageUrl,
        }),
      {
        maxRetries: 3,
        baseDelayMs: 1_000,
        onRetry: (attempt, error) => {
          if (process.env.NODE_ENV === "development") {
            console.warn(`User synchronization retry ${attempt}`, error);
          }
        },
      },
    );

    inFlightRef.current = { key: targetKey, promise: operation };

    void operation
      .then(() => {
        if (!mountedRef.current || activeSyncKeyRef.current !== targetKey) return;
        syncedKeyRef.current = targetKey;
        if (retryTimerRef.current !== null) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || activeSyncKeyRef.current !== targetKey) return;
        console.error("User synchronization failed after retries", error);
        scheduleRetry();
      })
      .finally(() => {
        if (inFlightRef.current?.promise === operation) inFlightRef.current = null;
        if (!mountedRef.current) return;
        if (
          activeSyncKeyRef.current !== null &&
          syncedKeyRef.current !== activeSyncKeyRef.current &&
          retryTimerRef.current === null
        ) {
          scheduleRetry(0);
        }
      });
  }, [
    clerkLoaded,
    isSignedIn,
    userId,
    syncKey,
    userName,
    userEmail,
    userImageUrl,
    convexAuthenticated,
    createUser,
    retryGeneration,
    scheduleRetry,
  ]);

  return null;
}

function ApplicationChrome({ children }: ProvidersProps) {
  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={100}>
      {children}
      <Toaster
        position="bottom-right"
        closeButton
        toastOptions={{
          className: "border border-[var(--border)] shadow-[var(--shadow-lg)]",
          duration: 4_000,
        }}
      />
    </TooltipProvider>
  );
}

function ConfigurationError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 p-6 font-sans text-slate-100">
      <section
        role="alert"
        className="w-full max-w-md space-y-4 rounded-xl border border-red-500/30 bg-slate-950/80 p-8 text-center shadow-2xl"
      >
        <h1 className="text-2xl font-bold text-red-400">Configuration error</h1>
        <p className="text-sm leading-relaxed text-slate-400">
          <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-red-300">
            NEXT_PUBLIC_CONVEX_URL
          </code>{" "}
          is missing or invalid. Configure an HTTPS Convex deployment URL, then restart or redeploy
          the application.
        </p>
      </section>
    </main>
  );
}

export function Providers({ children, themeNonce }: ProvidersProps) {
  return (
    <ClerkProvider appearance={uetClerkAppearance}>
      <ThemeProvider nonce={themeNonce}>
        {convexClient ? (
          <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
            <PreferencesProvider>
              <UserSync />
              <ConvexConnectionMonitor />
              <ApplicationChrome>{children}</ApplicationChrome>
            </PreferencesProvider>
          </ConvexProviderWithClerk>
        ) : (
          <ConfigurationError />
        )}
      </ThemeProvider>
    </ClerkProvider>
  );
}
