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
    // Migrate legacy model preference keys. Existing users may have stored
    // "llama-3.1-8b" or "llama-4-scout" (the now-dead Groq Llama models) before
    // the Track C migration to gpt-oss. Map old → new so their saved preference
    // silently resolves to a valid model instead of falling back to default.
    const LEGACY_MODEL_MAP: Record<string, "gpt-oss-20b" | "gpt-oss-120b"> = {
      "llama-3.1-8b": "gpt-oss-20b",
      "llama-4-scout": "gpt-oss-120b",
      "gpt-oss-20b": "gpt-oss-20b",
      "gpt-oss-120b": "gpt-oss-120b",
    };
    const storedModel = convexUser?.preferences?.model as string | undefined;
    const modelPreference: "gpt-oss-20b" | "gpt-oss-120b" =
      (storedModel && LEGACY_MODEL_MAP[storedModel]) || "gpt-oss-20b";

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
