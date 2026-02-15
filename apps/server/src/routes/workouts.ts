import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { trainingBlocks, workouts, programs, decisions, standaloneWorkouts } from "@gymapp/db/schema";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { getDecisionConfidence } from "@gymapp/engine";
import type { Env } from "../types";
import type { DecisionType } from "@gymapp/types";
import { verifyTrainingBlockAccess, verifyWorkoutAccess, getUserByClerkId } from "../middleware/authorize";
import { logger as globalLogger } from "../lib/logger";
import { generateNextWeek, isWeekComplete } from "../services/week-generation";

const workoutRoutes = new Hono<Env>();

// ============ Training Blocks ============

const createTrainingBlockSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  programId: z.string().min(1).max(64),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const updateTrainingBlockSchema = z.object({
  currentWeek: z.number().int().min(1).optional(),
  status: z.enum(["active", "completed", "paused"]).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// GET /training-blocks - List training blocks for authenticated user
workoutRoutes.get(
  "/training-blocks",
  zValidator("query", z.object({
    status: z.enum(["active", "completed", "paused"]).optional(),
  })),
  async (c) => {
    const clerkId = c.get("clerkId") as string;
    if (!clerkId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const { status } = c.req.valid("query");

    const conditions = status
      ? and(eq(trainingBlocks.userId, user.id), eq(trainingBlocks.status, status))
      : eq(trainingBlocks.userId, user.id);

    const results = await db
      .select()
      .from(trainingBlocks)
      .where(conditions)
      .orderBy(trainingBlocks.startDate);

    return c.json({ data: results });
  }
);

// GET /training-blocks/:id - Get single training block with program details (requires ownership)
workoutRoutes.get("/training-blocks/:id", async (c) => {
  const id = c.req.param("id");

  // Verify the authenticated user owns this training block
  const authResult = await verifyTrainingBlockAccess(c, id);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // Get program details for the training block
  const result = await db
    .select({
      trainingBlock: trainingBlocks,
      program: programs,
    })
    .from(trainingBlocks)
    .leftJoin(programs, eq(trainingBlocks.programId, programs.id))
    .where(eq(trainingBlocks.id, id))
    .limit(1);

  return c.json({ data: result[0] });
});

// POST /training-blocks - Start a new training block
workoutRoutes.post(
  "/training-blocks",
  zValidator("json", createTrainingBlockSchema),
  async (c) => {
    const clerkId = c.get("clerkId") as string;
    if (!clerkId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const data = c.req.valid("json");

    // Verify program exists
    const program = await db
      .select()
      .from(programs)
      .where(eq(programs.id, data.programId))
      .limit(1);

    if (program.length === 0) {
      return c.json({ error: "Program not found" }, 404);
    }

    // Check for existing active block
    const existingActive = await db
      .select({ id: trainingBlocks.id })
      .from(trainingBlocks)
      .where(and(
        eq(trainingBlocks.userId, user.id),
        eq(trainingBlocks.status, "active")
      ))
      .limit(1);

    if (existingActive.length > 0) {
      return c.json({ error: "User already has an active training block" }, 409);
    }

    const result = await db
      .insert(trainingBlocks)
      .values({
        id: data.id,
        userId: user.id,
        programId: data.programId,
        startDate: data.startDate,
        currentWeek: 1,
        status: "active",
      })
      .returning();

    // Generate workouts for the first week based on program template
    const programData = program[0]!;
    const template = programData.template as { sessions: Array<{ dayNumber: number; exercises: Record<string, unknown>[] }> };

    // Parse date as local time by adding T00:00:00 (without Z suffix)
    // This ensures "2024-02-09" is treated as local midnight, not UTC midnight
    const startDate = new Date(data.startDate + "T00:00:00");

    const workoutsToCreate = template.sessions.map((session) => {
      const workoutDate = new Date(startDate);
      workoutDate.setDate(workoutDate.getDate() + session.dayNumber - 1);
      // Use local date format for consistency
      const scheduledDate = `${workoutDate.getFullYear()}-${String(workoutDate.getMonth() + 1).padStart(2, "0")}-${String(workoutDate.getDate()).padStart(2, "0")}`;

      return {
        id: `${data.id}-w1-d${session.dayNumber}`,
        trainingBlockId: data.id,
        scheduledDate,
        weekNumber: 1,
        dayNumber: session.dayNumber,
        plannedExercises: session.exercises,
        status: "pending" as const,
      };
    });

    if (workoutsToCreate.length > 0) {
      await db.insert(workouts).values(workoutsToCreate);
    }

    const logger = c.get("logger") ?? globalLogger;
    logger.info({ userId: user.id, blockId: data.id, programId: data.programId }, "Training block started");

    return c.json({ data: result[0] }, 201);
  }
);

// PATCH /training-blocks/:id - Update training block (requires ownership)
workoutRoutes.patch(
  "/training-blocks/:id",
  zValidator("json", updateTrainingBlockSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    // Verify the authenticated user owns this training block
    const authResult = await verifyTrainingBlockAccess(c, id);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.currentWeek !== undefined) updateData.currentWeek = data.currentWeek;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;

    const result = await db
      .update(trainingBlocks)
      .set(updateData)
      .where(eq(trainingBlocks.id, id))
      .returning();

    const logger = c.get("logger") ?? globalLogger;
    logger.info({ blockId: id, status: data.status, currentWeek: data.currentWeek }, "Training block updated");

    return c.json({ data: result[0] });
  }
);

// POST /training-blocks/:id/generate-week - Generate next week's workouts
const generateWeekSchema = z.object({
  forceDeload: z.boolean().optional(),
});

workoutRoutes.post(
  "/training-blocks/:id/generate-week",
  zValidator("json", generateWeekSchema.optional()),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json") ?? {};

    // Verify the authenticated user owns this training block
    const authResult = await verifyTrainingBlockAccess(c, id);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const logger = c.get("logger") ?? globalLogger;

    try {
      // Check if current week is complete before generating next week
      const block = await db
        .select()
        .from(trainingBlocks)
        .where(eq(trainingBlocks.id, id))
        .limit(1);

      if (block.length === 0) {
        return c.json({ error: "Training block not found" }, 404);
      }

      const currentWeek = block[0]!.currentWeek;
      const weekComplete = await isWeekComplete(id, currentWeek);

      if (!weekComplete) {
        return c.json(
          {
            error: `Week ${currentWeek} is not complete. Complete or skip all workouts before generating the next week.`,
          },
          400
        );
      }

      // Generate the next week
      const result = await generateNextWeek(id, authResult.user.id, {
        forceDeload: body.forceDeload,
      });

      logger.info(
        {
          blockId: id,
          userId: authResult.user.id,
          weekNumber: result.weekNumber,
          workoutsCreated: result.workouts.length,
          decisionsCreated: result.decisions.length,
          isDeload: result.isDeloadWeek,
        },
        "Week generated successfully"
      );

      return c.json({
        data: {
          workouts: result.workouts,
          decisions: result.decisions.map((d) => ({
            id: d.id,
            type: d.type,
            reasoning: d.reasoning,
          })),
          weekNumber: result.weekNumber,
          isDeloadWeek: result.isDeloadWeek,
          summary: result.summary,
        },
      }, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate week";
      logger.error({ blockId: id, error: message }, "Week generation failed");
      return c.json({ error: message }, 400);
    }
  }
);

// ============ Mobile Convenience Endpoints ============

// GET /today - Get today's workout for authenticated user with relevant decisions
// Returns both program workouts and standalone workouts scheduled for today
workoutRoutes.get(
  "/today",
  async (c) => {
    const clerkId = c.get("clerkId") as string;
    if (!clerkId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    // Use local date to match client behavior (toISOString uses UTC which can cause date mismatches)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const logger = c.get("logger") ?? globalLogger;
    logger.info({ userId: user.id, today }, "Fetching today's workout");

    // Find user's active training block and today's program workout
    const activeBlock = await db
      .select()
      .from(trainingBlocks)
      .where(and(
        eq(trainingBlocks.userId, user.id),
        eq(trainingBlocks.status, "active")
      ))
      .limit(1);

    let programWorkout = null;
    if (activeBlock.length > 0) {
      const todayWorkout = await db
        .select()
        .from(workouts)
        .where(and(
          eq(workouts.trainingBlockId, activeBlock[0]!.id),
          eq(workouts.scheduledDate, today)
        ))
        .limit(1);

      if (todayWorkout.length > 0) {
        programWorkout = todayWorkout[0];
      }
    }

    // Find today's standalone workouts
    const todayStandaloneWorkouts = await db
      .select()
      .from(standaloneWorkouts)
      .where(and(
        eq(standaloneWorkouts.userId, user.id),
        eq(standaloneWorkouts.scheduledDate, today)
      ))
      .orderBy(standaloneWorkouts.createdAt);

    // If no workouts at all, return null
    if (!programWorkout && todayStandaloneWorkouts.length === 0) {
      return c.json({ data: null, message: "No workout scheduled for today" });
    }

    // Collect all exercise IDs from both program and standalone workouts
    const allExerciseIds: string[] = [];

    if (programWorkout) {
      const plannedExercises = programWorkout.plannedExercises as Array<{ exerciseId: string }> | null;
      const ids = plannedExercises?.map(e => e.exerciseId).filter(Boolean) ?? [];
      allExerciseIds.push(...ids);
    }

    for (const sw of todayStandaloneWorkouts) {
      const plannedExercises = sw.plannedExercises as Array<{ exerciseId: string }> | null;
      const ids = plannedExercises?.map(e => e.exerciseId).filter(Boolean) ?? [];
      allExerciseIds.push(...ids);
    }

    // Use all exercise IDs for decision lookups
    const exerciseIds = [...new Set(allExerciseIds)]; // Remove duplicates

    // Fetch recent decisions for these exercises (from last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    let exerciseDecisions: Array<{
      exerciseId: string;
      decisionId: string;
      type: DecisionType;
      summary: string;
      reasoning: string;
      confidence: "low" | "medium" | "high";
      recommendedValue: unknown;
    }> = [];

    if (exerciseIds.length > 0) {
      // Get recent decisions for these exercises
      const recentDecisions = await db
        .select()
        .from(decisions)
        .where(and(
          eq(decisions.userId, user.id),
          gte(decisions.createdAt, oneWeekAgo)
        ))
        .orderBy(desc(decisions.createdAt));

      // Filter and transform decisions that match our exercises
      for (const decision of recentDecisions) {
        const input = decision.input as { exerciseId?: string };
        const output = decision.output as Record<string, unknown>;

        if (!input.exerciseId || !exerciseIds.includes(input.exerciseId)) {
          continue;
        }

        // Generate summary based on decision type
        const summary = generateDecisionSummary(decision.type, output);
        const confidence = getDecisionConfidence(3); // Default data points

        exerciseDecisions.push({
          exerciseId: input.exerciseId,
          decisionId: decision.id,
          type: decision.type as DecisionType,
          summary,
          reasoning: decision.reasoning,
          confidence,
          recommendedValue: output,
        });
      }

      // Keep only the most recent decision per exercise
      const seenExercises = new Set<string>();
      exerciseDecisions = exerciseDecisions.filter(d => {
        if (seenExercises.has(d.exerciseId)) {
          return false;
        }
        seenExercises.add(d.exerciseId);
        return true;
      });
    }

    return c.json({
      data: {
        programWorkout,
        standaloneWorkouts: todayStandaloneWorkouts,
        decisions: exerciseDecisions,
      },
    });
  }
);

// Helper to generate human-readable summary from decision output
function generateDecisionSummary(type: string, output: Record<string, unknown>): string {
  switch (type) {
    case "load_progression": {
      const action = output.action as string;
      const newWeight = output.newWeight as number;
      if (action === "increase") {
        return `Increase to ${newWeight}kg`;
      } else if (action === "decrease") {
        return `Reduce to ${newWeight}kg`;
      }
      return `Maintain at ${newWeight}kg`;
    }
    case "volume_adjustment": {
      const action = output.action as string;
      const newSetCount = output.newSetCount as number;
      if (action === "add_set") {
        return `Add set (${newSetCount} total)`;
      } else if (action === "reduce_set") {
        return `Reduce to ${newSetCount} sets`;
      }
      return `Maintain ${newSetCount} sets`;
    }
    case "exercise_rotation": {
      const action = output.action as string;
      const newExerciseId = output.newExerciseId as string | undefined;
      if (action === "swap" && newExerciseId) {
        return `Swap to ${newExerciseId}`;
      }
      return "Keep current exercise";
    }
    case "deload_recommendation": {
      const recommended = output.recommended as boolean;
      return recommended ? "Deload recommended" : "Continue as planned";
    }
    default:
      return "Adjustment recommended";
  }
}

// GET /recent - Get recent workouts for authenticated user
workoutRoutes.get(
  "/recent",
  zValidator("query", z.object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })),
  async (c) => {
    const clerkId = c.get("clerkId") as string;
    if (!clerkId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const { limit } = c.req.valid("query");

    // Find user's active training block
    const activeBlock = await db
      .select()
      .from(trainingBlocks)
      .where(and(
        eq(trainingBlocks.userId, user.id),
        eq(trainingBlocks.status, "active")
      ))
      .limit(1);

    if (activeBlock.length === 0) {
      return c.json({ data: [] });
    }

    // Find recent completed workouts
    const recentWorkouts = await db
      .select()
      .from(workouts)
      .where(and(
        eq(workouts.trainingBlockId, activeBlock[0]!.id),
        eq(workouts.status, "completed")
      ))
      .orderBy(desc(workouts.scheduledDate))
      .limit(limit);

    return c.json({ data: recentWorkouts });
  }
);

// ============ Workouts ============

const workoutQuerySchema = z.object({
  trainingBlockId: z.string().optional(),
  userId: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "skipped"]).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const updateWorkoutSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "skipped"]).optional(),
  plannedExercises: z.array(z.object({
    exerciseId: z.string(),
    sets: z.number().int().min(1),
    repRange: z.tuple([z.number().int(), z.number().int()]),
    restSeconds: z.number().int(),
    notes: z.string().optional(),
  })).optional(),
});

