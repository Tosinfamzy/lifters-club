import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { users, trainingBlocks, readinessChecks, userBaselines, athleteConstraints, permanentSubstitutions } from "@gymapp/db/schema";
import { athleteConstraintsSchema, permanentSubstitutionSchema } from "@gymapp/validation";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import {
  calculateSessionRecovery,
  calculateSessionReadiness,
  getCalibrationPath,
  generateCalibrationPlan,
  processCalibrationResults,
  estimateOneRepMax,
} from "@gymapp/engine";
import type { Env } from "../types";
import type { PrimaryGoal, BaselineSource, PermanentSubstitution, SubstitutionReason } from "@gymapp/types";
import { verifyUserAccess, verifyBodyUserAccess, getUserByClerkId } from "../middleware/authorize";
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

// POST /:id/calibration-results - Derive and save baselines from a completed
// calibration workout. Unlike POST /:id/baselines (which takes finished
// baselines), this takes the raw logged sets and runs the engine to pick the
// best set per exercise and estimate a 1RM.
const calibrationResultsSchema = z.object({
  sets: z
    .array(
      z.object({
        exerciseId: z.string().min(1),
        weight: z.number().min(1, "Weight must be at least 1"),
        reps: z.number().int().min(1).max(100),
      })
    )
    .min(1, "At least one calibration set is required"),
  targetReps: z.number().int().min(1).max(100).optional(),
});

