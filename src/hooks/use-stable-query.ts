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
  const prevNameRef = useRef(name);
  const prevArgsRef = useRef(args);
  const prevSerializedRef = useRef<string | undefined>(JSON.stringify(args));
  const result = useQuery(name, args);
  const stored = useRef(result);

  const nameChanged = prevNameRef.current !== name;
  const argsRefChanged = prevArgsRef.current !== args;

  if (nameChanged || argsRefChanged) {
    const serialized = argsRefChanged ? JSON.stringify(args) : prevSerializedRef.current;
    if (nameChanged || serialized !== prevSerializedRef.current) {
      stored.current = undefined;
    }
    prevNameRef.current = name;
    prevArgsRef.current = args;
    prevSerializedRef.current = serialized;
  }

  if (result !== undefined) {
    stored.current = result;
  }

  return result === undefined ? stored.current : result;
}) as typeof useQuery;