// GET /workouts - List workouts with filters (only user's own workouts)
workoutRoutes.get(
  "/",
  zValidator("query", workoutQuerySchema),
  async (c) => {
    const clerkId = c.get("clerkId");
    if (!clerkId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const query = c.req.valid("query");

    // First get user's training blocks
    const userBlocks = await db
      .select({ id: trainingBlocks.id })
      .from(trainingBlocks)
      .where(eq(trainingBlocks.userId, user.id));

    const userBlockIds = userBlocks.map(b => b.id);

    if (userBlockIds.length === 0) {
      return c.json({ data: [] });
    }

    // If a specific trainingBlockId is requested, verify it belongs to user
    if (query.trainingBlockId && !userBlockIds.includes(query.trainingBlockId)) {
      return c.json({ error: "Forbidden: You can only access your own workouts" }, 403);
    }

    let dbQuery = db.select().from(workouts);

    // Filter to only user's training blocks (or specific block if provided)
    if (query.trainingBlockId) {
      dbQuery = dbQuery.where(eq(workouts.trainingBlockId, query.trainingBlockId)) as typeof dbQuery;
    } else {
      // Filter to any of user's training blocks
      dbQuery = dbQuery.where(inArray(workouts.trainingBlockId, userBlockIds)) as typeof dbQuery;
    }

    if (query.status) {
      dbQuery = dbQuery.where(eq(workouts.status, query.status)) as typeof dbQuery;
    }

    if (query.fromDate) {
      dbQuery = dbQuery.where(gte(workouts.scheduledDate, query.fromDate)) as typeof dbQuery;
    }

    if (query.toDate) {
      dbQuery = dbQuery.where(lte(workouts.scheduledDate, query.toDate)) as typeof dbQuery;
    }

    const results = await dbQuery.orderBy(workouts.scheduledDate);

    return c.json({ data: results });
  }
);

// GET /workouts/:id - Get single workout with details (requires ownership)
workoutRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  // Verify the authenticated user owns this workout
  const authResult = await verifyWorkoutAccess(c, id);
  if (!authResult.authorized) {
    return authResult.response;
  }

  return c.json({ data: authResult.workout });
});

