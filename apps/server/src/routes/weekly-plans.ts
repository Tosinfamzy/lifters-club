import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { weeklyPlans, standaloneWorkouts } from "@gymapp/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { logger } from "../lib/logger";
import type { Env } from "../types";
import {
  createWeeklyPlanSchema,
  updateWeeklyPlanSchema,
  generateWeeklyPlanSchema,
  weeklyPlanStatusSchema,
} from "@gymapp/validation";

const weeklyPlanRoutes = new Hono<Env>();

// Query schema for list endpoint
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: weeklyPlanStatusSchema.optional(),
});

// Helper to calculate date for a day number within a week
function getDateForDayNumber(startDate: string, dayNumber: number): string {
  const start = new Date(startDate);
  const startDayOfWeek = start.getDay(); // 0 = Sunday

  // Calculate offset: dayNumber 1 = Monday (we want Monday-based week)
  // If startDate is Monday (1), dayNumber 1 should be same day
  // dayNumber maps to: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
  const targetDayOfWeek = dayNumber === 7 ? 0 : dayNumber; // Convert to JS day (0=Sun)

  let daysToAdd = targetDayOfWeek - startDayOfWeek;
  if (daysToAdd < 0) daysToAdd += 7; // Move to next occurrence if needed

  const targetDate = new Date(start);
  targetDate.setDate(targetDate.getDate() + daysToAdd);

  return targetDate.toISOString().split("T")[0] as string;
}

// GET /weekly-plans - List user's weekly plans
weeklyPlanRoutes.get(
  "/",
  zValidator("query", listQuerySchema),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const query = c.req.valid("query");
    const conditions = [eq(weeklyPlans.userId, userId)];

    if (query.status) {
      conditions.push(eq(weeklyPlans.status, query.status));
    }

    const results = await db
      .select()
      .from(weeklyPlans)
      .where(and(...conditions))
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(weeklyPlans.startDate));

    return c.json({ data: results });
  }
);

// GET /weekly-plans/:id - Get single weekly plan with its workouts
weeklyPlanRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  const plan = await db
    .select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.id, id), eq(weeklyPlans.userId, userId)))
    .limit(1);

  if (plan.length === 0) {
    return c.json({ error: "Weekly plan not found" }, 404);
  }

  // Get all workouts for this plan
  const workouts = await db
    .select()
    .from(standaloneWorkouts)
    .where(eq(standaloneWorkouts.weeklyPlanId, id))
    .orderBy(standaloneWorkouts.dayOfWeek);

  return c.json({
    data: {
      ...plan[0],
      workouts,
    },
  });
});

// POST /weekly-plans - Create a weekly plan with workouts (manual)
weeklyPlanRoutes.post(
  "/",
  zValidator("json", createWeeklyPlanSchema),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const data = c.req.valid("json");
    const planId = `wp_${nanoid(12)}`;

    // Create the weekly plan
    const planResult = await db
      .insert(weeklyPlans)
      .values({
        id: planId,
        userId,
        name: data.name,
        description: data.description ?? null,
        startDate: data.startDate,
        daysPerWeek: data.daysPerWeek,
        goal: data.goal,
        status: "active",
      })
      .returning();

    // Create standalone workouts for each workout in the plan
    const workoutPromises = data.workouts.map((workout) => {
      const workoutId = `sw_${nanoid(12)}`;
      const scheduledDate = getDateForDayNumber(data.startDate, workout.dayNumber);

      return db
        .insert(standaloneWorkouts)
        .values({
          id: workoutId,
          userId,
          weeklyPlanId: planId,
          name: workout.name,
          scheduledDate,
          dayOfWeek: workout.dayNumber,
          plannedExercises: workout.exercises,
          focusMuscles: workout.focusMuscles,
          status: "pending",
        })
        .returning();
    });

    const workoutResults = await Promise.all(workoutPromises);
    const workouts = workoutResults.map((r) => r[0]);

    logger.info(
      { planId, userId, name: data.name, workoutCount: workouts.length },
      "Weekly plan created with workouts"
    );

    return c.json(
      {
        data: {
          ...planResult[0],
          workouts,
        },
      },
      201
    );
  }
);

// POST /weekly-plans/generate - Generate a weekly plan using decision engine
weeklyPlanRoutes.post(
  "/generate",
  zValidator("json", generateWeeklyPlanSchema),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // TODO: Integrate with decision engine
    // This will use the generateWeeklyPlan() function from the engine
    // to create an AI-powered weekly plan based on user's history

    return c.json(
      {
        error: "Engine integration pending",
        message: "The AI weekly plan generation feature requires full engine integration. Use POST /weekly-plans for manual plan creation.",
      },
      501
    );
  }
);

// PATCH /weekly-plans/:id - Update a weekly plan
weeklyPlanRoutes.patch(
  "/:id",
  zValidator("json", updateWeeklyPlanSchema),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await db
      .select({ id: weeklyPlans.id })
      .from(weeklyPlans)
      .where(and(eq(weeklyPlans.id, id), eq(weeklyPlans.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Weekly plan not found" }, 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;

    const result = await db
      .update(weeklyPlans)
      .set(updateData)
      .where(eq(weeklyPlans.id, id))
      .returning();

    logger.info({ planId: id, userId }, "Weekly plan updated");

    return c.json({ data: result[0] });
  }
);

// DELETE /weekly-plans/:id - Delete a weekly plan and its workouts
weeklyPlanRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  const existing = await db
    .select({ id: weeklyPlans.id })
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.id, id), eq(weeklyPlans.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Weekly plan not found" }, 404);
  }

  // Delete associated standalone workouts first
  await db.delete(standaloneWorkouts).where(eq(standaloneWorkouts.weeklyPlanId, id));

  // Delete the plan
  await db.delete(weeklyPlans).where(eq(weeklyPlans.id, id));

  logger.info({ planId: id, userId }, "Weekly plan deleted with workouts");

  return c.json({ message: "Weekly plan and associated workouts deleted successfully" });
});

// POST /weekly-plans/:id/complete - Mark a weekly plan as completed
weeklyPlanRoutes.post("/:id/complete", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.id, id), eq(weeklyPlans.userId, userId)))
    .limit(1);

  const plan = existing[0];
  if (!plan) {
    return c.json({ error: "Weekly plan not found" }, 404);
  }

  if (plan.status === "completed") {
    return c.json({ error: "Plan already completed" }, 400);
  }

  const result = await db
    .update(weeklyPlans)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(weeklyPlans.id, id))
    .returning();

  logger.info({ planId: id, userId }, "Weekly plan completed");

  return c.json({ data: result[0] });
});

export { weeklyPlanRoutes };
