import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { users, trainingBlocks, readinessChecks, userBaselines } from "@gymapp/db/schema";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import {
  calculateSessionRecovery,
  calculateSessionReadiness,
  getCalibrationPath,
  generateCalibrationPlan,
  estimateOneRepMax,
} from "@gymapp/engine";
import type { Env } from "../types";
import type { PrimaryGoal, BaselineSource } from "@gymapp/types";
import { verifyUserAccess, verifyBodyUserAccess } from "../middleware/authorize";
import { logger as globalLogger } from "../lib/logger";

const userRoutes = new Hono<Env>();

// ============ User Profile ============

// GET /me - Get current user by Clerk ID (from auth middleware)
userRoutes.get(
  "/me",
  async (c) => {
    const clerkId = c.get("clerkId") as string;

    if (!clerkId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (user.length === 0) {
      return c.json({ error: "User not found" }, 404);
    }

    // Get active training block
    const activeBlock = await db
      .select()
      .from(trainingBlocks)
      .where(and(
        eq(trainingBlocks.userId, user[0]!.id),
        eq(trainingBlocks.status, "active")
      ))
      .limit(1);

    return c.json({
      data: {
        ...user[0],
        activeTrainingBlock: activeBlock[0] ?? null,
      },
    });
  }
);

// GET /:id - Get user by ID (requires ownership)
userRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  // Verify the authenticated user owns this resource
  const authResult = await verifyUserAccess(c, id);
  if (!authResult.authorized) {
    return authResult.response;
  }

  return c.json({ data: authResult.user });
});

// POST / - Create user (called after Clerk sign-up)
const createUserSchema = z.object({
  id: z.string().min(1).max(64),
  clerkId: z.string().min(1).max(255),
  email: z.string().email().max(255),
  trainingLevel: z.enum(["beginner", "intermediate", "advanced"]),
  primaryGoal: z.enum(["strength", "hypertrophy", "conditioning"]),
  preferences: z.record(z.unknown()).default({}),
});

userRoutes.post(
  "/",
  zValidator("json", createUserSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Check if user already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, data.clerkId))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: "User already exists" }, 409);
    }

    const result = await db
      .insert(users)
      .values(data)
      .returning();

    const logger = c.get("logger") ?? globalLogger;
    logger.info({ userId: result[0]!.id, clerkId: data.clerkId }, "User created");

    return c.json({ data: result[0] }, 201);
  }
);

// PATCH /:id - Update user preferences
const updateUserSchema = z.object({
  trainingLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  primaryGoal: z.enum(["strength", "hypertrophy", "conditioning"]).optional(),
  preferences: z.record(z.unknown()).optional(),
});

userRoutes.patch(
  "/:id",
  zValidator("json", updateUserSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    // Verify the authenticated user owns this resource
    const authResult = await verifyUserAccess(c, id);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.trainingLevel !== undefined) updateData.trainingLevel = data.trainingLevel;
    if (data.primaryGoal !== undefined) updateData.primaryGoal = data.primaryGoal;
    if (data.preferences !== undefined) updateData.preferences = data.preferences;

    const result = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    const logger = c.get("logger") ?? globalLogger;
    logger.info({ userId: id, fields: Object.keys(data) }, "User profile updated");

    return c.json({ data: result[0] });
  }
);

// ============ Readiness Check-in ============

// Simple readiness check (1-5 scale) - for quick pre-workout check-ins
const readinessSchema = z.object({
  userId: z.string().min(1),
  workoutId: z.string().min(1).optional(),
  sleepQuality: z.number().min(1).max(5),      // 1=poor, 5=excellent
  muscleSoreness: z.number().min(1).max(5),    // 1=none, 5=severe
  stressLevel: z.number().min(1).max(5),       // 1=low, 5=high
  energyLevel: z.number().min(1).max(5),       // 1=exhausted, 5=energized
});

