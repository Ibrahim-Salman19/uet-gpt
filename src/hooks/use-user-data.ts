"use client";

import { useUser } from "@clerk/nextjs";
import { useMemo } from "react";
import { useStableQuery } from "@/hooks/use-stable-query";
import { api } from "../../convex/_generated/api";

/**
 * Single source of truth for Convex user data.
 * Prevents duplicate queries across PreferencesProvider and MainShell.
 */
export function useUserData() {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const queryArgs = user?.id ? { clerkId: user.id } : "skip";
  const convexUser = useStableQuery(api.users.getByClerkId, queryArgs);

  // Memoize the returned object so consumers don't re-render on every parent
  // render due to a fresh object identity (React Compiler is not enabled).
  return useMemo(() => {
    const modelPreference =
      (convexUser?.preferences?.model as "llama-3.1-8b" | "llama-4-scout") || "llama-3.1-8b";

    return {
      clerkUser: user,
      isClerkLoaded,
      convexUser,
      isConvexLoaded: convexUser !== undefined,
      isFullyLoaded: isClerkLoaded && (!user || convexUser !== undefined),
      preferences: convexUser?.preferences ?? null,
      modelPreference,
    };
  }, [user, isClerkLoaded, convexUser]);
}
