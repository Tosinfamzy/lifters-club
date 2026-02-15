import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { decisions, decisionOutcomes } from "@gymapp/db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  calculateLoadProgression,
  calculateVolumeAdjustment,
  calculateDeloadNeed,
  calculateExerciseRotation,
  calculateSessionRecovery,
  calculateMissedSessionHandling,
  generateWeeklyPlan,
  calculatePerformanceTrend,
  ENGINE_VERSION,
} from "@gymapp/engine";
import type { DecisionAccuracyStats, OverrideReason, DecisionType } from "@gymapp/types";
import type { Env } from "../types";
import { getAuthenticatedUserFromContext } from "../middleware/authorize";
import { verifyUserAccess as verifyRequestUserId } from "../lib/auth";
import { logger as globalLogger } from "../lib/logger";

const decisionRoutes = new Hono<Env>();

// Helper to generate decision ID
function generateDecisionId(): string {
  return `dec_${nanoid(12)}`;
}

// Helper to persist decision
async function persistDecision(
  type: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  reasoning: string,
  userId?: string,
  workoutId?: string
) {
  if (!userId) return null;

  const id = generateDecisionId();
  const [inserted] = await db
    .insert(decisions)
    .values({
      id,
      userId,
      workoutId: workoutId ?? null,
      type,
      input,
      output,
      reasoning,
      algorithmVersion: ENGINE_VERSION,
    })
    .returning();

  return inserted;
}

// ============ Outcome Reasons ============

const OVERRIDE_REASONS = [
  "felt_too_heavy",
  "felt_too_light",
  "equipment_unavailable",
  "time_constraint",
  "injury_concern",
  "other",
] as const;

// ============ Decision History ============

const historyQuerySchema = z.object({
  userId: z.string().min(1).optional(), // Now optional - will use authenticated user if not provided
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});

decisionRoutes.get(
  "/history",
  zValidator("query", historyQuerySchema),
  async (c) => {
    const { userId: queryUserId, type, limit, offset } = c.req.valid("query");

    // Get authenticated user
    const authResult = await getAuthenticatedUserFromContext(c);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // If userId provided in query, verify it matches authenticated user
    if (queryUserId && queryUserId !== authResult.user.id) {
      return c.json({ error: "Forbidden: You can only access your own decisions" }, 403);
    }

    const userId = authResult.user.id;

    const conditions = type
      ? and(eq(decisions.userId, userId), eq(decisions.type, type))
      : eq(decisions.userId, userId);

    // Left join with outcomes to include status
    const results = await db
      .select({
        id: decisions.id,
        userId: decisions.userId,
        workoutId: decisions.workoutId,
        type: decisions.type,
        input: decisions.input,
        output: decisions.output,
        reasoning: decisions.reasoning,
        algorithmVersion: decisions.algorithmVersion,
        createdAt: decisions.createdAt,
        // Include outcome data if available
        outcome: {
          status: decisionOutcomes.outcome,
          overrideReason: decisionOutcomes.overrideReason,
          success: decisionOutcomes.success,
          recordedAt: decisionOutcomes.createdAt,
        },
      })
      .from(decisions)
      .leftJoin(decisionOutcomes, eq(decisions.id, decisionOutcomes.decisionId))
      .where(conditions)
      .orderBy(desc(decisions.createdAt))
      .limit(limit)
      .offset(offset);

    // Transform results to flatten the structure
    const transformedResults = results.map((row) => ({
      id: row.id,
      userId: row.userId,
      workoutId: row.workoutId,
      type: row.type,
      input: row.input,
      output: row.output,
      reasoning: row.reasoning,
      algorithmVersion: row.algorithmVersion,
      createdAt: row.createdAt,
      outcome: row.outcome?.status
        ? {
            status: row.outcome.status,
            overrideReason: row.outcome.overrideReason,
            success: row.outcome.success,
            recordedAt: row.outcome.recordedAt,
          }
        : null,
    }));

    return c.json({ data: transformedResults });
  }
);

// Get single decision by ID (requires ownership)
decisionRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  // Verify user is authenticated
  const authResult = await getAuthenticatedUserFromContext(c);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const result = await db
    .select()
    .from(decisions)
    .where(eq(decisions.id, id))
    .limit(1);

  if (result.length === 0) {
    return c.json({ error: "Decision not found" }, 404);
  }

  // Verify the decision belongs to the authenticated user
  if (result[0]!.userId !== authResult.user.id) {
    return c.json({ error: "Forbidden: You can only access your own decisions" }, 403);
  }

  return c.json({ data: result[0] });
});

// ============ Decision Outcomes ============

