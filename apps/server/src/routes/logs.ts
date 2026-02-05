import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { workoutLogs, loggedSets, workouts } from "@gymapp/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { evaluatePendingDecisions } from "../services/decision-eval";
import type { Env } from "../types";
import {
  verifyWorkoutLogAccess,
  verifyUserAccess,
  getAuthenticatedUserFromContext,
} from "../middleware/authorize";

const logRoutes = new Hono<Env>();

// ============ Workout Logs ============

const createWorkoutLogSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  workoutId: z.string().min(1).max(64),
  userId: z.string().min(1).max(64),
  startedAt: z.string().datetime(),
});

const completeWorkoutLogSchema = z.object({
  completedAt: z.string().datetime(),
  overallRpe: z.number().min(1).max(10).optional(),
  notes: z.string().max(1000).optional(),
});

const logQuerySchema = z.object({
  userId: z.string().optional(),
  workoutId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// GET /logs - List workout logs with workout details (only user's own logs)
logRoutes.get(
  "/",
  zValidator("query", logQuerySchema),
  async (c) => {
    // Verify the user is authenticated
    const authResult = await getAuthenticatedUserFromContext(c);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const query = c.req.valid("query");

    // If userId is provided, verify it matches the authenticated user
    if (query.userId && query.userId !== authResult.user.id) {
      return c.json({ error: "Forbidden: You can only access your own logs" }, 403);
    }

    // Build the conditions
    const conditions = query.workoutId
      ? and(eq(workoutLogs.userId, authResult.user.id), eq(workoutLogs.workoutId, query.workoutId))
      : eq(workoutLogs.userId, authResult.user.id);

    const results = await db
      .select({
        id: workoutLogs.id,
        workoutId: workoutLogs.workoutId,
        userId: workoutLogs.userId,
        startedAt: workoutLogs.startedAt,
        completedAt: workoutLogs.completedAt,
        overallRpe: workoutLogs.overallRpe,
        notes: workoutLogs.notes,
        createdAt: workoutLogs.createdAt,
        weekNumber: workouts.weekNumber,
        dayNumber: workouts.dayNumber,
        plannedExercises: workouts.plannedExercises,
      })
      .from(workoutLogs)
      .leftJoin(workouts, eq(workoutLogs.workoutId, workouts.id))
      .where(conditions)
      .orderBy(desc(workoutLogs.startedAt))
      .limit(query.limit)
      .offset(query.offset);

    // Map results to include exerciseCount for convenience
    const enriched = results.map((row) => ({
      id: row.id,
      workoutId: row.workoutId,
      userId: row.userId,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      overallRpe: row.overallRpe,
      notes: row.notes,
      createdAt: row.createdAt,
      weekNumber: row.weekNumber,
      dayNumber: row.dayNumber,
      exerciseCount: Array.isArray(row.plannedExercises) ? row.plannedExercises.length : 0,
    }));

    return c.json({ data: enriched });
  }
);

// GET /logs/:id - Get single workout log with all sets (requires ownership)
logRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  // Verify the authenticated user owns this workout log
  const authResult = await verifyWorkoutLogAccess(c, id);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const sets = await db
    .select()
    .from(loggedSets)
    .where(eq(loggedSets.workoutLogId, id))
    .orderBy(loggedSets.exerciseId, loggedSets.setNumber);

  return c.json({
    data: {
      ...authResult.workoutLog,
      sets,
    },
  });
});

// POST /logs - Start a new workout log (requires ownership of userId)
logRoutes.post(
  "/",
  zValidator("json", createWorkoutLogSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Verify the authenticated user matches the userId in the request
    const authResult = await verifyUserAccess(c, data.userId);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Verify workout exists
    const workout = await db
      .select({ id: workouts.id, status: workouts.status })
      .from(workouts)
      .where(eq(workouts.id, data.workoutId))
      .limit(1);

    if (workout.length === 0) {
      return c.json({ error: "Workout not found" }, 404);
    }

    // Check if log already exists for this workout
    const existingLog = await db
      .select({ id: workoutLogs.id })
      .from(workoutLogs)
      .where(eq(workoutLogs.workoutId, data.workoutId))
      .limit(1);

    if (existingLog.length > 0) {
      return c.json({ error: "Workout log already exists for this workout" }, 409);
    }

    const result = await db
      .insert(workoutLogs)
      .values({
        id: data.id,
        workoutId: data.workoutId,
        userId: data.userId,
        startedAt: new Date(data.startedAt),
      })
      .returning();

    // Update workout status to in_progress
    await db
      .update(workouts)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(workouts.id, data.workoutId));

    return c.json({ data: result[0] }, 201);
  }
);

