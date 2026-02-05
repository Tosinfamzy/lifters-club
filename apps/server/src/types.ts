import type { Context } from "hono";
import type { Logger } from "./lib/logger";

/**
 * Environment variables available in context
 */
export type Env = {
  Variables: {
    /** Unique request ID for tracing */
    requestId: string;
    /** Authenticated user's ID */
    userId: string | undefined;
    /** Clerk ID (alias for userId) */
    clerkId: string | undefined;
    /** Request-scoped logger with context */
    logger: Logger;
  };
};

/**
 * Typed context with auth variables
 */
export type AppContext = Context<Env>;

/** @deprecated Use AppContext instead */
export type AuthContext = Context<Env>;

/**
 * Helper to get authenticated user ID from context
 * Returns undefined if not authenticated
 */
export function getAuthClerkId(c: Context<Env>): string | undefined {
  return c.get("clerkId");
}

/**
 * Helper to get request ID from context
 */
export function getRequestId(c: Context<Env>): string {
  return c.get("requestId");
}
