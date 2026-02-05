import type { Context, Next } from "hono";
import { config } from "../config";

/**
 * Simple in-memory rate limiter using sliding window algorithm
 *
 * For production at scale, replace with Redis-backed solution:
 * - Upstash Rate Limit: https://github.com/upstash/ratelimit
 * - Redis with sliding window: https://redis.io/commands/incr
 *
 * This implementation is suitable for single-instance deployments
 * and provides the foundation for easy upgrade to distributed rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store - cleared on restart
const store = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get client identifier for rate limiting
 * Uses X-Forwarded-For header (for proxied requests) or falls back to connection info
 */
function getClientId(c: Context): string {
  // Check for forwarded IP (common with proxies/load balancers)
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    // Take first IP in chain (original client)
    const firstIp = forwarded.split(",")[0];
    return firstIp?.trim() ?? "unknown";
  }

  // Check for real IP header (Cloudflare, nginx)
  const realIp = c.req.header("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback - in development this might be localhost
  return "unknown";
}

export interface RateLimitConfig {
  /** Maximum requests per window */
  max: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Custom key generator (default: IP-based) */
  keyGenerator?: (c: Context) => string;
  /** Skip rate limiting for certain requests */
  skip?: (c: Context) => boolean;
}

const defaultConfig: RateLimitConfig = {
  max: config.RATE_LIMIT_MAX,
  windowMs: config.RATE_LIMIT_WINDOW_MS,
};

/**
 * Rate limiting middleware factory
 *
 * @example
 * // Use defaults from environment
 * app.use("*", rateLimiter());
 *
 * @example
 * // Custom config for specific routes
 * app.use("/api/auth/*", rateLimiter({ max: 10, windowMs: 60000 }));
 */
export function rateLimiter(options: Partial<RateLimitConfig> = {}) {
  const cfg = { ...defaultConfig, ...options };

  return async function rateLimitMiddleware(c: Context, next: Next) {
    // Allow skipping rate limit for certain requests
    if (cfg.skip?.(c)) {
      return next();
    }

    const key = cfg.keyGenerator?.(c) ?? getClientId(c);
    const now = Date.now();

    let entry = store.get(key);

    // Initialize or reset if window expired
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + cfg.windowMs,
      };
    }

    entry.count++;
    store.set(key, entry);

    // Calculate remaining requests and reset time
    const remaining = Math.max(0, cfg.max - entry.count);
    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);

    // Set rate limit headers (standard headers)
    c.header("X-RateLimit-Limit", String(cfg.max));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(resetSeconds));

    // Check if limit exceeded
    if (entry.count > cfg.max) {
      c.header("Retry-After", String(resetSeconds));
      return c.json(
        {
          error: "Too many requests",
          retryAfter: resetSeconds,
        },
        429
      );
    }

    return next();
  };
}

/**
 * Stricter rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
export const authRateLimiter = rateLimiter({
  max: 10,
  windowMs: 60 * 1000, // 10 requests per minute
});

/**
 * Rate limiter for public read endpoints
 * More permissive for general API usage
 */
export const publicRateLimiter = rateLimiter({
  max: 200,
  windowMs: 60 * 1000, // 200 requests per minute
});