// PATCH /logs/:id/complete - Complete a workout log (requires ownership)
logRoutes.patch(
  "/:id/complete",
  zValidator("json", completeWorkoutLogSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    // Verify the authenticated user owns this workout log
    const authResult = await verifyWorkoutLogAccess(c, id);
    if (!authResult.authorized) {
      return authResult.response;
    }

    if (authResult.workoutLog.completedAt) {
      return c.json({ error: "Workout log is already completed" }, 400);
    }

    const result = await db
      .update(workoutLogs)
      .set({
        completedAt: new Date(data.completedAt),
        overallRpe: data.overallRpe ?? null,
        notes: data.notes ?? null,
      })
      .where(eq(workoutLogs.id, id))
      .returning();

    // Update workout status to completed
    await db
      .update(workouts)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(workouts.id, authResult.workoutLog.workoutId));

    // Evaluate pending decisions after workout completion
    await evaluatePendingDecisions(authResult.workoutLog.userId, id);

    return c.json({ data: result[0] });
  }
);

// ============ Logged Sets ============

const createSetSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  exerciseId: z.string().min(1).max(64),
  setNumber: z.number().int().min(1).max(20),
  weight: z.number().min(0).max(2000),
  reps: z.number().int().min(0).max(100),
  rpe: z.number().min(1).max(10).optional(),
  notes: z.string().max(500).optional(),
});

const updateSetSchema = z.object({
  weight: z.number().min(0).max(2000).optional(),
  reps: z.number().int().min(0).max(100).optional(),
  rpe: z.number().min(1).max(10).optional(),
  notes: z.string().max(500).optional(),
});

const batchCreateSetsSchema = z.object({
  sets: z.array(createSetSchema),
});

// GET /logs/:logId/sets - Get all sets for a workout log (requires ownership)
logRoutes.get("/:logId/sets", async (c) => {
  const logId = c.req.param("logId");

  // Verify the authenticated user owns this workout log
  const authResult = await verifyWorkoutLogAccess(c, logId);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const sets = await db
    .select()
    .from(loggedSets)
    .where(eq(loggedSets.workoutLogId, logId))
    .orderBy(loggedSets.exerciseId, loggedSets.setNumber);

  return c.json({ data: sets });
});

// POST /logs/:logId/sets - Log a single set (requires ownership)
logRoutes.post(
  "/:logId/sets",
  zValidator("json", createSetSchema),
  async (c) => {
    const logId = c.req.param("logId");
    const data = c.req.valid("json");

    // Verify the authenticated user owns this workout log
    const authResult = await verifyWorkoutLogAccess(c, logId);
    if (!authResult.authorized) {
      return authResult.response;
    }

    if (authResult.workoutLog.completedAt) {
      return c.json({ error: "Cannot add sets to a completed workout" }, 400);
    }

    const result = await db
      .insert(loggedSets)
      .values({
        id: data.id,
        workoutLogId: logId,
        exerciseId: data.exerciseId,
        setNumber: data.setNumber,
        weight: data.weight,
        reps: data.reps,
        rpe: data.rpe ?? null,
        notes: data.notes ?? null,
      })
      .returning();

    return c.json({ data: result[0] }, 201);
  }
);

