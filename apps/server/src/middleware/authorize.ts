import type { Context } from "hono";
import { db } from "@gymapp/db";
import { users, trainingBlocks, workouts, workoutLogs } from "@gymapp/db/schema";
import { eq } from "drizzle-orm";
import type { Env } from "../types";
import { logger as globalLogger } from "../lib/logger";

/**
 * Get the authenticated user from the database
 * Returns the user record or null if not found
 */
export async function getAuthenticatedUser(c: Context<Env>) {
  const clerkId = c.get("clerkId");

  if (!clerkId) {
    return null;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Verify the authenticated user owns the resource
 * Returns an error response if not authorized, or null if authorized
 */
export function requireOwnership(
  c: Context<Env>,
  resourceUserId: string,
  authenticatedUserId: string
): Response | null {
  if (resourceUserId !== authenticatedUserId) {
    return c.json({ error: "Forbidden: You can only access your own data" }, 403);
  }
  return null;
}

/**
 * Helper to get user by their database ID and verify ownership
 * Combines common patterns: get user, check exists, verify ownership
 */
export async function getUserByClerkId(clerkId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Check if the authenticated user matches the requested user ID
 * Used for routes like GET /:id, PATCH /:id, etc.
 */
export async function verifyUserAccess(
  c: Context<Env>,
  requestedUserId: string
): Promise<{ authorized: false; response: Response } | { authorized: true; user: typeof users.$inferSelect }> {
  const clerkId = c.get("clerkId");

  if (!clerkId) {
    return {
      authorized: false,
      response: c.json({ error: "Not authenticated" }, 401),
    };
  }

  const authenticatedUser = await getUserByClerkId(clerkId);

  if (!authenticatedUser) {
    return {
      authorized: false,
      response: c.json({ error: "User not found" }, 404),
    };
  }

  if (authenticatedUser.id !== requestedUserId) {
    const logger = c.get("logger") ?? globalLogger;
    logger.warn({ requestedUserId, authenticatedUserId: authenticatedUser.id }, "User access denied");
    return {
      authorized: false,
      response: c.json({ error: "Forbidden: You can only access your own data" }, 403),
    };
  }

  return {
    authorized: true,
    user: authenticatedUser,
  };
}

/**
 * Verify the authenticated user for body-based userId
 * For routes like POST /readiness where userId is in the request body
 */
export async function verifyBodyUserAccess(
  c: Context<Env>,
  bodyUserId: string
): Promise<{ authorized: false; response: Response } | { authorized: true; user: typeof users.$inferSelect }> {
  return verifyUserAccess(c, bodyUserId);
}

/**
 * Verify the authenticated user owns a training block
 */
export async function verifyTrainingBlockAccess(
  c: Context<Env>,
  trainingBlockId: string
): Promise<
  | { authorized: false; response: Response }
  | { authorized: true; user: typeof users.$inferSelect; trainingBlock: typeof trainingBlocks.$inferSelect }
> {
  const clerkId = c.get("clerkId");

  if (!clerkId) {
    return {
      authorized: false,
      response: c.json({ error: "Not authenticated" }, 401),
    };
  }

  const authenticatedUser = await getUserByClerkId(clerkId);

  if (!authenticatedUser) {
    return {
      authorized: false,
      response: c.json({ error: "User not found" }, 404),
    };
  }

  const block = await db
    .select()
    .from(trainingBlocks)
    .where(eq(trainingBlocks.id, trainingBlockId))
    .limit(1);

  if (!block[0]) {
    return {
      authorized: false,
      response: c.json({ error: "Training block not found" }, 404),
    };
  }

  if (block[0].userId !== authenticatedUser.id) {
    const logger = c.get("logger") ?? globalLogger;
    logger.warn({ trainingBlockId, userId: authenticatedUser.id }, "Training block access denied");
    return {
      authorized: false,
      response: c.json({ error: "Forbidden: You can only access your own training blocks" }, 403),
    };
  }

  return {
    authorized: true,
    user: authenticatedUser,
    trainingBlock: block[0],
  };
}

/**
 * Verify the authenticated user owns a workout (via training block)
 */
export async function verifyWorkoutAccess(
  c: Context<Env>,
  workoutId: string
): Promise<
  | { authorized: false; response: Response }
  | { authorized: true; user: typeof users.$inferSelect; workout: typeof workouts.$inferSelect }
> {
  const clerkId = c.get("clerkId");

  if (!clerkId) {
    return {
      authorized: false,
      response: c.json({ error: "Not authenticated" }, 401),
    };
  }

  const authenticatedUser = await getUserByClerkId(clerkId);

  if (!authenticatedUser) {
    return {
      authorized: false,
      response: c.json({ error: "User not found" }, 404),
    };
  }

  // Get workout with its training block
  const workout = await db
    .select()
    .from(workouts)
    .where(eq(workouts.id, workoutId))
    .limit(1);

  if (!workout[0]) {
    return {
      authorized: false,
      response: c.json({ error: "Workout not found" }, 404),
    };
  }

  // Verify the training block belongs to the user
  const block = await db
    .select()
    .from(trainingBlocks)
    .where(eq(trainingBlocks.id, workout[0].trainingBlockId))
    .limit(1);

  if (!block[0] || block[0].userId !== authenticatedUser.id) {
    const logger = c.get("logger") ?? globalLogger;
    logger.warn({ workoutId, userId: authenticatedUser.id }, "Workout access denied");
    return {
      authorized: false,
      response: c.json({ error: "Forbidden: You can only access your own workouts" }, 403),
    };
  }

  return {
    authorized: true,
    user: authenticatedUser,
    workout: workout[0],
  };
}

/**
 * Verify the authenticated user owns a workout log
 */
export async function verifyWorkoutLogAccess(
  c: Context<Env>,
  workoutLogId: string
): Promise<
  | { authorized: false; response: Response }
  | { authorized: true; user: typeof users.$inferSelect; workoutLog: typeof workoutLogs.$inferSelect }
> {
  const clerkId = c.get("clerkId");

  if (!clerkId) {
    return {
      authorized: false,
      response: c.json({ error: "Not authenticated" }, 401),
    };
  }

  const authenticatedUser = await getUserByClerkId(clerkId);

  if (!authenticatedUser) {
    return {
      authorized: false,
      response: c.json({ error: "User not found" }, 404),
    };
  }

  const log = await db
    .select()
    .from(workoutLogs)
    .where(eq(workoutLogs.id, workoutLogId))
    .limit(1);

  if (!log[0]) {
    return {
      authorized: false,
      response: c.json({ error: "Workout log not found" }, 404),
    };
  }

  if (log[0].userId !== authenticatedUser.id) {
    const logger = c.get("logger") ?? globalLogger;
    logger.warn({ workoutLogId, userId: authenticatedUser.id }, "Workout log access denied");
    return {
      authorized: false,
      response: c.json({ error: "Forbidden: You can only access your own workout logs" }, 403),
    };
  }

  return {
    authorized: true,
    user: authenticatedUser,
    workoutLog: log[0],
  };
}

/**
 * Get the authenticated user from the context
 * Used when we need the user but don't need to verify a specific resource
 */
export async function getAuthenticatedUserFromContext(
  c: Context<Env>
): Promise<{ authorized: false; response: Response } | { authorized: true; user: typeof users.$inferSelect }> {
  const clerkId = c.get("clerkId");

  if (!clerkId) {
    return {
      authorized: false,
      response: c.json({ error: "Not authenticated" }, 401),
    };
  }

  const authenticatedUser = await getUserByClerkId(clerkId);

  if (!authenticatedUser) {
    return {
      authorized: false,
      response: c.json({ error: "User not found" }, 404),
    };
  }

  return {
    authorized: true,
    user: authenticatedUser,
  };
}
