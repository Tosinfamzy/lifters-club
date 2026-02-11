import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { standaloneWorkouts } from "@gymapp/db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { logger } from "../lib/logger";
import { buildPatchData } from "../lib/patch-utils";
import type { Env } from "../types";
import {
  createStandaloneWorkoutSchema,
  updateStandaloneWorkoutSchema,
  generateStandaloneWorkoutSchema,
  workoutStatusSchema,
} from "@gymapp/validation";
import { generateWorkout, WorkoutGenerationError } from "../services/workout-generation";

const standaloneWorkoutRoutes = new Hono<Env>();

// Require authenticated user for all standalone workout routes
standaloneWorkoutRoutes.use("*", async (c, next) => {
  if (!c.get("userId")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

// Query schema for list endpoint
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: workoutStatusSchema.optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  weeklyPlanId: z.string().optional(),
});

// GET /standalone-workouts - List user's standalone workouts
standaloneWorkoutRoutes.get(
  "/",
  zValidator("query", listQuerySchema),
  async (c) => {
    const userId = c.get("userId")!;

    const query = c.req.valid("query");
    const conditions = [eq(standaloneWorkouts.userId, userId)];

    if (query.status) {
      conditions.push(eq(standaloneWorkouts.status, query.status));
    }
    if (query.fromDate) {
      conditions.push(gte(standaloneWorkouts.scheduledDate, query.fromDate));
    }
    if (query.toDate) {
      conditions.push(lte(standaloneWorkouts.scheduledDate, query.toDate));
    }
    if (query.weeklyPlanId) {
      conditions.push(eq(standaloneWorkouts.weeklyPlanId, query.weeklyPlanId));
    }

    const results = await db
      .select()
      .from(standaloneWorkouts)
      .where(and(...conditions))
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(standaloneWorkouts.scheduledDate));

    return c.json({ data: results });
  }
);

// GET /standalone-workouts/:id - Get single standalone workout
standaloneWorkoutRoutes.get("/:id", async (c) => {
  const userId = c.get("userId")!;

  const id = c.req.param("id");

  const result = await db
    .select()
    .from(standaloneWorkouts)
    .where(and(eq(standaloneWorkouts.id, id), eq(standaloneWorkouts.userId, userId)))
    .limit(1);

  if (result.length === 0) {
    return c.json({ error: "Standalone workout not found" }, 404);
  }

  return c.json({ data: result[0] });
});

// POST /standalone-workouts - Create a standalone workout (manual exercise selection)
standaloneWorkoutRoutes.post(
  "/",
  zValidator("json", createStandaloneWorkoutSchema),
  async (c) => {
    const userId = c.get("userId")!;

    const data = c.req.valid("json");
    const id = `sw_${nanoid(12)}`;

    const result = await db
      .insert(standaloneWorkouts)
      .values({
        id,
        userId,
        templateId: data.templateId ?? null,
        weeklyPlanId: data.weeklyPlanId ?? null,
        name: data.name,
        scheduledDate: data.scheduledDate,
        dayOfWeek: data.dayOfWeek ?? null,
        plannedExercises: data.exercises,
        focusMuscles: data.focusMuscles,
        status: "pending",
      })
      .returning();

    logger.info(
      { workoutId: id, userId, name: data.name, scheduledDate: data.scheduledDate },
      "Standalone workout created"
    );

    return c.json({ data: result[0] }, 201);
  }
);

