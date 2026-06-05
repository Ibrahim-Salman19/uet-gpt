"use client";

import { useRef } from "react";
import { useQuery } from "convex/react";

/**
 * Drop-in replacement for Convex useQuery that prevents flicker
 * by returning the previous result while a new query is loading.
 *
 * Source: https://docs.convex.dev/client/react/advanced/useStableQuery
 */
export const useStableQuery = ((name: any, args?: any) => {
  const result = useQuery(name, args);
  const stored = useRef(result);

  if (result !== undefined) {
    stored.current = result;
  }

  return result === undefined ? stored.current : result;
}) as typeof useQuery;
