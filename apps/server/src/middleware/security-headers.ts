import type { Context, Next } from "hono";
import { config } from "../config";
import type { Env } from "../types";

/**
 * Security headers middleware
 *
 * Sets recommended security headers to protect against common web vulnerabilities:
 * - XSS attacks
 * - Clickjacking
 * - MIME type sniffing
 * - Man-in-the-middle attacks (via HSTS)
 *
 * Reference: https://owasp.org/www-project-secure-headers/
 */
export async function securityHeaders(c: Context, next: Next) {
  await next();

  // Strict-Transport-Security (HSTS)
  // Forces HTTPS for all future requests
  // Only set in production to avoid issues with local development
  if (config.NODE_ENV === "production") {
    c.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Prevent MIME type sniffing
  // Stops browsers from interpreting files as different MIME types
  c.header("X-Content-Type-Options", "nosniff");

  // Clickjacking protection
  // Prevents the page from being embedded in iframes
  c.header("X-Frame-Options", "DENY");

  // XSS Protection (legacy, but still useful for older browsers)
  c.header("X-XSS-Protection", "1; mode=block");

  // Referrer Policy
  // Controls how much referrer information is included with requests
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions Policy (formerly Feature-Policy)
  // Restricts which browser features can be used
  c.header(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  );

  // Content Security Policy (CSP)
  // For API servers, we restrict everything since we only serve JSON
  // If serving HTML/docs, this would need to be more permissive
  if (config.NODE_ENV === "production") {
    c.header(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'"
    );
  }

  // Prevent caching of sensitive data
  // API responses with user data shouldn't be cached by proxies
  if (c.req.header("Authorization")) {
    c.header("Cache-Control", "no-store, no-cache, must-revalidate, private");
  }
}

/**
 * Request ID middleware
 * Adds a unique request ID for tracing requests through logs
 */
export async function requestId(c: Context<Env>, next: Next) {
  const id = c.req.header("x-request-id") ?? crypto.randomUUID();
  c.set("requestId", id);
  c.header("X-Request-Id", id);
  await next();
}