// Record outcome after user responds to a decision
const outcomeSchema = z.object({
  outcome: z.enum(["followed", "overridden", "ignored"]),
  overrideReason: z.enum(OVERRIDE_REASONS).optional(),
  actualValue: z.record(z.unknown()).optional(),
});

decisionRoutes.post(
  "/:id/outcome",
  zValidator("json", outcomeSchema),
  async (c) => {
    const decisionId = c.req.param("id");
    const data = c.req.valid("json");

    // Verify user is authenticated
    const authResult = await getAuthenticatedUserFromContext(c);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Validate: if overridden, require reason
    if (data.outcome === "overridden" && !data.overrideReason) {
      return c.json({ error: "Override reason required when outcome is 'overridden'" }, 400);
    }

    // Get the decision to verify it exists and belongs to the user
    const decision = await db
      .select()
      .from(decisions)
      .where(eq(decisions.id, decisionId))
      .limit(1);

    if (decision.length === 0) {
      return c.json({ error: "Decision not found" }, 404);
    }

    // Verify the decision belongs to the authenticated user
    if (decision[0]!.userId !== authResult.user.id) {
      return c.json({ error: "Forbidden: You can only record outcomes for your own decisions" }, 403);
    }

    // Check if outcome already exists
    const existing = await db
      .select()
      .from(decisionOutcomes)
      .where(eq(decisionOutcomes.decisionId, decisionId))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: "Outcome already recorded for this decision" }, 409);
    }

    // Create outcome record
    const outcomeId = `do_${nanoid(12)}`;
    const [inserted] = await db
      .insert(decisionOutcomes)
      .values({
        id: outcomeId,
        decisionId,
        userId: decision[0]!.userId,
        outcome: data.outcome,
        overrideReason: data.overrideReason ?? null,
        expectedValue: decision[0]!.output,
        actualValue: data.actualValue ?? null,
        success: null, // Will be evaluated later
      })
      .returning();

    const logger = c.get("logger") ?? globalLogger;
    logger.info({ decisionId, outcome: data.outcome, userId: authResult.user.id }, "Decision outcome recorded");

    return c.json({ data: inserted });
  }
);

// Get decision accuracy stats for a user
const accuracyQuerySchema = z.object({
  userId: z.string().min(1).optional(), // Now optional - will use authenticated user if not provided
});

decisionRoutes.get(
  "/accuracy",
  zValidator("query", accuracyQuerySchema),
  async (c) => {
    const { userId: queryUserId } = c.req.valid("query");

    // Get authenticated user
    const authResult = await getAuthenticatedUserFromContext(c);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // If userId provided in query, verify it matches authenticated user
    if (queryUserId && queryUserId !== authResult.user.id) {
      return c.json({ error: "Forbidden: You can only access your own data" }, 403);
    }

    const userId = authResult.user.id;

    // Get all outcomes for this user
    const outcomes = await db
      .select({
        outcome: decisionOutcomes.outcome,
        success: decisionOutcomes.success,
        overrideReason: decisionOutcomes.overrideReason,
        decisionType: decisions.type,
      })
      .from(decisionOutcomes)
      .innerJoin(decisions, eq(decisionOutcomes.decisionId, decisions.id))
      .where(eq(decisionOutcomes.userId, userId));

    // Calculate stats
    const totalDecisions = outcomes.length;
    const followed = outcomes.filter(o => o.outcome === "followed").length;
    const overridden = outcomes.filter(o => o.outcome === "overridden").length;
    const ignored = outcomes.filter(o => o.outcome === "ignored").length;

    // Success rate of followed decisions that have been evaluated
    const evaluatedFollowed = outcomes.filter(o => o.outcome === "followed" && o.success !== null);
    const successfulFollowed = evaluatedFollowed.filter(o => o.success === true).length;
    const successRate = evaluatedFollowed.length > 0 ? successfulFollowed / evaluatedFollowed.length : 0;

    // Count override reasons
    const overrideReasons: Partial<Record<OverrideReason, number>> = {};
    for (const o of outcomes) {
      if (o.overrideReason) {
        const reason = o.overrideReason as OverrideReason;
        overrideReasons[reason] = (overrideReasons[reason] || 0) + 1;
      }
    }

    // Stats by decision type
    const byType: DecisionAccuracyStats["byType"] = {};
    const typeGroups = new Map<string, typeof outcomes>();
    for (const o of outcomes) {
      const existing = typeGroups.get(o.decisionType) || [];
      existing.push(o);
      typeGroups.set(o.decisionType, existing);
    }

    for (const [type, typeOutcomes] of typeGroups) {
      const typeFollowed = typeOutcomes.filter(o => o.outcome === "followed");
      const typeEvaluated = typeFollowed.filter(o => o.success !== null);
      const typeSuccessful = typeEvaluated.filter(o => o.success === true).length;

      byType[type as DecisionType] = {
        total: typeOutcomes.length,
        followed: typeFollowed.length,
        successRate: typeEvaluated.length > 0 ? typeSuccessful / typeEvaluated.length : 0,
      };
    }

    const stats: DecisionAccuracyStats = {
      userId,
      totalDecisions,
      followed,
      overridden,
      ignored,
      successRate,
      overrideReasons,
      byType,
    };

    return c.json({ data: stats });
  }
);

