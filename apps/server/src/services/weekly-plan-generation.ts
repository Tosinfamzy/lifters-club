/**
 * Weekly Plan Generation Service
 *
 * Generates a complete weekly training plan by:
 * 1. Distributing muscle groups across training days
 * 2. Calling the engine's generateQuickWorkout() for each day
 * 3. Persisting the plan and workouts in a transaction
 */

import { db } from "@gymapp/db";
import { weeklyPlans, standaloneWorkouts } from "@gymapp/db/schema";
import { nanoid } from "nanoid";
import type { MuscleGroup } from "@gymapp/types";
import { generateWorkoutExercises, WorkoutGenerationError } from "./workout-generation";
import { logger } from "../lib/logger";

export interface GenerateWeeklyPlanInput {
  userId: string;
  startDate: string;
  daysPerWeek: number;
  goal: "strength" | "hypertrophy" | "conditioning";
  name?: string;
  focusMuscles?: MuscleGroup[];
}

export interface GenerateWeeklyPlanResult {
  plan: Record<string, unknown>;
  workouts: Record<string, unknown>[];
  reasoning: string[][];
}

/**
 * Distributes muscle groups across training days using common splits.
 */
function distributeMuscleGroups(
  daysPerWeek: number,
  focusMuscles?: MuscleGroup[]
): { dayNumber: number; name: string; muscles: MuscleGroup[] }[] {
  // If user specified focus muscles and only 1-2 days, use them directly
  if (focusMuscles && focusMuscles.length > 0 && daysPerWeek <= 2) {
    const days = [];
    const musclesPerDay = Math.ceil(focusMuscles.length / daysPerWeek);
    for (let i = 0; i < daysPerWeek; i++) {
      const dayMuscles = focusMuscles.slice(
        i * musclesPerDay,
        (i + 1) * musclesPerDay
      );
      days.push({
        dayNumber: i + 1,
        name: dayMuscles.map(capitalize).join(" & "),
        muscles: dayMuscles,
      });
    }
    return days;
  }

  const splits: Record<number, { name: string; muscles: MuscleGroup[] }[]> = {
    1: [
      { name: "Full Body", muscles: ["chest", "lats", "quads", "shoulders", "core"] },
    ],
    2: [
      { name: "Upper Body", muscles: ["chest", "lats", "shoulders", "biceps", "triceps"] },
      { name: "Lower Body", muscles: ["quads", "hamstrings", "glutes", "calves", "core"] },
    ],
    3: [
      { name: "Push", muscles: ["chest", "shoulders", "triceps"] },
      { name: "Pull", muscles: ["lats", "upper_back", "biceps", "forearms"] },
      { name: "Legs", muscles: ["quads", "hamstrings", "glutes", "calves"] },
    ],
    4: [
      { name: "Upper A", muscles: ["chest", "lats", "shoulders", "biceps", "triceps"] },
      { name: "Lower A", muscles: ["quads", "hamstrings", "glutes", "calves"] },
      { name: "Upper B", muscles: ["chest", "upper_back", "shoulders", "biceps", "triceps"] },
      { name: "Lower B", muscles: ["quads", "hamstrings", "glutes", "core"] },
    ],
    5: [
      { name: "Push", muscles: ["chest", "shoulders", "triceps"] },
      { name: "Pull", muscles: ["lats", "upper_back", "biceps", "forearms"] },
      { name: "Legs", muscles: ["quads", "hamstrings", "glutes", "calves"] },
      { name: "Upper", muscles: ["chest", "lats", "shoulders", "biceps", "triceps"] },
      { name: "Lower", muscles: ["quads", "hamstrings", "glutes", "core"] },
    ],
    6: [
      { name: "Push A", muscles: ["chest", "shoulders", "triceps"] },
      { name: "Pull A", muscles: ["lats", "upper_back", "biceps"] },
      { name: "Legs A", muscles: ["quads", "hamstrings", "glutes"] },
      { name: "Push B", muscles: ["chest", "shoulders", "triceps"] },
      { name: "Pull B", muscles: ["lats", "upper_back", "biceps", "forearms"] },
      { name: "Legs B", muscles: ["quads", "hamstrings", "glutes", "calves"] },
    ],
    7: [
      { name: "Chest", muscles: ["chest", "triceps"] },
      { name: "Back", muscles: ["lats", "upper_back", "biceps"] },
      { name: "Legs", muscles: ["quads", "hamstrings", "glutes"] },
      { name: "Shoulders", muscles: ["shoulders", "forearms"] },
      { name: "Arms", muscles: ["biceps", "triceps", "forearms"] },
      { name: "Lower Body", muscles: ["quads", "hamstrings", "calves"] },
      { name: "Core & Conditioning", muscles: ["core", "glutes"] },
    ],
  };

  const split = splits[daysPerWeek] || splits[3]!;
  return split.map((day, i) => ({
    dayNumber: i + 1,
    name: day.name,
    muscles: day.muscles,
  }));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function getDateForDayNumber(startDate: string, dayNumber: number): string {
  const start = new Date(startDate);
  const startDayOfWeek = start.getDay();
  const targetDayOfWeek = dayNumber === 7 ? 0 : dayNumber;

  let daysToAdd = targetDayOfWeek - startDayOfWeek;
  if (daysToAdd < 0) daysToAdd += 7;

  const targetDate = new Date(start);
  targetDate.setDate(targetDate.getDate() + daysToAdd);

  return targetDate.toISOString().split("T")[0] as string;
}

export async function generateWeeklyPlan(
  input: GenerateWeeklyPlanInput
): Promise<GenerateWeeklyPlanResult> {
  const { userId, startDate, daysPerWeek, goal, name, focusMuscles } = input;

  // 1. Distribute muscle groups across days
  const dayDistribution = distributeMuscleGroups(daysPerWeek, focusMuscles);

  // 2. Generate exercises for each day using the engine
  const generatedDays: {
    dayNumber: number;
    name: string;
    muscles: MuscleGroup[];
    exercises: Record<string, unknown>[];
    reasoning: string[];
    estimatedDuration: number;
  }[] = [];
  const allReasoning: string[][] = [];

  for (const day of dayDistribution) {
    try {
      const result = await generateWorkoutExercises(userId, day.muscles, { goal });
      generatedDays.push({
        dayNumber: day.dayNumber,
        name: day.name,
        muscles: day.muscles,
        exercises: result.exercises as unknown as Record<string, unknown>[],
        reasoning: result.reasoning,
        estimatedDuration: result.estimatedDurationMinutes,
      });
      allReasoning.push(result.reasoning);
    } catch (err) {
      if (err instanceof WorkoutGenerationError) {
        logger.warn(
          { day: day.name, muscles: day.muscles },
          `Skipping day: ${err.message}`
        );
        continue;
      }
      throw err;
    }
  }

  if (generatedDays.length === 0) {
    throw new WorkoutGenerationError(
      "Could not generate any workouts for the plan. Check the exercise library."
    );
  }

  // 3. Persist the plan and workouts in a transaction
  const planId = `wp_${nanoid(12)}`;
  const planName =
    name ??
    `${goal.charAt(0).toUpperCase() + goal.slice(1)} ${daysPerWeek}-Day Plan`;

  const { plan, workouts } = await db.transaction(async (tx) => {
    const [planResult] = await tx
      .insert(weeklyPlans)
      .values({
        id: planId,
        userId,
        name: planName,
        startDate,
        daysPerWeek,
        goal,
        status: "active",
      })
      .returning();

    const workoutResults = [];
    for (const day of generatedDays) {
      const workoutId = `sw_${nanoid(12)}`;
      const scheduledDate = getDateForDayNumber(startDate, day.dayNumber);

      const [workout] = await tx
        .insert(standaloneWorkouts)
        .values({
          id: workoutId,
          userId,
          weeklyPlanId: planId,
          name: day.name,
          scheduledDate,
          dayOfWeek: day.dayNumber,
          plannedExercises: day.exercises as unknown as Record<string, unknown>[],
          focusMuscles: day.muscles,
          status: "pending",
        })
        .returning();

      workoutResults.push(workout);
    }

    return { plan: planResult, workouts: workoutResults };
  });

  logger.info(
    {
      planId,
      userId,
      daysPerWeek,
      goal,
      workoutCount: workouts.length,
    },
    "Generated weekly plan"
  );

  return {
    plan: plan as unknown as Record<string, unknown>,
    workouts: workouts as unknown as Record<string, unknown>[],
    reasoning: allReasoning,
  };
}
