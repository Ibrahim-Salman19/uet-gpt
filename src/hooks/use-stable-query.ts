"use client";

import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useRef } from "react";

/**
 * Drop-in replacement for Convex useQuery that prevents flicker
 * by returning the previous result while a new query is loading.
 *
 * Unlike a naive implementation, the cached value is keyed by the serialized
 * query name + args. If the caller switches to a different query/argument set
 * (e.g. a different threadId), we never return the previously cached value for
 * the new key — doing so would briefly leak another thread's data into the UI.
 *
 * Source: https://docs.convex.dev/client/react/advanced/useStableQuery
 */
export function useStableQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: Query["_args"] | "skip",
): Query["_returnType"] | undefined {
  const result = useQuery(query, args);

  // Cache the last non-undefined result together with the key it belongs to.
  const cache = useRef<{ key: string; value: Query["_returnType"] } | undefined>(undefined);

  // Identify the current query by name + serialized args.
  const key = `${getQueryName(query)}|${JSON.stringify(args)}`;

  if (result !== undefined) {
    cache.current = { key, value: result };
    return result;
  }

  // Loading: only fall back to the cached value if it belongs to the SAME key.
  // For a different query/args (e.g. a new thread) return undefined (loading)
  // rather than the stale value from the previous key.
  if (cache.current && cache.current.key === key) {
    return cache.current.value;
  }

  return undefined;
}

function getQueryName(query: FunctionReference<"query">): string {
  // Convex function references expose a stable identifier; fall back to a
  // string coercion if the internal field is unavailable.
  const name = (query as { _name?: string })._name;
  return name ?? String(query);
}
