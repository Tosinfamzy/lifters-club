import type { Context } from "hono";

/**
 * Environment variables available in context
 */
export type Env = {
  Variables: {
    userId: string | undefined;
    clerkId: string | undefined;
  };
};

/**
 * Typed context with auth variables
 */
export type AuthContext = Context<Env>;

/**
 * Helper to get authenticated user ID from context
 * Returns undefined if not authenticated
 */
export function getAuthClerkId(c: Context<Env>): string | undefined {
  return c.get("clerkId");
}
