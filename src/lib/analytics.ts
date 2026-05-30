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
 */
export function trackPageView(path: string): void {
  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics] Page view: ${path}`);
  }
}

/**
 * Track a custom event.
 *
 * Example:
 * ```ts
 * trackEvent({ name: "chat_message_sent", properties: { model: "llama-4-scout", latency: 3200 } })
 * ```
 */
export function trackEvent(event: AnalyticsEvent): void {
  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics] Event: ${event.name}`, event.properties ?? "");
  }
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