// POST /standalone-workouts/generate - Generate a workout with AI (auto-select exercises)
standaloneWorkoutRoutes.post(
  "/generate",
  zValidator("json", generateStandaloneWorkoutSchema),
  async (c) => {
    const userId = c.get("userId")!;

    const data = c.req.valid("json");

    try {
      const result = await generateWorkout({
        userId,
        focusMuscles: data.focusMuscles,
        scheduledDate: data.scheduledDate,
        sessionDurationMinutes: data.sessionDurationMinutes,
        name: data.name,
        saveAsTemplate: data.saveAsTemplate,
        templateName: data.templateName,
      });

      return c.json({ data: result }, 201);
    } catch (error) {
      if (error instanceof WorkoutGenerationError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  }
);

// PATCH /standalone-workouts/:id - Update a standalone workout
standaloneWorkoutRoutes.patch(
  "/:id",
  zValidator("json", updateStandaloneWorkoutSchema),
  async (c) => {
    const userId = c.get("userId")!;

    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await db
      .select({ id: standaloneWorkouts.id, status: standaloneWorkouts.status })
      .from(standaloneWorkouts)
      .where(and(eq(standaloneWorkouts.id, id), eq(standaloneWorkouts.userId, userId)))
      .limit(1);

    const workout = existing[0];
    if (!workout) {
      return c.json({ error: "Standalone workout not found" }, 404);
    }

    // Don't allow updating completed or skipped workouts
    if (workout.status === "completed" || workout.status === "skipped") {
      return c.json({ error: "Cannot update a completed or skipped workout" }, 400);
    }

    const updateData = buildPatchData(data);
    // Map `exercises` field to the DB column name `plannedExercises`
    if (data.exercises !== undefined) {
      updateData.plannedExercises = data.exercises;
      delete updateData.exercises;
    }

    const result = await db
      .update(standaloneWorkouts)
      .set(updateData)
      .where(eq(standaloneWorkouts.id, id))
      .returning();

    logger.info({ workoutId: id, userId }, "Standalone workout updated");

    return c.json({ data: result[0] });
  }
);

// DELETE /standalone-workouts/:id - Delete a standalone workout
standaloneWorkoutRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId")!;

  const id = c.req.param("id");

  const existing = await db
    .select({ id: standaloneWorkouts.id })
    .from(standaloneWorkouts)
    .where(and(eq(standaloneWorkouts.id, id), eq(standaloneWorkouts.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Standalone workout not found" }, 404);
  }

  await db.delete(standaloneWorkouts).where(eq(standaloneWorkouts.id, id));

  logger.info({ workoutId: id, userId }, "Standalone workout deleted");

  return c.json({ message: "Standalone workout deleted successfully" });
});

// POST /standalone-workouts/:id/start - Start a standalone workout
standaloneWorkoutRoutes.post("/:id/start", async (c) => {
  const userId = c.get("userId")!;

  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(standaloneWorkouts)
    .where(and(eq(standaloneWorkouts.id, id), eq(standaloneWorkouts.userId, userId)))
    .limit(1);

  const workout = existing[0];
  if (!workout) {
    return c.json({ error: "Standalone workout not found" }, 404);
  }

  if (workout.status !== "pending") {
    return c.json({ error: `Cannot start workout with status '${workout.status}'` }, 400);
  }

  const result = await db
    .update(standaloneWorkouts)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(eq(standaloneWorkouts.id, id))
    .returning();

  logger.info({ workoutId: id, userId }, "Standalone workout started");

  return c.json({ data: result[0] });
});

// POST /standalone-workouts/:id/complete - Complete a standalone workout
standaloneWorkoutRoutes.post("/:id/complete", async (c) => {
  const userId = c.get("userId")!;

  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(standaloneWorkouts)
    .where(and(eq(standaloneWorkouts.id, id), eq(standaloneWorkouts.userId, userId)))
    .limit(1);

  const workout = existing[0];
  if (!workout) {
    return c.json({ error: "Standalone workout not found" }, 404);
  }

  if (workout.status === "completed") {
    return c.json({ error: "Workout already completed" }, 400);
  }

  if (workout.status === "skipped") {
    return c.json({ error: "Cannot complete a skipped workout" }, 400);
  }

  const result = await db
    .update(standaloneWorkouts)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(standaloneWorkouts.id, id))
    .returning();

  logger.info({ workoutId: id, userId }, "Standalone workout completed");

  return c.json({ data: result[0] });
});

// POST /standalone-workouts/:id/skip - Skip a standalone workout
standaloneWorkoutRoutes.post("/:id/skip", async (c) => {
  const userId = c.get("userId")!;

  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(standaloneWorkouts)
    .where(and(eq(standaloneWorkouts.id, id), eq(standaloneWorkouts.userId, userId)))
    .limit(1);

  const workout = existing[0];
  if (!workout) {
    return c.json({ error: "Standalone workout not found" }, 404);
  }

  if (workout.status === "completed") {
    return c.json({ error: "Cannot skip a completed workout" }, 400);
  }

  if (workout.status === "skipped") {
    return c.json({ error: "Workout already skipped" }, 400);
  }

  const result = await db
    .update(standaloneWorkouts)
    .set({ status: "skipped", updatedAt: new Date() })
    .where(eq(standaloneWorkouts.id, id))
    .returning();

  logger.info({ workoutId: id, userId }, "Standalone workout skipped");

  return c.json({ data: result[0] });
});

export { standaloneWorkoutRoutes };