// POST /readiness - Submit pre-workout readiness and get adjustments
userRoutes.post(
  "/readiness",
  zValidator("json", readinessSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Verify the authenticated user owns this resource
    const authResult = await verifyBodyUserAccess(c, data.userId);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Calculate readiness using the simple engine function
    const result = calculateSessionReadiness({
      sleepQuality: data.sleepQuality,
      muscleSoreness: data.muscleSoreness,
      stressLevel: data.stressLevel,
      energyLevel: data.energyLevel,
    });

    // Persist the readiness check for historical analysis
    const checkId = `rc_${nanoid(12)}`;
    await db.insert(readinessChecks).values({
      id: checkId,
      userId: data.userId,
      workoutLogId: data.workoutId ?? null,
      sleepQuality: data.sleepQuality,
      muscleSoreness: data.muscleSoreness,
      stressLevel: data.stressLevel,
      energyLevel: data.energyLevel,
      score: result.score,
      recommendation: result.recommendation,
    });

    const logger = c.get("logger") ?? globalLogger;
    logger.info({ userId: data.userId, score: result.score, recommendation: result.recommendation }, "Readiness check submitted");

    return c.json({
      data: {
        id: checkId,
        score: result.score,
        recommendation: result.recommendation,
        volumeModifier: result.volumeModifier,
        intensityModifier: result.intensityModifier,
        adjustments: result.adjustments,
        reason: result.reason,
      },
    });
  }
);

// Extended readiness check (1-10 scale) - for detailed recovery analysis
const extendedReadinessSchema = z.object({
  userId: z.string().min(1),
  workoutId: z.string().min(1).optional(),
  sleepQuality: z.number().min(1).max(10),
  muscleSoreness: z.number().min(1).max(10),
  stressLevel: z.number().min(1).max(10),
  energyLevel: z.number().min(1).max(10),
  hoursSinceLastWorkout: z.number().min(0).default(48),
  lastWorkoutRpe: z.number().min(1).max(10).optional(),
});

// POST /readiness/extended - Detailed recovery-based readiness (legacy/advanced)
userRoutes.post(
  "/readiness/extended",
  zValidator("json", extendedReadinessSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Verify the authenticated user owns this resource
    const authResult = await verifyBodyUserAccess(c, data.userId);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Calculate recovery adjustments using the comprehensive engine function
    const recoveryDecision = calculateSessionRecovery({
      sleepQuality: data.sleepQuality,
      muscleSoreness: data.muscleSoreness,
      stressLevel: data.stressLevel,
      energyLevel: data.energyLevel,
      hoursSinceLastWorkout: data.hoursSinceLastWorkout,
      lastWorkoutRpe: data.lastWorkoutRpe,
    });

    // Build adjustment messages for the app to display
    const adjustments: string[] = [];

    if (recoveryDecision.recommendation === "rest_day") {
      adjustments.push("Consider taking a rest day");
    } else if (recoveryDecision.recommendation === "light_session") {
      adjustments.push("Light movement only recommended");
    } else {
      if (recoveryDecision.volumeModifier < 1) {
        adjustments.push(`Reduce volume to ${Math.round(recoveryDecision.volumeModifier * 100)}%`);
      }
      if (recoveryDecision.intensityModifier < 1) {
        adjustments.push(`Reduce intensity to ${Math.round(recoveryDecision.intensityModifier * 100)}%`);
      }
    }

    if (adjustments.length === 0) {
      adjustments.push("You're fully recovered - proceed as planned!");
    }

    return c.json({
      data: {
        score: recoveryDecision.readinessScore,
        recommendation: recoveryDecision.recommendation,
        volumeModifier: recoveryDecision.volumeModifier,
        intensityModifier: recoveryDecision.intensityModifier,
        adjustments,
        reason: recoveryDecision.reason,
      },
    });
  }
);

// ============ Baseline Establishment ============

// POST /:id/baselines - Save user baselines
const createBaselinesSchema = z.object({
  baselines: z.array(z.object({
    exerciseId: z.string().min(1),
    weight: z.number().min(1, "Weight must be at least 1"),
    reps: z.number().int().min(1).max(100),
    source: z.enum(["user_input", "calibration", "inferred"]),
  })),
});

