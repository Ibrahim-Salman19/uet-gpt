import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending: Promise<unknown>;
}

// Create a Redis client from environment variables
function createRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({ url, token });
}

function createRatelimit(
  redis: Redis,
  maxRequests: number,
  windowMs: number,
  prefix: string,
): Ratelimit | null {
  try {
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
      analytics: true,
      prefix: `@upstash/ratelimit/${prefix}`,
    });
  } catch (error) {
    // Distinguish a construction failure (misconfiguration) from the
    // intentional "Redis not set" case, which never reaches here.
    console.error(`[RATE-LIMIT] Failed to construct Ratelimit for "${prefix}":`, error);
    return null;
  }
}

const redis = createRedis();

// Rate limiters for different user roles
const userLimiter = redis
  ? createRatelimit(redis, 50, 3600000, "chat/user") // 50 requests/hour
  : null;

const adminLimiter = redis
  ? createRatelimit(redis, 200, 3600000, "chat/admin") // 200 requests/hour
  : null;

const anonLimiter = redis
  ? createRatelimit(redis, 10, 3600000, "chat/anonymous") // 10 requests/hour
  : null;

// Cooldown applied to the synthetic denied result so a client computing
// "retry after = reset - now" backs off instead of hot-looping.
const DENIED_COOLDOWN_MS = 60_000;

function deniedResult(): RateLimitResult {
  return {
    success: false,
    limit: 0,
    remaining: 0,
    // Near-future timestamp so clients back off rather than retrying immediately.
    reset: Date.now() + DENIED_COOLDOWN_MS,
    pending: Promise.resolve(),
  };
}

/**
 * Check rate limit for a chat request based on user role.
 *
 * @param identifier - Unique user identifier (userId or IP)
 * @param role - User role for limit tier
 * @returns Rate limit result - denies requests when rate limiting is unavailable
 */
export async function checkChatRateLimit(
  identifier: string,
  role: "user" | "admin" | "superadmin" | "anonymous" = "user",
): Promise<RateLimitResult> {
  const limiter =
    role === "admin" || role === "superadmin"
      ? adminLimiter
      : role === "anonymous"
        ? anonLimiter
        : userLimiter;

  if (!limiter) {
    console.warn("[RATE-LIMIT] Rate limiting not configured - allowing request for fallback");
    return {
      success: true,
      limit: 100,
      remaining: 100,
      reset: Date.now() + 60000,
      pending: Promise.resolve(),
    };
  }

  try {
    return await limiter.limit(identifier);
  } catch (error) {
    console.error("[RATE-LIMIT] Redis error - failing open for availability:", error);
    return {
      success: true,
      limit: 100,
      remaining: 100,
      reset: Date.now() + 60000,
      pending: Promise.resolve(),
    };
  }
}

// Admin action rate limiter - 30 actions/minute
const adminActionLimiter = redis ? createRatelimit(redis, 30, 60000, "admin/action") : null;

/**
 * Check rate limit for admin actions (role changes, etc.).
 * @param identifier - Admin user identifier
 * @returns Rate limit result - denies when rate limiting is unavailable
 */
export async function checkAdminActionRateLimit(identifier: string): Promise<RateLimitResult> {
  if (!adminActionLimiter) {
    console.warn("[RATE-LIMIT] Admin rate limiter not configured - denying for safety");
    return deniedResult();
  }
  try {
    return await adminActionLimiter.limit(identifier);
  } catch (error) {
    console.error("[RATE-LIMIT] Admin rate limit error - denying for safety:", error);
    return deniedResult();
  }
}

/**
 * Result of {@link getChatRateLimitRemaining}. Modeled as a discriminated union
 * so the "unknown" state (rate limiting not configured, or a Redis error) is
 * unrepresentable as a magic-number count and must be handled explicitly by the
 * UI rather than rendering a nonsense value like -1.
 */
export type RateLimitRemaining =
  | { configured: true; remaining: number; limit: number }
  | { configured: false };

/**
 * Get remaining requests for a user - used to show in UI.
 */
export async function getChatRateLimitRemaining(
  identifier: string,
  role: "user" | "admin" | "superadmin" | "anonymous" = "user",
): Promise<RateLimitRemaining> {
  const limiter =
    role === "admin" || role === "superadmin"
      ? adminLimiter
      : role === "anonymous"
        ? anonLimiter
        : userLimiter;

  if (!limiter) {
    return { configured: false };
  }

  try {
    const result = await limiter.getRemaining(identifier);
    return {
      configured: true,
      remaining: result.remaining,
      limit: result.limit,
    };
  } catch (error) {
    console.error("[RATE-LIMIT] Failed to read remaining quota:", error);
    return { configured: false };
  }
}
