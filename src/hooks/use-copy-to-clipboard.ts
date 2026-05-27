"use client";

import { useCallback, useState } from "react";

interface UseCopyToClipboardReturn {
  /** Whether the last copy was successful */
  copied: boolean;
  /** Copy text to clipboard */
  copy: (text: string) => Promise<boolean>;
  /** Reset the copied state */
  reset: () => void;
}

/**
 * Hook to copy text to the clipboard.
 *
 * @param resetAfter - Milliseconds after which `copied` resets to false (default: 2000)
 * @returns Object with `copied` state, `copy` function, and `reset` function
 *
 * @example
 * const { copied, copy } = useCopyToClipboard();
 *
 * <button onClick={() => copy("Hello, world!")}>
 *   {copied ? "Copied!" : "Copy"}
 * </button>
 */
export function useCopyToClipboard(resetAfter = 2000): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      // Skip if clipboard API is not available (e.g., HTTP contexts)
      if (!navigator?.clipboard?.writeText) {
        // Fallback for older browsers / non-secure contexts
        try {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
          setCopied(true);
          setTimeout(() => setCopied(false), resetAfter);
          return true;
        } catch {
          return false;
        }
      }

      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), resetAfter);
        return true;
      } catch {
        return false;
      }
    },
    [resetAfter],
  );

  const reset = useCallback(() => {
    setCopied(false);
  }, []);

  return { copied, copy, reset };
}
