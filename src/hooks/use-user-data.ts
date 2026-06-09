"use client";

import { useUser } from "@clerk/nextjs";
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
  const modelPreference =
    (convexUser?.preferences?.model as "llama-3.1-8b" | "llama-4-scout") || "llama-3.1-8b";

  return {
    clerkUser: user,
    isClerkLoaded,
    convexUser,
    isConvexLoaded: convexUser !== undefined,
    isFullyLoaded: isClerkLoaded && convexUser !== undefined,
    preferences: convexUser?.preferences ?? null,
    modelPreference,
  };
}
