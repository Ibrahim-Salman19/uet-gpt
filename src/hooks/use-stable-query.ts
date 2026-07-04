"use client";

import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import type { FunctionReference } from "convex/server";
import { useRef } from "react";

export function useStableQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: Query["_args"] | "skip",
): Query["_returnType"] | undefined {
  const result = useQuery(query, args);

  const cache = useRef<{ key: string; value: Query["_returnType"] } | undefined>(undefined);

  const key = `${getFunctionName(query)}|${JSON.stringify(args)}`;

  if (result !== undefined) {
    cache.current = { key, value: result };
    return result;
  }

  if (cache.current && cache.current.key === key) {
    return cache.current.value;
  }

  return undefined;
}
