"use client";

import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useRef } from "react";

const functionNameSymbol = Symbol.for("functionName");

function getQueryName(query: FunctionReference<"query">): string {
  return (query as any)[functionNameSymbol] as string;
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