userRoutes.post(
  "/:id/calibration-results",
  zValidator("json", calibrationResultsSchema),
  async (c) => {
    const userId = c.req.param("id");
    const { sets, targetReps } = c.req.valid("json");

    // Verify the authenticated user owns this resource
    const authResult = await verifyUserAccess(c, userId);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Engine picks the best set per exercise and estimates a 1RM
    const results = processCalibrationResults(sets, targetReps);

    const now = new Date();

    // Replace any existing baselines for the calibrated exercises
    for (const result of results) {
      await db
        .delete(userBaselines)
        .where(
          and(
            eq(userBaselines.userId, userId),
            eq(userBaselines.exerciseId, result.exerciseId)
          )
        );
    }

    const baselinesToInsert = results.map((r) => ({
      id: `bl_${nanoid(12)}`,
      userId,
      exerciseId: r.exerciseId,
      baselineWeight: r.baselineWeight,
      baselineReps: r.baselineReps,
      estimatedE1RM: r.estimatedE1RM,
      source: "calibration" as BaselineSource,
      establishedAt: now,
    }));

    const inserted = await db
      .insert(userBaselines)
      .values(baselinesToInsert)
      .returning();

    // Mark onboarding baselines as complete
    await db
      .update(users)
      .set({ baselineComplete: true, updatedAt: now })
      .where(eq(users.id, userId));

    const logger = c.get("logger") ?? globalLogger;
    logger.info(
      { userId, exerciseCount: results.length, setCount: sets.length },
      "Calibration results processed into baselines"
    );

    return c.json({ data: { baselines: inserted, results } }, 201);
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

// GET /:id/calibration-plan - Get calibration plan based on equipment + goal.
// A plan is stateless (pure function of equipment + goal), so this must work
// during onboarding *before* the user row exists. Require auth, but don't
// require an existing user record or ownership.
const calibrationPlanQuerySchema = z.object({
  equipment: z.string().optional(), // comma-separated list
  goal: z.enum(["strength", "hypertrophy", "conditioning"]).optional(),
});

userRoutes.get(
  "/:id/calibration-plan",
  zValidator("query", calibrationPlanQuerySchema),
  async (c) => {
    const clerkId = c.get("clerkId");
    if (!clerkId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const { equipment: equipmentStr, goal } = c.req.valid("query");

    // Prefer the goal passed by the client (known during onboarding); fall back
    // to the user's stored goal if they already exist, then a sensible default.
    let primaryGoal = goal as PrimaryGoal | undefined;
    if (!primaryGoal) {
      const existingUser = await getUserByClerkId(clerkId);
      primaryGoal = (existingUser?.primaryGoal as PrimaryGoal | undefined) ?? "hypertrophy";
    }

    // Parse equipment list
    const equipment = equipmentStr
      ? (equipmentStr.split(",") as Array<"barbell" | "dumbbell" | "cables" | "machines" | "bodyweight">)
      : [];

    // Determine calibration path
    const path = getCalibrationPath(equipment);

    // Generate plan
    const plan = generateCalibrationPlan(path, primaryGoal);

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

// ============ Athlete Constraint Profile ============

// Empty profile returned when a user has no saved constraints yet.
const EMPTY_CONSTRAINT_PROFILE = {
  equipment: [],
  mobility: [],
  grip: [],
  injuries: [],
  bannedExerciseIds: [],
  correctivePriorityExerciseIds: [],
} as const;

// GET /:id/constraints - Get the athlete's constraint profile (requires ownership)
userRoutes.get("/:id/constraints", async (c) => {
  const userId = c.req.param("id");

  // Verify the authenticated user owns this resource
  const authResult = await verifyUserAccess(c, userId);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const existing = await db
    .select()
    .from(athleteConstraints)
    .where(eq(athleteConstraints.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    // No profile yet — return an empty default so clients always get a shape.
    return c.json({ data: { userId, ...EMPTY_CONSTRAINT_PROFILE } });
  }

  return c.json({ data: existing[0] });
});

// PUT /:id/constraints - Upsert the athlete's constraint profile (requires ownership)
userRoutes.put(
  "/:id/constraints",
  zValidator("json", athleteConstraintsSchema),
  async (c) => {
    const userId = c.req.param("id");
    const data = c.req.valid("json");

    // Verify the authenticated user owns this resource
    const authResult = await verifyUserAccess(c, userId);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Upsert by userId via delete-then-insert (one row per user), mirroring
    // the baselines handler. Keeps the write idempotent.
    const now = new Date();
    await db.delete(athleteConstraints).where(eq(athleteConstraints.userId, userId));

    const [inserted] = await db
      .insert(athleteConstraints)
      .values({
        id: `ac_${nanoid(12)}`,
        userId,
        equipment: data.equipment,
        mobility: data.mobility,
        grip: data.grip,
        injuries: data.injuries,
        bannedExerciseIds: data.bannedExerciseIds,
        correctivePriorityExerciseIds: data.correctivePriorityExerciseIds,
        updatedAt: now,
      })
      .returning();

    const logger = c.get("logger") ?? globalLogger;
    logger.info(
      {
        userId,
        equipmentCount: data.equipment.length,
        mobilityCount: data.mobility.length,
        bannedCount: data.bannedExerciseIds.length,
      },
      "Athlete constraint profile saved"
    );

    return c.json({ data: inserted });
  }
);

// ============ Permanent Substitutions ============

// Map a DB row to the `PermanentSubstitution` shape (one row per swap).
function toPermanentSubstitution(row: typeof permanentSubstitutions.$inferSelect): PermanentSubstitution {
  return {
    originalExerciseId: row.originalExerciseId,
    substituteExerciseId: row.substituteExerciseId,
    reason: row.reason as SubstitutionReason,
    note: row.note ?? undefined,
    confirmedAt: row.confirmedAt.toISOString(),
    weightCarries: row.weightCarries,
  };
}

// GET /:id/substitutions - List the athlete's persisted swaps (requires ownership)
userRoutes.get("/:id/substitutions", async (c) => {
  const userId = c.req.param("id");

  // Verify the authenticated user owns this resource
  const authResult = await verifyUserAccess(c, userId);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const rows = await db
    .select()
    .from(permanentSubstitutions)
    .where(eq(permanentSubstitutions.userId, userId));

  return c.json({ data: rows.map(toPermanentSubstitution) });
});

// PUT /:id/substitutions - Upsert one swap, keyed by (userId, originalExerciseId).
// Repeated saves for the same original replace it (one row per original).
userRoutes.put(
  "/:id/substitutions",
  zValidator("json", permanentSubstitutionSchema),
  async (c) => {
    const userId = c.req.param("id");
    const data = c.req.valid("json");

    // Verify the authenticated user owns this resource
    const authResult = await verifyUserAccess(c, userId);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Upsert by (userId, originalExerciseId) via delete-then-insert, mirroring
    // the constraints/baselines handlers. Keeps the write idempotent.
    const now = new Date();
    await db
      .delete(permanentSubstitutions)
      .where(
        and(
          eq(permanentSubstitutions.userId, userId),
          eq(permanentSubstitutions.originalExerciseId, data.originalExerciseId)
        )
      );

    const [inserted] = await db
      .insert(permanentSubstitutions)
      .values({
        id: `ps_${nanoid(12)}`,
        userId,
        originalExerciseId: data.originalExerciseId,
        substituteExerciseId: data.substituteExerciseId,
        reason: data.reason,
        note: data.note ?? null,
        weightCarries: data.weightCarries,
        // Default to now when the client omits it (e.g. confirmed server-side).
        confirmedAt: data.confirmedAt ? new Date(data.confirmedAt) : now,
        updatedAt: now,
      })
      .returning();

    const logger = c.get("logger") ?? globalLogger;
    logger.info(
      {
        userId,
        originalExerciseId: data.originalExerciseId,
        substituteExerciseId: data.substituteExerciseId,
        reason: data.reason,
      },
      "Permanent substitution saved"
    );

    return c.json({ data: toPermanentSubstitution(inserted!) });
  }
);

// DELETE /:id/substitutions/:originalExerciseId - The explicit "un-swap".
userRoutes.delete("/:id/substitutions/:originalExerciseId", async (c) => {
  const userId = c.req.param("id");
  const originalExerciseId = c.req.param("originalExerciseId");

  // Verify the authenticated user owns this resource
  const authResult = await verifyUserAccess(c, userId);
  if (!authResult.authorized) {
    return authResult.response;
  }

  await db
    .delete(permanentSubstitutions)
    .where(
      and(
        eq(permanentSubstitutions.userId, userId),
        eq(permanentSubstitutions.originalExerciseId, originalExerciseId)
      )
    );

  const logger = c.get("logger") ?? globalLogger;
  logger.info({ userId, originalExerciseId }, "Permanent substitution removed");

  return c.json({ message: "Permanent substitution removed" });
});

export { userRoutes };