// PATCH /workouts/:id - Update workout (requires ownership)
workoutRoutes.patch(
  "/:id",
  zValidator("json", updateWorkoutSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    // Verify the authenticated user owns this workout
    const authResult = await verifyWorkoutAccess(c, id);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.status !== undefined) updateData.status = data.status;
    if (data.plannedExercises !== undefined) updateData.plannedExercises = data.plannedExercises;

    const result = await db
      .update(workouts)
      .set(updateData)
      .where(eq(workouts.id, id))
      .returning();

    return c.json({ data: result[0] });
  }
);

// POST /workouts/:id/start - Start a workout session (requires ownership)
workoutRoutes.post("/:id/start", async (c) => {
  const id = c.req.param("id");

  // Verify the authenticated user owns this workout
  const authResult = await verifyWorkoutAccess(c, id);
  if (!authResult.authorized) {
    return authResult.response;
  }

  if (authResult.workout.status !== "pending") {
    return c.json({ error: "Workout has already been started or completed" }, 400);
  }

  const result = await db
    .update(workouts)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(eq(workouts.id, id))
    .returning();

  const logger = c.get("logger") ?? globalLogger;
  logger.info({ workoutId: id, userId: authResult.user.id }, "Workout started");

  return c.json({ data: result[0] });
});

