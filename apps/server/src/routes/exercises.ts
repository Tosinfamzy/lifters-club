import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { exercises } from "@gymapp/db/schema";
import { eq, ilike, or, sql } from "drizzle-orm";
import { getTopSubstitutes } from "@gymapp/engine";
import type { Exercise, EquipmentType, Difficulty } from "@gymapp/types";
import { logger } from "../lib/logger";
import { buildPatchData } from "../lib/patch-utils";

const exerciseRoutes = new Hono();

// Query schema for list endpoint
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  equipment: z.string().optional(),
  movementPattern: z.string().optional(),
  muscleGroup: z.string().optional(),
  isCompound: z.coerce.boolean().optional(),
});

// Schema for creating a new exercise
const createExerciseSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, "ID must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1).max(255),
  aliases: z.array(z.string()).default([]),
  equipment: z.array(z.string()).min(1, "At least one equipment type required"),
  movementPatterns: z.array(z.string()).min(1, "At least one movement pattern required"),
  primaryMuscles: z.array(z.string()).min(1, "At least one primary muscle required"),
  secondaryMuscles: z.array(z.string()).default([]),
  isCompound: z.boolean(),
  isUnilateral: z.boolean().default(false),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  constraints: z.array(z.string()).default([]),
});

// Schema for updating an exercise (all fields optional except id is from URL)
const updateExerciseSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  aliases: z.array(z.string()).optional(),
  equipment: z.array(z.string()).min(1).optional(),
  movementPatterns: z.array(z.string()).min(1).optional(),
  primaryMuscles: z.array(z.string()).min(1).optional(),
  secondaryMuscles: z.array(z.string()).optional(),
  isCompound: z.boolean().optional(),
  isUnilateral: z.boolean().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  constraints: z.array(z.string()).optional(),
});

// GET /exercises - List all exercises with filtering
exerciseRoutes.get(
  "/",
  zValidator("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query");

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [];

    if (query.difficulty) {
      conditions.push(eq(exercises.difficulty, query.difficulty));
    }

    if (query.isCompound !== undefined) {
      conditions.push(eq(exercises.isCompound, query.isCompound));
    }

    // For JSONB array fields, we need to use SQL contains
    if (query.equipment) {
      conditions.push(
        sql`${exercises.equipment} @> ${JSON.stringify([query.equipment])}`
      );
    }

    if (query.movementPattern) {
      conditions.push(
        sql`${exercises.movementPatterns} @> ${JSON.stringify([query.movementPattern])}`
      );
    }

    if (query.muscleGroup) {
      conditions.push(
        sql`(${exercises.primaryMuscles} @> ${JSON.stringify([query.muscleGroup])} OR ${exercises.secondaryMuscles} @> ${JSON.stringify([query.muscleGroup])})`
      );
    }

    // Text search on name and aliases
    if (query.search) {
      const searchPattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(exercises.name, searchPattern),
          sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${exercises.aliases}) AS alias WHERE alias ILIKE ${searchPattern})`
        )!
      );
    }

    // Execute query with conditions
    const results = await db
      .select()
      .from(exercises)
      .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(exercises.name);

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(exercises)
      .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined);

    const total = Number(countResult[0]?.count ?? 0);

    return c.json({
      data: results,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + results.length < total,
      },
    });
  }
);

// GET /exercises/:id - Get single exercise by ID
exerciseRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const result = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, id))
    .limit(1);

  if (result.length === 0) {
    return c.json({ error: "Exercise not found" }, 404);
  }

  return c.json({ data: result[0] });
});

// GET /exercises/search/:term - Search exercises (convenience endpoint)
exerciseRoutes.get("/search/:term", async (c) => {
  const term = c.req.param("term");
  const searchPattern = `%${term}%`;

  const results = await db
    .select()
    .from(exercises)
    .where(
      or(
        ilike(exercises.name, searchPattern),
        sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${exercises.aliases}) AS alias WHERE alias ILIKE ${searchPattern})`
      )
    )
    .limit(20)
    .orderBy(exercises.name);

  return c.json({ data: results });
});

const convenienceQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /exercises/by-pattern/:pattern - Get exercises by movement pattern
exerciseRoutes.get(
  "/by-pattern/:pattern",
  zValidator("query", convenienceQuerySchema),
  async (c) => {
    const pattern = c.req.param("pattern");
    const { limit } = c.req.valid("query");

    const results = await db
      .select()
      .from(exercises)
      .where(sql`${exercises.movementPatterns} @> ${JSON.stringify([pattern])}`)
      .limit(limit)
      .orderBy(exercises.name);

    return c.json({ data: results });
  }
);

// GET /exercises/by-muscle/:muscle - Get exercises by target muscle
exerciseRoutes.get(
  "/by-muscle/:muscle",
  zValidator("query", convenienceQuerySchema),
  async (c) => {
    const muscle = c.req.param("muscle");
    const { limit } = c.req.valid("query");

    const results = await db
      .select()
      .from(exercises)
      .where(
        or(
          sql`${exercises.primaryMuscles} @> ${JSON.stringify([muscle])}`,
          sql`${exercises.secondaryMuscles} @> ${JSON.stringify([muscle])}`
        )
      )
      .limit(limit)
      .orderBy(exercises.name);

    return c.json({ data: results });
  }
);

// GET /exercises/by-equipment/:equipment - Get exercises by equipment
exerciseRoutes.get(
  "/by-equipment/:equipment",
  zValidator("query", convenienceQuerySchema),
  async (c) => {
    const equipment = c.req.param("equipment");
    const { limit } = c.req.valid("query");

    const results = await db
      .select()
      .from(exercises)
      .where(sql`${exercises.equipment} @> ${JSON.stringify([equipment])}`)
      .limit(limit)
      .orderBy(exercises.name);

    return c.json({ data: results });
  }
);

// Schema for substitution query params
const substitutionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
  equipment: z.string().optional(),
  maxDifficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  exclude: z.string().optional(), // Comma-separated exercise IDs to exclude
});

// GET /exercises/:id/substitutes - Find substitutes for an exercise
exerciseRoutes.get(
  "/:id/substitutes",
  zValidator("query", substitutionQuerySchema),
  async (c) => {
    const exerciseId = c.req.param("id");
    const query = c.req.valid("query");

    // Get the source exercise
    const sourceResult = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, exerciseId))
      .limit(1);

    if (sourceResult.length === 0) {
      return c.json({ error: "Exercise not found" }, 404);
    }

    const sourceExercise = sourceResult[0]!;

    // Pre-filter candidates by overlapping movement patterns or primary muscles
    // Use @> containment checks OR'd together (PostgreSQL doesn't support && on JSONB)
    const movementConditions = (sourceExercise.movementPatterns as string[]).map(
      (pattern) => sql`${exercises.movementPatterns} @> ${JSON.stringify([pattern])}`
    );
    const muscleConditions = (sourceExercise.primaryMuscles as string[]).map(
      (muscle) => sql`${exercises.primaryMuscles} @> ${JSON.stringify([muscle])}`
    );

    const allExercises = await db
      .select()
      .from(exercises)
      .where(or(...movementConditions, ...muscleConditions))
      .limit(200);

    // Parse equipment filter if provided
    const availableEquipment = query.equipment
      ? (query.equipment.split(",") as EquipmentType[])
      : undefined;

    // Parse excluded exercise IDs
    const excludeExerciseIds = query.exclude
      ? query.exclude.split(",")
      : [];

    // Define the row type from the query result
    type ExerciseRow = (typeof allExercises)[number];

    // Map database rows to Exercise type
    const mapToExercise = (row: ExerciseRow): Exercise => ({
      id: row.id,
      name: row.name,
      aliases: row.aliases as string[],
      equipment: row.equipment as EquipmentType[],
      movementPatterns: row.movementPatterns as Exercise["movementPatterns"],
      primaryMuscles: row.primaryMuscles as Exercise["primaryMuscles"],
      secondaryMuscles: row.secondaryMuscles as Exercise["secondaryMuscles"],
      isCompound: row.isCompound,
      isUnilateral: row.isUnilateral,
      difficulty: row.difficulty as Difficulty,
      constraints: row.constraints as Exercise["constraints"],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });

    // Find substitutes using the engine algorithm
    const substitutes = getTopSubstitutes(
      {
        exercise: mapToExercise(sourceExercise),
        candidateExercises: allExercises.map(mapToExercise),
        availableEquipment,
        maxDifficulty: query.maxDifficulty,
        excludeExerciseIds,
      },
      query.limit
    );

    return c.json({
      data: {
        sourceExercise: sourceExercise,
        substitutes: substitutes.map((s) => ({
          exercise: s.exercise,
          score: Math.round(s.score * 100),
          matchReasons: s.matchReasons,
        })),
      },
    });
  }
);

