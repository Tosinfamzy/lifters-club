import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { pushTokens, users } from "@gymapp/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Env } from "../types";

const notificationRoutes = new Hono<Env>();

// ============ Push Token Management ============

// POST /push-tokens - Register a push token
const registerTokenSchema = z.object({
  userId: z.string().min(1).max(64),
  token: z.string().min(1),
  platform: z.enum(["web", "ios", "android"]),
  deviceId: z.string().max(255).optional(),
});

notificationRoutes.post(
  "/push-tokens",
  zValidator("json", registerTokenSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Verify user exists
    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);

    if (user.length === 0) {
      return c.json({ error: "User not found" }, 404);
    }

    // Check if token already exists for this user/device
    const existing = await db
      .select({ id: pushTokens.id })
      .from(pushTokens)
      .where(
        and(
          eq(pushTokens.userId, data.userId),
          eq(pushTokens.token, data.token)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing token
      const result = await db
        .update(pushTokens)
        .set({
          isActive: 1,
          updatedAt: new Date(),
        })
        .where(eq(pushTokens.id, existing[0]!.id))
        .returning();

      return c.json({ data: result[0] });
    }

    // Create new token
    const result = await db
      .insert(pushTokens)
      .values({
        id: nanoid(),
        userId: data.userId,
        token: data.token,
        platform: data.platform,
        deviceId: data.deviceId,
      })
      .returning();

    return c.json({ data: result[0] }, 201);
  }
);

// DELETE /push-tokens/:token - Unregister a push token
notificationRoutes.delete("/push-tokens/:token", async (c) => {
  const token = c.req.param("token");

  const result = await db
    .update(pushTokens)
    .set({
      isActive: 0,
      updatedAt: new Date(),
    })
    .where(eq(pushTokens.token, token))
    .returning();

  if (result.length === 0) {
    return c.json({ error: "Token not found" }, 404);
  }

  return c.json({ message: "Token deactivated" });
});

// GET /push-tokens - Get user's registered tokens (for debugging)
notificationRoutes.get("/push-tokens", async (c) => {
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  const tokens = await db
    .select({
      id: pushTokens.id,
      platform: pushTokens.platform,
      deviceId: pushTokens.deviceId,
      isActive: pushTokens.isActive,
      createdAt: pushTokens.createdAt,
    })
    .from(pushTokens)
    .where(and(eq(pushTokens.userId, userId), eq(pushTokens.isActive, 1)));

  return c.json({ data: tokens });
});

export { notificationRoutes };
