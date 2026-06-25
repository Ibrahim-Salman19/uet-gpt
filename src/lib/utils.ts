import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function copyToClipboard(text: string): Promise<boolean> {
  // Browser-only API: guard so an accidental import into a server component
  // fails gracefully instead of throwing on `navigator`/`document`.
  if (typeof navigator === "undefined" || typeof document === "undefined") {
    return false;
  }
  try {
    // navigator.clipboard requires a secure context (HTTPS or localhost);
    // it is undefined on plain http, in which case we fall back to execCommand.
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    }
  } catch (err) {
    console.error("Clipboard copy failed:", err);
    return false;
  }
}
