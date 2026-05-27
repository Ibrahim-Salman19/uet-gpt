"use client";

import { ClerkProvider, useAuth, useUser } from "@clerk/nextjs";
import { api } from "convex/_generated/api";
import { ConvexReactClient, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import * as React from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

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
    createUser({
      clerkId: user.id,
      name: user.fullName || user.username || "Unknown",
      email: primary?.emailAddress ?? "",
      imageUrl: user.imageUrl || undefined,
    }).catch((err) => console.error("Failed to sync user:", err));
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

  if (!convexClient) {
    return <ThemeProvider>{content}</ThemeProvider>;
  }

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
      <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
        <ThemeProvider>
          <UserSync />
          {content}
        </ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