// POST /workouts/:id/complete - Mark workout as complete (requires ownership)
workoutRoutes.post("/:id/complete", async (c) => {
  const id = c.req.param("id");

  // Verify the authenticated user owns this workout
  const authResult = await verifyWorkoutAccess(c, id);
  if (!authResult.authorized) {
    return authResult.response;
  }

  if (authResult.workout.status === "completed") {
    return c.json({ error: "Workout is already completed" }, 400);
  }

  const result = await db
    .update(workouts)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(workouts.id, id))
    .returning();

  const logger = c.get("logger") ?? globalLogger;
  logger.info({ workoutId: id, userId: authResult.user.id }, "Workout completed");

  // Check if all workouts for the current week are now complete
  const workout = result[0]!;
  const weekComplete = await isWeekComplete(
    workout.trainingBlockId,
    workout.weekNumber
  );

  return c.json({
    data: result[0],
    weekComplete,
    message: weekComplete
      ? `Week ${workout.weekNumber} complete! You can now generate the next week's workouts.`
      : undefined,
  });
});

// POST /workouts/:id/skip - Skip a workout (requires ownership)
workoutRoutes.post("/:id/skip", async (c) => {
  const id = c.req.param("id");

  // Verify the authenticated user owns this workout
  const authResult = await verifyWorkoutAccess(c, id);
  if (!authResult.authorized) {
    return authResult.response;
  }

  if (authResult.workout.status === "completed") {
    return c.json({ error: "Cannot skip a completed workout" }, 400);
  }

  const result = await db
    .update(workouts)
    .set({ status: "skipped", updatedAt: new Date() })
    .where(eq(workouts.id, id))
    .returning();

  const logger = c.get("logger") ?? globalLogger;
  logger.info({ workoutId: id, userId: authResult.user.id }, "Workout skipped");

  // Check if all workouts for the current week are now complete
  const workout = result[0]!;
  const weekComplete = await isWeekComplete(
    workout.trainingBlockId,
    workout.weekNumber
  );

  return c.json({
    data: result[0],
    weekComplete,
    message: weekComplete
      ? `Week ${workout.weekNumber} complete! You can now generate the next week's workouts.`
      : undefined,
  });
});

export { workoutRoutes };