// POST /exercises - Create a new exercise
exerciseRoutes.post(
  "/",
  zValidator("json", createExerciseSchema),
  async (c) => {
    const data = c.req.valid("json");

    // Check if exercise with this ID already exists
    const existing = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(eq(exercises.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: `Exercise with ID '${data.id}' already exists` }, 409);
    }

    // Insert the new exercise
    const result = await db
      .insert(exercises)
      .values({
        id: data.id,
        name: data.name,
        aliases: data.aliases,
        equipment: data.equipment,
        movementPatterns: data.movementPatterns,
        primaryMuscles: data.primaryMuscles,
        secondaryMuscles: data.secondaryMuscles,
        isCompound: data.isCompound,
        isUnilateral: data.isUnilateral,
        difficulty: data.difficulty,
        constraints: data.constraints,
      })
      .returning();

    logger.info({ exerciseId: data.id, name: data.name }, "Exercise created");

    return c.json({ data: result[0] }, 201);
  }
);

// PUT /exercises/:id - Update an exercise (full replacement)
exerciseRoutes.put(
  "/:id",
  zValidator("json", createExerciseSchema.omit({ id: true })),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    // Check if exercise exists
    const existing = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(eq(exercises.id, id))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Exercise not found" }, 404);
    }

    // Update the exercise
    const result = await db
      .update(exercises)
      .set({
        name: data.name,
        aliases: data.aliases,
        equipment: data.equipment,
        movementPatterns: data.movementPatterns,
        primaryMuscles: data.primaryMuscles,
        secondaryMuscles: data.secondaryMuscles,
        isCompound: data.isCompound,
        isUnilateral: data.isUnilateral,
        difficulty: data.difficulty,
        constraints: data.constraints,
        updatedAt: new Date(),
      })
      .where(eq(exercises.id, id))
      .returning();

    logger.info({ exerciseId: id }, "Exercise updated");

    return c.json({ data: result[0] });
  }
);

// PATCH /exercises/:id - Partially update an exercise
exerciseRoutes.patch(
  "/:id",
  zValidator("json", updateExerciseSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    // Check if exercise exists
    const existing = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(eq(exercises.id, id))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Exercise not found" }, 404);
    }

    const updateData = buildPatchData(data);

    // Update the exercise
    const result = await db
      .update(exercises)
      .set(updateData)
      .where(eq(exercises.id, id))
      .returning();

    logger.info({ exerciseId: id }, "Exercise updated");

    return c.json({ data: result[0] });
  }
);

// DELETE /exercises/:id - Delete an exercise
exerciseRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  // Check if exercise exists
  const existing = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(eq(exercises.id, id))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Exercise not found" }, 404);
  }

  // Delete the exercise
  await db.delete(exercises).where(eq(exercises.id, id));

  logger.info({ exerciseId: id }, "Exercise deleted");

  return c.json({ message: "Exercise deleted successfully" });
});

export { exerciseRoutes };
