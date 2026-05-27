/**
 * Analytics wrapper for UET GPT.
 *
 * Uses Vercel Web Analytics for page views and custom events.
 * All tracking is optional — degrades gracefully if analytics are not configured.
 */

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean>;
}

/**
 * Track a page view.
 * Uses Vercel Web Analytics (injected via `<Analytics />` component).
 */
export function trackPageView(_path: string): void {
  // Vercel Web Analytics handles page views automatically
  // via the <Analytics /> component in the root layout.
  // This function is a no-op placeholder for manual tracking if needed.
}

/**
 * Track a custom event.
 *
 * Example:
 * ```ts
 * trackEvent({ name: "chat_message_sent", properties: { model: "llama-4-scout", latency: 3200 } })
 * ```
 */
export function trackEvent(_event: AnalyticsEvent): void {
  // Vercel Web Analytics supports custom events via `useTrack()` hook.
  // This wrapper is a no-op placeholder for future integration.
  // Import and use:
  //   import { useTrack } from "@vercel/analytics/react";
  //   const { track } = useTrack();
  //   track(event.name, event.properties);
}

/**
 * Track a chat-specific event.
 */
export function trackChatEvent(
  action: "send" | "complete" | "error" | "feedback" | "stop",
  properties?: Record<string, string | number | boolean>,
): void {
  trackEvent({
    name: `chat_${action}`,
    properties,
  });
}

/**
 * Track a crawl event.
 */
export function trackCrawlEvent(
  action: "start" | "complete" | "error" | "cancel",
  properties?: Record<string, string | number | boolean>,
): void {
  trackEvent({
    name: `crawl_${action}`,
    properties,
  });
}

/**
 * Track an error event (non-PII).
 */
export function trackError(
  errorType: string,
  properties?: Record<string, string | number | boolean>,
): void {
  trackEvent({
    name: `error_${errorType}`,
    properties,
  });
}
