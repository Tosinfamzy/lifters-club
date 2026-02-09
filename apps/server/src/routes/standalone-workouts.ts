import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { standaloneWorkouts, workoutLogs, loggedSets, userBaselines, workoutTemplates } from "@gymapp/db/schema";
import { exercises } from "@gymapp/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { logger } from "../lib/logger";
import type { Env } from "../types";
import type { MuscleGroup, EquipmentType } from "@gymapp/types";
import {
  createStandaloneWorkoutSchema,
  updateStandaloneWorkoutSchema,
  generateStandaloneWorkoutSchema,
  workoutStatusSchema,
} from "@gymapp/validation";
import { generateQuickWorkout, type AvailableExercise } from "@gymapp/engine";

const standaloneWorkoutRoutes = new Hono<Env>();

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
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

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
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

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
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

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
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const data = c.req.valid("json");

    // 1. Query exercises that target the focus muscles
    // Build OR conditions for each muscle group
    const muscleConditions = data.focusMuscles.map(
      (muscle) => sql`${exercises.primaryMuscles} @> ${JSON.stringify([muscle])}`
    );

    const matchingExercises = await db
      .select()
      .from(exercises)
      .where(sql`(${sql.join(muscleConditions, sql` OR `)})`)
      .limit(50);

    if (matchingExercises.length === 0) {
      return c.json(
        { error: "No exercises found for the selected muscle groups" },
        400
      );
    }

    // 2. Get user's recent performance for these exercises
    const exerciseIds = matchingExercises.map((e) => e.id);

    const recentPerformance = await db
      .select({
        exerciseId: loggedSets.exerciseId,
        weight: loggedSets.weight,
        reps: loggedSets.reps,
        rpe: loggedSets.rpe,
        createdAt: loggedSets.createdAt,
      })
      .from(loggedSets)
      .innerJoin(workoutLogs, eq(loggedSets.workoutLogId, workoutLogs.id))
      .where(
        and(
          eq(workoutLogs.userId, userId),
          sql`${loggedSets.exerciseId} = ANY(${exerciseIds})`
        )
      )
      .orderBy(desc(loggedSets.createdAt))
      .limit(200);

    // Group by exercise to find most recent performance
    const performanceByExercise = new Map<
      string,
      { weight: number; reps: number; rpe: number | null; date: Date }
    >();
    for (const perf of recentPerformance) {
      if (!performanceByExercise.has(perf.exerciseId)) {
        performanceByExercise.set(perf.exerciseId, {
          weight: perf.weight,
          reps: perf.reps,
          rpe: perf.rpe,
          date: perf.createdAt,
        });
      }
    }

    // 3. Get user's baselines
    const baselines = await db
      .select()
      .from(userBaselines)
      .where(
        and(
          eq(userBaselines.userId, userId),
          sql`${userBaselines.exerciseId} = ANY(${exerciseIds})`
        )
      );

    const baselineByExercise = new Map(
      baselines.map((b) => [b.exerciseId, { weight: b.baselineWeight, reps: b.baselineReps }])
    );

    // 4. Build available exercises for the engine
    const availableExercises: AvailableExercise[] = matchingExercises.map((ex) => {
      const perf = performanceByExercise.get(ex.id);
      const baseline = baselineByExercise.get(ex.id);

      return {
        exerciseId: ex.id,
        primaryMuscles: (ex.primaryMuscles ?? []) as MuscleGroup[],
        secondaryMuscles: (ex.secondaryMuscles ?? []) as MuscleGroup[],
        equipment: (ex.equipment ?? []) as EquipmentType[],
        isCompound: ex.isCompound,
        lastPerformance: perf
          ? { weight: perf.weight, reps: perf.reps, rpe: perf.rpe ?? undefined, date: perf.date }
          : undefined,
        baseline,
      };
    });

    // 5. Call the engine to generate the workout
    const result = generateQuickWorkout({
      focusMuscles: data.focusMuscles,
      availableExercises,
      sessionDurationMinutes: data.sessionDurationMinutes,
      goal: "hypertrophy", // Default goal for quick workouts
    });

    if (result.exercises.length === 0) {
      return c.json(
        { error: "Could not generate a workout with the available exercises" },
        400
      );
    }

    // 6. Create the standalone workout
    const workoutId = `sw_${nanoid(12)}`;
    const workoutName = data.name ?? `${data.focusMuscles.join(" & ")} Workout`;

    const workout = await db
      .insert(standaloneWorkouts)
      .values({
        id: workoutId,
        userId,
        name: workoutName,
        scheduledDate: data.scheduledDate,
        plannedExercises: result.exercises as unknown as Record<string, unknown>[],
        focusMuscles: data.focusMuscles,
        status: "pending",
      })
      .returning();

    // 7. Optionally save as template
    let template = null;
    if (data.saveAsTemplate && data.templateName) {
      const templateId = `tmpl_${nanoid(12)}`;
      const templateResult = await db
        .insert(workoutTemplates)
        .values({
          id: templateId,
          userId,
          name: data.templateName,
          focusMuscles: data.focusMuscles,
          exercises: result.exercises as unknown as Record<string, unknown>[],
          estimatedDurationMinutes: result.estimatedDurationMinutes,
        })
        .returning();
      template = templateResult[0];
    }

    logger.info(
      {
        workoutId,
        userId,
        focusMuscles: data.focusMuscles,
        exerciseCount: result.exercises.length,
        estimatedDuration: result.estimatedDurationMinutes,
      },
      "Generated quick workout"
    );

    return c.json(
      {
        data: {
          workout: workout[0],
          reasoning: result.reasoning,
          estimatedDurationMinutes: result.estimatedDurationMinutes,
          template,
        },
      },
      201
    );
  }
);

// PATCH /standalone-workouts/:id - Update a standalone workout
standaloneWorkoutRoutes.patch(
  "/:id",
  zValidator("json", updateStandaloneWorkoutSchema),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

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

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.scheduledDate !== undefined) updateData.scheduledDate = data.scheduledDate;
    if (data.dayOfWeek !== undefined) updateData.dayOfWeek = data.dayOfWeek;
    if (data.focusMuscles !== undefined) updateData.focusMuscles = data.focusMuscles;
    if (data.exercises !== undefined) updateData.plannedExercises = data.exercises;

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
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

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
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

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
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

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
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

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
