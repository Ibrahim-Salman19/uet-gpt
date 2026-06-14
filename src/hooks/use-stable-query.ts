"use client";

import { useQuery } from "convex/react";
import { useRef } from "react";

/**
 * Drop-in replacement for Convex useQuery that prevents flicker
 * by returning the previous result while a new query is loading.
 *
 * Source: https://docs.convex.dev/client/react/advanced/useStableQuery
 */
export const useStableQuery = ((name: any, args?: any) => {
  const serializedArgs = JSON.stringify(args);
  const prevArgsRef = useRef({ name, serializedArgs });
  const result = useQuery(name, args);
  const stored = useRef(result);

  if (prevArgsRef.current.name !== name || prevArgsRef.current.serializedArgs !== serializedArgs) {
    stored.current = undefined;
    prevArgsRef.current = { name, serializedArgs };
  }

  if (result !== undefined) {
    stored.current = result;
  }

  return result === undefined ? stored.current : result;
}) as typeof useQuery;
