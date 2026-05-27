"use client";

import { useEffect, useState } from "react";

/**
 * Hook to track a CSS media query match.
 *
 * @param query - CSS media query string (e.g., "(min-width: 768px)")
 * @returns Whether the media query currently matches
 *
 * @example
 * const isMobile = useMediaQuery("(max-width: 767px)");
 * const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
 * const isDesktop = useMediaQuery("(min-width: 1024px)");
 * const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Skip SSR — media queries aren't available on the server
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(query);

    // Set initial value
    setMatches(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}

/** Convenience hook: is the viewport mobile-sized? (max-width: 767px) */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

/** Convenience hook: is the viewport tablet-sized? (768px - 1023px) */
export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
}

/** Convenience hook: is the viewport desktop-sized? (min-width: 1024px) */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

/** Convenience hook: is the viewport wide desktop? (min-width: 1440px) */
export function useIsWideDesktop(): boolean {
  return useMediaQuery("(min-width: 1440px)");
}

/** Convenience hook: is the user in dark mode? */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery("(prefers-color-scheme: dark)");
}