userRoutes.post(
  "/:id/baselines",
  zValidator("json", createBaselinesSchema),
  async (c) => {
    const userId = c.req.param("id");
    const { baselines } = c.req.valid("json");

    // Verify the authenticated user owns this resource
    const authResult = await verifyUserAccess(c, userId);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Delete existing baselines for these exercises
    const exerciseIds = baselines.map((b) => b.exerciseId);
    for (const exerciseId of exerciseIds) {
      await db
        .delete(userBaselines)
        .where(
          and(
            eq(userBaselines.userId, userId),
            eq(userBaselines.exerciseId, exerciseId)
          )
        );
    }

    // Insert new baselines
    const now = new Date();
    const baselinesToInsert = baselines.map((b) => ({
      id: `bl_${nanoid(12)}`,
      userId,
      exerciseId: b.exerciseId,
      baselineWeight: b.weight,
      baselineReps: b.reps,
      estimatedE1RM: estimateOneRepMax(b.weight, b.reps),
      source: b.source as BaselineSource,
      establishedAt: now,
    }));

    const inserted = await db
      .insert(userBaselines)
      .values(baselinesToInsert)
      .returning();

    // Update user's baselineComplete flag
    await db
      .update(users)
      .set({ baselineComplete: true, updatedAt: now })
      .where(eq(users.id, userId));

    const logger = c.get("logger") ?? globalLogger;
    logger.info({ userId, exerciseCount: baselines.length }, "User baselines established");

    return c.json({ data: inserted }, 201);
  }
);

// GET /:id/baselines - Get user baselines (requires ownership)
userRoutes.get("/:id/baselines", async (c) => {
  const userId = c.req.param("id");

  // Verify the authenticated user owns this resource
  const authResult = await verifyUserAccess(c, userId);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const baselines = await db
    .select()
    .from(userBaselines)
    .where(eq(userBaselines.userId, userId));

  return c.json({ data: baselines });
});

// GET /:id/calibration-plan - Get calibration plan based on equipment
const calibrationPlanQuerySchema = z.object({
  equipment: z.string().optional(), // comma-separated list
});

userRoutes.get(
  "/:id/calibration-plan",
  zValidator("query", calibrationPlanQuerySchema),
  async (c) => {
    const userId = c.req.param("id");
    const { equipment: equipmentStr } = c.req.valid("query");

    // Verify the authenticated user owns this resource
    const authResult = await verifyUserAccess(c, userId);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Parse equipment list
    const equipment = equipmentStr
      ? (equipmentStr.split(",") as Array<"barbell" | "dumbbell" | "cables" | "machines" | "bodyweight">)
      : [];

    // Determine calibration path
    const path = getCalibrationPath(equipment);

    // Generate plan
    const plan = generateCalibrationPlan(
      path,
      authResult.user.primaryGoal as PrimaryGoal
    );

    return c.json({
      data: {
        path,
        plan,
        needsCalibration: path !== "bodyweight" && path !== "skip",
      },
    });
  }
);

// PATCH /:id/onboarding - Update onboarding status
const updateOnboardingSchema = z.object({
  onboardingComplete: z.boolean().optional(),
  baselineComplete: z.boolean().optional(),
});

userRoutes.patch(
  "/:id/onboarding",
  zValidator("json", updateOnboardingSchema),
  async (c) => {
    const userId = c.req.param("id");
    const data = c.req.valid("json");

    // Verify the authenticated user owns this resource
    const authResult = await verifyUserAccess(c, userId);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.onboardingComplete !== undefined) {
      updateData.onboardingComplete = data.onboardingComplete;
    }
    if (data.baselineComplete !== undefined) {
      updateData.baselineComplete = data.baselineComplete;
    }

    const result = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    const logger = c.get("logger") ?? globalLogger;
    logger.info({ userId, onboardingComplete: data.onboardingComplete, baselineComplete: data.baselineComplete }, "Onboarding status updated");

    return c.json({ data: result[0] });
  }
);

export { userRoutes };
