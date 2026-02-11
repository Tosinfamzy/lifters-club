/**
 * Workout Generation Service
 *
 * Generates quick workouts by:
 * 1. Querying exercises that target the requested muscle groups
 * 2. Fetching user's recent performance and baselines
 * 3. Calling the engine's generateQuickWorkout()
 * 4. Persisting the workout (and optional template) in a transaction
 */

import { db } from "@gymapp/db";
import {
  exercises,
  loggedSets,
  workoutLogs,
  userBaselines,
  standaloneWorkouts,
  workoutTemplates,
} from "@gymapp/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { generateQuickWorkout, type AvailableExercise } from "@gymapp/engine";
import type { MuscleGroup, EquipmentType } from "@gymapp/types";
import { logger } from "../lib/logger";

export interface GenerateWorkoutInput {
  userId: string;
  focusMuscles: MuscleGroup[];
  scheduledDate: string;
  sessionDurationMinutes?: number;
  name?: string;
  saveAsTemplate?: boolean;
  templateName?: string;
}

export interface GenerateWorkoutResult {
  workout: Record<string, unknown>;
  reasoning: string[];
  estimatedDurationMinutes: number;
  template: Record<string, unknown> | null;
}

export async function generateWorkout(
  input: GenerateWorkoutInput
): Promise<GenerateWorkoutResult> {
  const { userId, focusMuscles, scheduledDate, sessionDurationMinutes, name, saveAsTemplate, templateName } = input;

  // 1. Query exercises that target the focus muscles
  const muscleConditions = focusMuscles.map(
    (muscle) => sql`${exercises.primaryMuscles} @> ${JSON.stringify([muscle])}`
  );

  const matchingExercises = await db
    .select()
    .from(exercises)
    .where(sql`(${sql.join(muscleConditions, sql` OR `)})`)
    .limit(50);

  if (matchingExercises.length === 0) {
    throw new WorkoutGenerationError("No exercises found for the selected muscle groups");
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
    focusMuscles,
    availableExercises,
    sessionDurationMinutes,
    goal: "hypertrophy",
  });

  if (result.exercises.length === 0) {
    throw new WorkoutGenerationError("Could not generate a workout with the available exercises");
  }

  // 6. Create the standalone workout (and optional template) in a transaction
  const workoutId = `sw_${nanoid(12)}`;
  const workoutName = name ?? `${focusMuscles.join(" & ")} Workout`;

  const { workout, template } = await db.transaction(async (tx) => {
    const workoutResult = await tx
      .insert(standaloneWorkouts)
      .values({
        id: workoutId,
        userId,
        name: workoutName,
        scheduledDate,
        plannedExercises: result.exercises as unknown as Record<string, unknown>[],
        focusMuscles,
        status: "pending",
      })
      .returning();

    let templateResult = null;
    if (saveAsTemplate && templateName) {
      const templateId = `tmpl_${nanoid(12)}`;
      const [tmpl] = await tx
        .insert(workoutTemplates)
        .values({
          id: templateId,
          userId,
          name: templateName,
          focusMuscles,
          exercises: result.exercises as unknown as Record<string, unknown>[],
          estimatedDurationMinutes: result.estimatedDurationMinutes,
        })
        .returning();
      templateResult = tmpl ?? null;
    }

    return { workout: workoutResult[0], template: templateResult };
  });

  logger.info(
    {
      workoutId,
      userId,
      focusMuscles,
      exerciseCount: result.exercises.length,
      estimatedDuration: result.estimatedDurationMinutes,
    },
    "Generated quick workout"
  );

  return {
    workout: workout as unknown as Record<string, unknown>,
    reasoning: result.reasoning,
    estimatedDurationMinutes: result.estimatedDurationMinutes,
    template: template as unknown as Record<string, unknown> | null,
  };
}

/** Typed error for workout generation failures (maps to 400 responses) */
export class WorkoutGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkoutGenerationError";
  }
}
