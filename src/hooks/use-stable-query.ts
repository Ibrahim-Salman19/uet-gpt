"use client";

import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import type { FunctionReference } from "convex/server";
import { useRef } from "react";

function getQueryName(query: FunctionReference<"query">): string {
  try {
    return getFunctionName(query);
  } catch (e) {
    if (query && typeof query === "object") {
      if ("_name" in query && typeof query._name === "string") return query._name;
      if ("name" in query && typeof query.name === "string") return query.name;
    }
    try {
      return String(query);
    } catch (err) {
      return "unknown-query";
    }
  }
}

export function useStableQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: Query["_args"] | "skip",
): Query["_returnType"] | undefined {
  const result = useQuery(query, args);

  const cache = useRef<{ key: string; value: Query["_returnType"] } | undefined>(undefined);

  const key = `${getQueryName(query)}|${JSON.stringify(args)}`;

  if (result !== undefined) {
    cache.current = { key, value: result };
    return result;
  }

  if (cache.current && cache.current.key === key) {
    return cache.current.value;
  }

  return undefined;
}
