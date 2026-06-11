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
  } catch {
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

/**
 * Check rate limit for a chat request based on user role.
 *
 * @param identifier - Unique user identifier (userId or IP)
 * @param role - User role for limit tier
 * @returns Rate limit result or null if rate limiting is not configured
 */
export async function checkChatRateLimit(
  identifier: string,
  role: "user" | "admin" | "superadmin" | "anonymous" = "user",
): Promise<RateLimitResult | null> {
  const limiter =
    role === "admin" || role === "superadmin"
      ? adminLimiter
      : role === "anonymous"
        ? anonLimiter
        : userLimiter;

  if (!limiter) {
    console.warn("[RATE-LIMIT] Rate limiting not configured — allowing through");
    return null;
  }

  try {
    return await limiter.limit(identifier);
  } catch (error) {
    console.error("[RATE-LIMIT] Redis error — allowing through:", error);
    return null;
  }
}

/**
 * Get remaining requests for a user — used to show in UI.
 */
export async function getChatRateLimitRemaining(
  identifier: string,
  role: "user" | "admin" | "superadmin" | "anonymous" = "user",
): Promise<{ remaining: number; limit: number; configured: boolean }> {
  const limiter =
    role === "admin" || role === "superadmin"
      ? adminLimiter
      : role === "anonymous"
        ? anonLimiter
        : userLimiter;

  if (!limiter) {
    return { remaining: -1, limit: -1, configured: false };
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      remaining: result.remaining,
      limit: result.limit,
      configured: true,
    };
  } catch {
    return { remaining: -1, limit: -1, configured: false };
  }
}