// POST /logs/:logId/sets/batch - Log multiple sets at once (requires ownership)
logRoutes.post(
  "/:logId/sets/batch",
  zValidator("json", batchCreateSetsSchema),
  async (c) => {
    const logId = c.req.param("logId");
    const { sets } = c.req.valid("json");

    // Verify the authenticated user owns this workout log
    const authResult = await verifyWorkoutLogAccess(c, logId);
    if (!authResult.authorized) {
      return authResult.response;
    }

    if (authResult.workoutLog.completedAt) {
      return c.json({ error: "Cannot add sets to a completed workout" }, 400);
    }

    const setsToInsert = sets.map((set) => ({
      id: set.id,
      workoutLogId: logId,
      exerciseId: set.exerciseId,
      setNumber: set.setNumber,
      weight: set.weight,
      reps: set.reps,
      rpe: set.rpe ?? null,
      notes: set.notes ?? null,
    }));

    const result = await db.insert(loggedSets).values(setsToInsert).returning();

    return c.json({ data: result }, 201);
  }
);

// PATCH /logs/:logId/sets/:setId - Update a logged set (requires ownership)
logRoutes.patch(
  "/:logId/sets/:setId",
  zValidator("json", updateSetSchema),
  async (c) => {
    const logId = c.req.param("logId");
    const setId = c.req.param("setId");
    const data = c.req.valid("json");

    // Verify the authenticated user owns this workout log
    const authResult = await verifyWorkoutLogAccess(c, logId);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Verify set exists and belongs to the log
    const existing = await db
      .select()
      .from(loggedSets)
      .where(and(
        eq(loggedSets.id, setId),
        eq(loggedSets.workoutLogId, logId)
      ))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Set not found" }, 404);
    }

    const updateData: Record<string, unknown> = {};
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.reps !== undefined) updateData.reps = data.reps;
    if (data.rpe !== undefined) updateData.rpe = data.rpe;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const result = await db
      .update(loggedSets)
      .set(updateData)
      .where(eq(loggedSets.id, setId))
      .returning();

    return c.json({ data: result[0] });
  }
);

// DELETE /logs/:logId/sets/:setId - Delete a logged set (requires ownership)
logRoutes.delete("/:logId/sets/:setId", async (c) => {
  const logId = c.req.param("logId");
  const setId = c.req.param("setId");

  // Verify the authenticated user owns this workout log
  const authResult = await verifyWorkoutLogAccess(c, logId);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // Verify set exists and belongs to the log
  const existing = await db
    .select()
    .from(loggedSets)
    .where(and(
      eq(loggedSets.id, setId),
      eq(loggedSets.workoutLogId, logId)
    ))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Set not found" }, 404);
  }

  await db.delete(loggedSets).where(eq(loggedSets.id, setId));

  return c.json({ message: "Set deleted successfully" });
});

// ============ History Queries ============

// GET /logs/exercise/:exerciseId/history - Get history for a specific exercise (only user's own)
logRoutes.get(
  "/exercise/:exerciseId/history",
  zValidator("query", z.object({
    userId: z.string(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })),
  async (c) => {
    const exerciseId = c.req.param("exerciseId");
    const { userId, limit } = c.req.valid("query");

    // Verify the authenticated user matches the userId in the request
    const authResult = await verifyUserAccess(c, userId);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Get recent sets for this exercise from this user
    const sets = await db
      .select({
        set: loggedSets,
        log: workoutLogs,
      })
      .from(loggedSets)
      .innerJoin(workoutLogs, eq(loggedSets.workoutLogId, workoutLogs.id))
      .where(and(
        eq(loggedSets.exerciseId, exerciseId),
        eq(workoutLogs.userId, userId)
      ))
      .orderBy(desc(workoutLogs.startedAt), loggedSets.setNumber)
      .limit(limit * 5); // Get more sets to group by session

    // Group by workout log
    const grouped = sets.reduce((acc, { set, log }) => {
      if (!acc[log.id]) {
        acc[log.id] = {
          logId: log.id,
          date: log.startedAt,
          sets: [],
        };
      }
      acc[log.id]!.sets.push(set);
      return acc;
    }, {} as Record<string, { logId: string; date: Date; sets: typeof sets[0]["set"][] }>);

    const history = Object.values(grouped).slice(0, limit);

    return c.json({ data: history });
  }
);

export { logRoutes };
