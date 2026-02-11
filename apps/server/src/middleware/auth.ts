import type { Context, Next } from "hono";
import { verifyToken } from "@clerk/backend";
import { logger } from "../lib/logger";
import { config } from "../config";
import type { Env } from "../types";

/**
 * Clerk JWT verification middleware for Hono
 *
 * Verifies the Bearer token from the Authorization header and sets
 * the authenticated user's ID in the context.
 *
 * Protected routes will have access to:
 * - c.get("userId") - The Clerk user ID (sub claim)
 * - c.get("clerkId") - Same as userId (alias for compatibility)
 */
export async function authMiddleware(c: Context<Env>, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  const token = authHeader.slice(7);

  if (!token) {
    return c.json({ error: "Missing token" }, 401);
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: config.CLERK_SECRET_KEY,
    });

    // Set user info in context for downstream handlers
    c.set("userId", payload.sub);
    c.set("clerkId", payload.sub);

    await next();
  } catch (err) {
    // Use request-scoped logger if available, otherwise use global logger
    const reqLogger = c.get("logger") ?? logger;
    reqLogger.warn({ err }, "Authentication failed");
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

/**
 * Optional auth middleware - doesn't fail if no token present
 * Useful for endpoints that work with or without authentication
 */
export async function optionalAuthMiddleware(c: Context<Env>, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    if (token) {
      try {
        const payload = await verifyToken(token, {
          secretKey: config.CLERK_SECRET_KEY,
        });

        c.set("userId", payload.sub);
        c.set("clerkId", payload.sub);
      } catch {
        // Token invalid but we continue without auth
        // Clear any potentially set values
        c.set("userId", undefined);
        c.set("clerkId", undefined);
      }
    }
  }

  await next();
}
