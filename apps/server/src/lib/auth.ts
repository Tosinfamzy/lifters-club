/**
 * Authentication and Authorization Utilities
 */

import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

/**
 * Verify that the authenticated user has access to the requested resource.
 * If userId is provided in the request, it must match the authenticated user's clerkId.
 *
 * @param c - Hono context with clerkId set by auth middleware
 * @param userId - Optional userId from request body/query
 * @returns The verified userId (clerkId from auth)
 * @throws HTTPException 403 if userId doesn't match authenticated user
 */
export function verifyUserAccess(c: Context, userId?: string): string {
  const clerkId = c.get("clerkId") as string | undefined;

  if (!clerkId) {
    throw new HTTPException(401, { message: "Authentication required" });
  }

  if (userId && userId !== clerkId) {
    throw new HTTPException(403, {
      message: "Access denied: You can only access your own resources",
    });
  }

  return clerkId;
}

/**
 * Get the authenticated user's ID from context.
 * Throws if not authenticated.
 *
 * @param c - Hono context
 * @returns The authenticated user's clerkId
 * @throws HTTPException 401 if not authenticated
 */
export function getAuthenticatedUserId(c: Context): string {
  const clerkId = c.get("clerkId") as string | undefined;

  if (!clerkId) {
    throw new HTTPException(401, { message: "Authentication required" });
  }

  return clerkId;
}