// Get decisions pending outcome evaluation
const pendingQuerySchema = z.object({
  userId: z.string().min(1).optional(), // Now optional - will use authenticated user if not provided
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

decisionRoutes.get(
  "/pending-evaluation",
  zValidator("query", pendingQuerySchema),
  async (c) => {
    const { userId: queryUserId, limit } = c.req.valid("query");

    // Get authenticated user
    const authResult = await getAuthenticatedUserFromContext(c);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // If userId provided in query, verify it matches authenticated user
    if (queryUserId && queryUserId !== authResult.user.id) {
      return c.json({ error: "Forbidden: You can only access your own data" }, 403);
    }

    const userId = authResult.user.id;

    // Find decisions that have 'followed' outcome but success is null
    const pending = await db
      .select({
        decision: decisions,
        outcome: decisionOutcomes,
      })
      .from(decisions)
      .innerJoin(decisionOutcomes, eq(decisions.id, decisionOutcomes.decisionId))
      .where(
        and(
          eq(decisions.userId, userId),
          eq(decisionOutcomes.outcome, "followed"),
          isNull(decisionOutcomes.success)
        )
      )
      .orderBy(desc(decisions.createdAt))
      .limit(limit);

    return c.json({
      data: pending.map(p => ({
        ...p.decision,
        outcomeId: p.outcome.id,
        outcomeCreatedAt: p.outcome.createdAt,
      })),
    });
  }
);

// Update outcome with success evaluation
const evaluateOutcomeSchema = z.object({
  success: z.boolean(),
  actualValue: z.record(z.unknown()).optional(),
});

decisionRoutes.patch(
  "/:id/outcome",
  zValidator("json", evaluateOutcomeSchema),
  async (c) => {
    const decisionId = c.req.param("id");
    const data = c.req.valid("json");

    // Verify user is authenticated
    const authResult = await getAuthenticatedUserFromContext(c);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Find the outcome for this decision
    const outcome = await db
      .select()
      .from(decisionOutcomes)
      .where(eq(decisionOutcomes.decisionId, decisionId))
      .limit(1);

    if (outcome.length === 0) {
      return c.json({ error: "No outcome recorded for this decision" }, 404);
    }

    // Verify the outcome belongs to the authenticated user
    if (outcome[0]!.userId !== authResult.user.id) {
      return c.json({ error: "Forbidden: You can only evaluate your own decision outcomes" }, 403);
    }

    // Update with evaluation
    const [updated] = await db
      .update(decisionOutcomes)
      .set({
        success: data.success,
        actualValue: data.actualValue ?? outcome[0]!.actualValue,
        evaluatedAt: new Date(),
      })
      .where(eq(decisionOutcomes.id, outcome[0]!.id))
      .returning();

    return c.json({ data: updated });
  }
);

// ============ Load Progression ============

const loadProgressionSchema = z.object({
  exerciseId: z.string().min(1),
  recentSets: z.array(z.object({
    reps: z.number().int().min(0),
    rpe: z.number().min(1).max(10).optional(),
    weight: z.number().min(0),
  })).min(1),
  currentWeight: z.number().min(0),
  targetRepRange: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  // Optional: for persistence
  userId: z.string().min(1).optional(),
  workoutId: z.string().min(1).optional(),
});

decisionRoutes.post(
  "/load-progression",
  zValidator("json", loadProgressionSchema),
  async (c) => {
    const { userId, workoutId, ...input } = c.req.valid("json");

    // Verify userId matches authenticated user if provided
    const verifiedUserId = verifyRequestUserId(c, userId);

    const result = calculateLoadProgression(input);

    await persistDecision(
      "load_progression",
      input as Record<string, unknown>,
      result as unknown as Record<string, unknown>,
      result.reason,
      userId ? verifiedUserId : undefined,
      workoutId
    );

    if (userId) {
      const logger = c.get("logger") ?? globalLogger;
      logger.info({ exerciseId: input.exerciseId, action: result.action, newWeight: result.newWeight, userId: verifiedUserId }, "Load progression decided");
    }

    return c.json({ data: result });
  }
);

// ============ Volume Adjustment ============

const volumeAdjustmentSchema = z.object({
  exerciseId: z.string().min(1),
  currentSetCount: z.number().int().min(1),
  recentPerformance: z.array(z.object({
    completedSets: z.number().int().min(0),
    targetSets: z.number().int().min(1),
    avgRpe: z.number().min(1).max(10),
  })),
  minSetsPerExercise: z.number().int().min(1).optional(),
  maxSetsPerExercise: z.number().int().min(1).optional(),
  userId: z.string().min(1).optional(),
  workoutId: z.string().min(1).optional(),
});

decisionRoutes.post(
  "/volume",
  zValidator("json", volumeAdjustmentSchema),
  async (c) => {
    const { userId, workoutId, ...input } = c.req.valid("json");

    // Verify userId matches authenticated user if provided
    const verifiedUserId = verifyRequestUserId(c, userId);

    const result = calculateVolumeAdjustment(input);

    await persistDecision(
      "volume_adjustment",
      input as Record<string, unknown>,
      result as unknown as Record<string, unknown>,
      result.reason,
      userId ? verifiedUserId : undefined,
      workoutId
    );

    if (userId) {
      const logger = c.get("logger") ?? globalLogger;
      logger.info({ exerciseId: input.exerciseId, action: result.action, newSetCount: result.newSetCount, userId: verifiedUserId }, "Volume adjustment decided");
    }

    return c.json({ data: result });
  }
);

// ============ Deload Check ============

const deloadCheckSchema = z.object({
  weekNumber: z.number().int().min(0),
  recentWeeklyRpe: z.array(z.number().min(1).max(10)),
  missedSessions: z.number().int().min(0),
  consecutiveHardWeeks: z.number().int().min(0),
  userId: z.string().min(1).optional(),
  workoutId: z.string().min(1).optional(),
});

decisionRoutes.post(
  "/deload",
  zValidator("json", deloadCheckSchema),
  async (c) => {
    const { userId, workoutId, ...input } = c.req.valid("json");

    // Verify userId matches authenticated user if provided
    const verifiedUserId = verifyRequestUserId(c, userId);

    const result = calculateDeloadNeed(input);

    await persistDecision(
      "deload_recommendation",
      input as Record<string, unknown>,
      result as unknown as Record<string, unknown>,
      result.reason,
      userId ? verifiedUserId : undefined,
      workoutId
    );

    if (userId) {
      const logger = c.get("logger") ?? globalLogger;
      logger.info({ weekNumber: input.weekNumber, recommended: result.recommended, userId: verifiedUserId }, "Deload decision made");
    }

    return c.json({ data: result });
  }
);

// ============ Exercise Rotation ============

const rotationCheckSchema = z.object({
  exerciseId: z.string().min(1),
  weeksOnExercise: z.number().int().min(0),
  performanceTrend: z.enum(["improving", "stagnant", "declining"]),
  availableSubstitutes: z.array(z.string()),
  userId: z.string().min(1).optional(),
  workoutId: z.string().min(1).optional(),
});

decisionRoutes.post(
  "/rotation",
  zValidator("json", rotationCheckSchema),
  async (c) => {
    const { userId, workoutId, ...input } = c.req.valid("json");

    // Verify userId matches authenticated user if provided
    const verifiedUserId = verifyRequestUserId(c, userId);

    const result = calculateExerciseRotation(input);

    await persistDecision(
      "exercise_rotation",
      input as Record<string, unknown>,
      result as unknown as Record<string, unknown>,
      result.reason,
      userId ? verifiedUserId : undefined,
      workoutId
    );

    if (userId) {
      const logger = c.get("logger") ?? globalLogger;
      logger.info({ exerciseId: input.exerciseId, action: result.action, userId: verifiedUserId }, "Rotation decision made");
    }

    return c.json({ data: result });
  }
);

// ============ Session Recovery ============

const recoveryCheckSchema = z.object({
  sleepQuality: z.number().min(1).max(10),
  muscleSoreness: z.number().min(1).max(10),
  stressLevel: z.number().min(1).max(10),
  energyLevel: z.number().min(1).max(10),
  hoursSinceLastWorkout: z.number().min(0),
  lastWorkoutRpe: z.number().min(1).max(10).optional(),
  userId: z.string().min(1).optional(),
  workoutId: z.string().min(1).optional(),
});

decisionRoutes.post(
  "/recovery",
  zValidator("json", recoveryCheckSchema),
  async (c) => {
    const { userId, workoutId, ...input } = c.req.valid("json");

    // Verify userId matches authenticated user if provided
    const verifiedUserId = verifyRequestUserId(c, userId);

    const result = calculateSessionRecovery(input);

    await persistDecision(
      "session_recovery",
      input as Record<string, unknown>,
      result as unknown as Record<string, unknown>,
      result.reason,
      userId ? verifiedUserId : undefined,
      workoutId
    );

    if (userId) {
      const logger = c.get("logger") ?? globalLogger;
      logger.info({ score: result.readinessScore, recommendation: result.recommendation, userId: verifiedUserId }, "Recovery decision made");
    }

    return c.json({ data: result });
  }
);

// ============ Missed Session Handling ============

const missedSessionSchema = z.object({
  daysSinceMissed: z.number().int().min(0),
  reason: z.enum(["illness", "injury", "travel", "schedule_conflict", "fatigue", "motivation", "unknown"]),
  missedThisWeek: z.number().int().min(0),
  consecutiveMissed: z.number().int().min(0),
  weekNumber: z.number().int().min(1),
  totalWeeks: z.number().int().min(1),
  wasKeySession: z.boolean(),
  userId: z.string().min(1).optional(),
  workoutId: z.string().min(1).optional(),
});

decisionRoutes.post(
  "/missed-session",
  zValidator("json", missedSessionSchema),
  async (c) => {
    const { userId, workoutId, ...input } = c.req.valid("json");

    // Verify userId matches authenticated user if provided
    const verifiedUserId = verifyRequestUserId(c, userId);

    const result = calculateMissedSessionHandling(input);

    await persistDecision(
      "missed_session",
      input as Record<string, unknown>,
      result as unknown as Record<string, unknown>,
      result.reason,
      userId ? verifiedUserId : undefined,
      workoutId
    );

    return c.json({ data: result });
  }
);

// ============ Weekly Plan Generation ============

const exercisePerformanceSchema = z.object({
  exerciseId: z.string().min(1),
  currentWeight: z.number().min(0),
  currentSets: z.number().int().min(1),
  targetRepRange: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  weeksOnExercise: z.number().int().min(0),
  recentSets: z.array(z.object({
    reps: z.number().int().min(0),
    rpe: z.number().min(1).max(10).optional(),
    weight: z.number().min(0),
  })),
  recentPerformance: z.array(z.object({
    completedSets: z.number().int().min(0),
    targetSets: z.number().int().min(1),
    avgRpe: z.number().min(1).max(10),
  })),
  performanceTrend: z.enum(["improving", "stagnant", "declining"]),
  availableSubstitutes: z.array(z.string()),
});

const weeklyPlanSchema = z.object({
  userId: z.string().min(1),
  weekNumber: z.number().int().min(0),
  totalWeeks: z.number().int().min(1),
  exercises: z.array(exercisePerformanceSchema),
  recentWeeklyRpe: z.array(z.number().min(1).max(10)),
  missedSessions: z.number().int().min(0),
  consecutiveHardWeeks: z.number().int().min(0),
  userRequestedDeload: z.boolean().optional(),
  // Weekly plan always has userId, optionally link to a workout
  workoutId: z.string().min(1).optional(),
  persist: z.boolean().default(true), // Allow opting out of persistence
});

decisionRoutes.post(
  "/weekly-plan",
  zValidator("json", weeklyPlanSchema),
  async (c) => {
    const { workoutId, persist, ...data } = c.req.valid("json");

    // Verify userId matches authenticated user (required for weekly plan)
    const verifiedUserId = verifyRequestUserId(c, data.userId);

    const result = generateWeeklyPlan(data);

    if (persist) {
      await persistDecision(
        "weekly_plan_update",
        data as unknown as Record<string, unknown>,
        result as unknown as Record<string, unknown>,
        result.summary,
        verifiedUserId,
        workoutId
      );
    }

    return c.json({ data: result });
  }
);

// ============ Performance Trend ============

const performanceTrendSchema = z.object({
  recentWeights: z.array(z.number().min(0)),
  recentReps: z.array(z.number().int().min(0)),
  userId: z.string().min(1).optional(),
  exerciseId: z.string().min(1).optional(),
});

decisionRoutes.post(
  "/performance-trend",
  zValidator("json", performanceTrendSchema),
  async (c) => {
    const data = c.req.valid("json");
    const result = calculatePerformanceTrend(data.recentWeights, data.recentReps);

    return c.json({ data: { trend: result } });
  }
);

export { decisionRoutes };
