import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { workoutTemplates, standaloneWorkouts } from "@gymapp/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { logger } from "../lib/logger";
import type { Env } from "../types";
import {
  createWorkoutTemplateSchema,
  updateWorkoutTemplateSchema,
} from "@gymapp/validation";

const templateRoutes = new Hono<Env>();

// Query schema for list endpoint
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// GET /templates - List user's workout templates
templateRoutes.get(
  "/",
  zValidator("query", listQuerySchema),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const query = c.req.valid("query");

    const results = await db
      .select()
      .from(workoutTemplates)
      .where(eq(workoutTemplates.userId, userId))
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(workoutTemplates.updatedAt));

    return c.json({ data: results });
  }
);

// GET /templates/:id - Get single template
templateRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  const result = await db
    .select()
    .from(workoutTemplates)
    .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, userId)))
    .limit(1);

  if (result.length === 0) {
    return c.json({ error: "Template not found" }, 404);
  }

  return c.json({ data: result[0] });
});

// POST /templates - Create a new template
templateRoutes.post(
  "/",
  zValidator("json", createWorkoutTemplateSchema),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const data = c.req.valid("json");
    const id = `tmpl_${nanoid(12)}`;

    const result = await db
      .insert(workoutTemplates)
      .values({
        id,
        userId,
        name: data.name,
        description: data.description ?? null,
        focusMuscles: data.focusMuscles,
        exercises: data.exercises,
        estimatedDurationMinutes: data.estimatedDurationMinutes ?? null,
      })
      .returning();

    logger.info({ templateId: id, userId, name: data.name }, "Workout template created");

    return c.json({ data: result[0] }, 201);
  }
);

// PATCH /templates/:id - Update a template
templateRoutes.patch(
  "/:id",
  zValidator("json", updateWorkoutTemplateSchema),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await db
      .select({ id: workoutTemplates.id })
      .from(workoutTemplates)
      .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Template not found" }, 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.focusMuscles !== undefined) updateData.focusMuscles = data.focusMuscles;
    if (data.exercises !== undefined) updateData.exercises = data.exercises;
    if (data.estimatedDurationMinutes !== undefined)
      updateData.estimatedDurationMinutes = data.estimatedDurationMinutes;

    const result = await db
      .update(workoutTemplates)
      .set(updateData)
      .where(eq(workoutTemplates.id, id))
      .returning();

    logger.info({ templateId: id, userId }, "Workout template updated");

    return c.json({ data: result[0] });
  }
);

// DELETE /templates/:id - Delete a template
templateRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  const existing = await db
    .select({ id: workoutTemplates.id })
    .from(workoutTemplates)
    .where(and(eq(workoutTemplates.id, id), eq(workoutTemplates.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Template not found" }, 404);
  }

  await db.delete(workoutTemplates).where(eq(workoutTemplates.id, id));

  logger.info({ templateId: id, userId }, "Workout template deleted");

  return c.json({ message: "Template deleted successfully" });
});

// POST /templates/:id/use - Create a standalone workout from template
templateRoutes.post(
  "/:id/use",
  zValidator(
    "json",
    z.object({
      scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
      name: z.string().min(1).max(255).optional(),
    })
  ),
  async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const templateId = c.req.param("id");
    const data = c.req.valid("json");

    // Get the template
    const template = await db
      .select()
      .from(workoutTemplates)
      .where(and(eq(workoutTemplates.id, templateId), eq(workoutTemplates.userId, userId)))
      .limit(1);

    const templateRecord = template[0];
    if (!templateRecord) {
      return c.json({ error: "Template not found" }, 404);
    }

    const workoutId = `sw_${nanoid(12)}`;

    const result = await db
      .insert(standaloneWorkouts)
      .values({
        id: workoutId,
        userId,
        templateId,
        name: data.name ?? templateRecord.name,
        scheduledDate: data.scheduledDate,
        plannedExercises: templateRecord.exercises,
        focusMuscles: templateRecord.focusMuscles,
        status: "pending",
      })
      .returning();

    logger.info(
      { workoutId, templateId, userId, scheduledDate: data.scheduledDate },
      "Standalone workout created from template"
    );

    return c.json({ data: result[0] }, 201);
  }
);

export { templateRoutes };
