import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { programs } from "@gymapp/db/schema";
import { eq } from "drizzle-orm";

const programRoutes = new Hono();

// Schema for planned exercise within a session
const plannedExerciseSchema = z.object({
  exerciseId: z.string(),
  sets: z.number().int().min(1).max(10),
  repRange: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  restSeconds: z.number().int().min(0).max(600),
  notes: z.string().optional(),
});

// Schema for session template
const sessionTemplateSchema = z.object({
  dayNumber: z.number().int().min(1).max(7),
  name: z.string().min(1).max(100),
  focus: z.array(z.string()),
  exercises: z.array(plannedExerciseSchema),
});

// Schema for program template
const programTemplateSchema = z.object({
  weeks: z.number().int().min(1).max(52),
  sessions: z.array(sessionTemplateSchema),
});

// Schema for creating a program
const createProgramSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  daysPerWeek: z.number().int().min(1).max(7),
  goal: z.enum(["strength", "hypertrophy", "conditioning"]),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  template: programTemplateSchema,
});

// Schema for updating a program
const updateProgramSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  daysPerWeek: z.number().int().min(1).max(7).optional(),
  goal: z.enum(["strength", "hypertrophy", "conditioning"]).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  template: programTemplateSchema.optional(),
});

// Query schema for list endpoint
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  goal: z.enum(["strength", "hypertrophy", "conditioning"]).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  daysPerWeek: z.coerce.number().int().min(1).max(7).optional(),
});

// GET /programs - List all programs
programRoutes.get(
  "/",
  zValidator("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const conditions: ReturnType<typeof eq>[] = [];

    if (query.goal) {
      conditions.push(eq(programs.goal, query.goal));
    }
    if (query.level) {
      conditions.push(eq(programs.level, query.level));
    }
    if (query.daysPerWeek) {
      conditions.push(eq(programs.daysPerWeek, query.daysPerWeek));
    }

    let queryBuilder = db.select().from(programs);

    // Apply conditions if any
    if (conditions.length > 0) {
      for (const condition of conditions) {
        queryBuilder = queryBuilder.where(condition) as typeof queryBuilder;
      }
    }

    const results = await queryBuilder
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(programs.name);

    return c.json({ data: results });
  }
);

// GET /programs/:id - Get single program
programRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const result = await db
    .select()
    .from(programs)
    .where(eq(programs.id, id))
    .limit(1);

  if (result.length === 0) {
    return c.json({ error: "Program not found" }, 404);
  }

  return c.json({ data: result[0] });
});

// POST /programs - Create a new program
programRoutes.post(
  "/",
  zValidator("json", createProgramSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Check if program with this ID already exists
    const existing = await db
      .select({ id: programs.id })
      .from(programs)
      .where(eq(programs.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: `Program with ID '${data.id}' already exists` }, 409);
    }

    const result = await db
      .insert(programs)
      .values({
        id: data.id,
        name: data.name,
        description: data.description ?? null,
        daysPerWeek: data.daysPerWeek,
        goal: data.goal,
        level: data.level,
        template: data.template,
      })
      .returning();

    return c.json({ data: result[0] }, 201);
  }
);

// PATCH /programs/:id - Update a program
programRoutes.patch(
  "/:id",
  zValidator("json", updateProgramSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await db
      .select({ id: programs.id })
      .from(programs)
      .where(eq(programs.id, id))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Program not found" }, 404);
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.daysPerWeek !== undefined) updateData.daysPerWeek = data.daysPerWeek;
    if (data.goal !== undefined) updateData.goal = data.goal;
    if (data.level !== undefined) updateData.level = data.level;
    if (data.template !== undefined) updateData.template = data.template;

    const result = await db
      .update(programs)
      .set(updateData)
      .where(eq(programs.id, id))
      .returning();

    return c.json({ data: result[0] });
  }
);

// DELETE /programs/:id - Delete a program
programRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await db
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.id, id))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Program not found" }, 404);
  }

  await db.delete(programs).where(eq(programs.id, id));

  return c.json({ message: "Program deleted successfully" });
});

export { programRoutes };
