import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { trainingBlocks, workouts, programs, users } from "@gymapp/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { Env } from "../types";

const workoutRoutes = new Hono<Env>();

// Helper to get user by clerkId
async function getUserByClerkId(clerkId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return result[0];
}

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

// GET /training-blocks/:id - Get single training block with program details
workoutRoutes.get("/training-blocks/:id", async (c) => {
  const id = c.req.param("id");

  const result = await db
    .select({
      trainingBlock: trainingBlocks,
      program: programs,
    })
    .from(trainingBlocks)
    .leftJoin(programs, eq(trainingBlocks.programId, programs.id))
    .where(eq(trainingBlocks.id, id))
    .limit(1);

  if (result.length === 0) {
    return c.json({ error: "Training block not found" }, 404);
  }

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
    const startDate = new Date(data.startDate);

    const workoutsToCreate = template.sessions.map((session) => {
      const workoutDate = new Date(startDate);
      workoutDate.setDate(workoutDate.getDate() + session.dayNumber - 1);

      return {
        id: `${data.id}-w1-d${session.dayNumber}`,
        trainingBlockId: data.id,
        scheduledDate: workoutDate.toISOString().split("T")[0]!,
        weekNumber: 1,
        dayNumber: session.dayNumber,
        plannedExercises: session.exercises,
        status: "pending" as const,
      };
    });

    if (workoutsToCreate.length > 0) {
      await db.insert(workouts).values(workoutsToCreate);
    }

    return c.json({ data: result[0] }, 201);
  }
);

// PATCH /training-blocks/:id - Update training block
workoutRoutes.patch(
  "/training-blocks/:id",
  zValidator("json", updateTrainingBlockSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await db
      .select({ id: trainingBlocks.id })
      .from(trainingBlocks)
      .where(eq(trainingBlocks.id, id))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Training block not found" }, 404);
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

    return c.json({ data: result[0] });
  }
);

// ============ Mobile Convenience Endpoints ============

// GET /today - Get today's workout for authenticated user
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

    const today = new Date().toISOString().split("T")[0]!;

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
      return c.json({ data: null, message: "No active training block" });
    }

    // Find today's workout
    const todayWorkout = await db
      .select()
      .from(workouts)
      .where(and(
        eq(workouts.trainingBlockId, activeBlock[0]!.id),
        eq(workouts.scheduledDate, today)
      ))
      .limit(1);

    if (todayWorkout.length === 0) {
      return c.json({ data: null, message: "No workout scheduled for today" });
    }

    return c.json({ data: todayWorkout[0] });
  }
);

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

// GET /workouts - List workouts with filters
workoutRoutes.get(
  "/",
  zValidator("query", workoutQuerySchema),
  async (c) => {
    const query = c.req.valid("query");

    let dbQuery = db.select().from(workouts);

    if (query.trainingBlockId) {
      dbQuery = dbQuery.where(eq(workouts.trainingBlockId, query.trainingBlockId)) as typeof dbQuery;
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

// GET /workouts/:id - Get single workout with details
workoutRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const result = await db
    .select()
    .from(workouts)
    .where(eq(workouts.id, id))
    .limit(1);

  if (result.length === 0) {
    return c.json({ error: "Workout not found" }, 404);
  }

  return c.json({ data: result[0] });
});

// PATCH /workouts/:id - Update workout
workoutRoutes.patch(
  "/:id",
  zValidator("json", updateWorkoutSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await db
      .select({ id: workouts.id })
      .from(workouts)
      .where(eq(workouts.id, id))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Workout not found" }, 404);
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

// POST /workouts/:id/start - Start a workout session
workoutRoutes.post("/:id/start", async (c) => {
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(workouts)
    .where(eq(workouts.id, id))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Workout not found" }, 404);
  }

  if (existing[0]!.status !== "pending") {
    return c.json({ error: "Workout has already been started or completed" }, 400);
  }

  const result = await db
    .update(workouts)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(eq(workouts.id, id))
    .returning();

  return c.json({ data: result[0] });
});

// POST /workouts/:id/complete - Mark workout as complete
workoutRoutes.post("/:id/complete", async (c) => {
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(workouts)
    .where(eq(workouts.id, id))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Workout not found" }, 404);
  }

  if (existing[0]!.status === "completed") {
    return c.json({ error: "Workout is already completed" }, 400);
  }

  const result = await db
    .update(workouts)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(workouts.id, id))
    .returning();

  return c.json({ data: result[0] });
});

// POST /workouts/:id/skip - Skip a workout
workoutRoutes.post("/:id/skip", async (c) => {
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(workouts)
    .where(eq(workouts.id, id))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Workout not found" }, 404);
  }

  if (existing[0]!.status === "completed") {
    return c.json({ error: "Cannot skip a completed workout" }, 400);
  }

  const result = await db
    .update(workouts)
    .set({ status: "skipped", updatedAt: new Date() })
    .where(eq(workouts.id, id))
    .returning();

  return c.json({ data: result[0] });
});

export { workoutRoutes };
