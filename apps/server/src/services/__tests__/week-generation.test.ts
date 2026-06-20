/**
 * Integration tests for constraint-aware week generation.
 *
 * Exercises the live `generateNextWeek` path against the test database (5433),
 * seeding exercises, users, athlete_constraints, permanent_substitutions,
 * programs, training_blocks, and logged_sets. Verifies that constraint
 * substitutions and omissions flow through into the persisted workouts'
 * `plannedExercises`, and that an unconstrained user's output is unchanged.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { db } from "@gymapp/db";
import {
  exercises,
  users,
  programs,
  trainingBlocks,
  workouts,
  workoutLogs,
  loggedSets,
  athleteConstraints,
  permanentSubstitutions,
  decisions,
} from "@gymapp/db/schema";
import { like, inArray } from "drizzle-orm";
import { generateNextWeek } from "../week-generation";

const PREFIX = "wgtest";

// Exercises: a barbell squat (blockable by no_barbell) with a safe substitute,
// and an overhead press (blockable by no_overhead) with no safe substitute in
// the seeded pool.
const seedExercises = [
  {
    id: `${PREFIX}-barbell-squat`,
    name: "Barbell Back Squat",
    aliases: [],
    equipment: ["barbell"],
    movementPatterns: ["squat"],
    primaryMuscles: ["quads"],
    secondaryMuscles: ["glutes"],
    isCompound: true,
    isUnilateral: false,
    difficulty: "intermediate",
    constraints: [],
  },
  {
    id: `${PREFIX}-goblet-squat`,
    name: "Goblet Squat",
    aliases: [],
    equipment: ["dumbbell"],
    movementPatterns: ["squat"],
    primaryMuscles: ["quads"],
    secondaryMuscles: ["glutes"],
    isCompound: true,
    isUnilateral: false,
    difficulty: "beginner",
    constraints: [],
  },
  {
    // Deliberately isolated (unique equipment/muscle/compound profile) so the
    // seeded pool has no meaningful substitute → must be omitted, not swapped.
    id: `${PREFIX}-overhead-press`,
    name: "Cable Lateral Raise",
    aliases: [],
    equipment: ["cable"],
    movementPatterns: ["push_vertical"],
    primaryMuscles: ["shoulders"],
    secondaryMuscles: [],
    isCompound: false,
    isUnilateral: false,
    difficulty: "beginner",
    constraints: [],
  },
];

const seedExerciseIds = seedExercises.map((e) => e.id);

const program = {
  id: `${PREFIX}-program`,
  name: "WG Test Program",
  description: null,
  daysPerWeek: 1,
  goal: "hypertrophy" as const,
  level: "intermediate" as const,
  template: {
    weeks: 4,
    sessions: [
      {
        dayNumber: 1,
        name: "Full Body",
        focus: ["quads", "shoulders"],
        exercises: [
          {
            exerciseId: `${PREFIX}-barbell-squat`,
            sets: 4,
            repRange: [8, 10] as [number, number],
            restSeconds: 120,
          },
          {
            exerciseId: `${PREFIX}-overhead-press`,
            sets: 3,
            repRange: [8, 10] as [number, number],
            restSeconds: 90,
          },
        ],
      },
    ],
  },
};

function userId(suffix: string): string {
  return `${PREFIX}-user-${suffix}`;
}

function blockId(suffix: string): string {
  return `${PREFIX}-block-${suffix}`;
}

async function seedUser(suffix: string): Promise<void> {
  const id = userId(suffix);
  await db.insert(users).values({
    id,
    clerkId: id,
    email: `${id}@example.com`,
    trainingLevel: "intermediate",
    primaryGoal: "hypertrophy",
    preferences: {},
  });
}

async function seedBlock(suffix: string): Promise<string> {
  const id = blockId(suffix);
  await db.insert(trainingBlocks).values({
    id,
    userId: userId(suffix),
    programId: program.id,
    startDate: "2026-01-01",
    currentWeek: 1,
    status: "active",
  });
  return id;
}

/**
 * Seed a small history of logged sets for the squat so it has recent
 * performance to progress (and survives the "no history" branch).
 */
async function seedSquatHistory(suffix: string): Promise<void> {
  const logId = `${PREFIX}-log-${suffix}`;
  await db.insert(workoutLogs).values({
    id: logId,
    userId: userId(suffix),
    startedAt: new Date(),
    overallRpe: 7,
  });
  await db.insert(loggedSets).values([
    {
      id: `${PREFIX}-set-${suffix}-1`,
      workoutLogId: logId,
      exerciseId: `${PREFIX}-barbell-squat`,
      setNumber: 1,
      weight: 100,
      reps: 8,
      rpe: 7,
    },
    {
      id: `${PREFIX}-set-${suffix}-2`,
      workoutLogId: logId,
      exerciseId: `${PREFIX}-barbell-squat`,
      setNumber: 2,
      weight: 100,
      reps: 8,
      rpe: 7,
    },
  ]);
}

interface PlannedExerciseRow {
  exerciseId: string;
  sets: number;
}

async function cleanup(): Promise<void> {
  await db.delete(decisions).where(like(decisions.userId, `${PREFIX}-%`));
  await db.delete(loggedSets).where(like(loggedSets.id, `${PREFIX}-%`));
  await db.delete(workoutLogs).where(like(workoutLogs.userId, `${PREFIX}-%`));
  await db.delete(workouts).where(like(workouts.trainingBlockId, `${PREFIX}-%`));
  await db.delete(trainingBlocks).where(like(trainingBlocks.id, `${PREFIX}-%`));
  await db
    .delete(permanentSubstitutions)
    .where(like(permanentSubstitutions.userId, `${PREFIX}-%`));
  await db
    .delete(athleteConstraints)
    .where(like(athleteConstraints.userId, `${PREFIX}-%`));
  await db.delete(users).where(like(users.id, `${PREFIX}-%`));
  await db.delete(programs).where(like(programs.id, `${PREFIX}-%`));
  await db.delete(exercises).where(inArray(exercises.id, seedExerciseIds));
}

describe("generateNextWeek — constraint enforcement (integration)", () => {
  beforeAll(async () => {
    await cleanup();
    await db.insert(exercises).values(seedExercises);
    await db.insert(programs).values(program);
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    // Per-test cleanup of user-scoped rows (exercises/program persist).
    await db.delete(decisions).where(like(decisions.userId, `${PREFIX}-%`));
    await db.delete(loggedSets).where(like(loggedSets.id, `${PREFIX}-%`));
    await db.delete(workoutLogs).where(like(workoutLogs.userId, `${PREFIX}-%`));
    await db.delete(workouts).where(like(workouts.trainingBlockId, `${PREFIX}-%`));
    await db.delete(trainingBlocks).where(like(trainingBlocks.id, `${PREFIX}-%`));
    await db
      .delete(permanentSubstitutions)
      .where(like(permanentSubstitutions.userId, `${PREFIX}-%`));
    await db
      .delete(athleteConstraints)
      .where(like(athleteConstraints.userId, `${PREFIX}-%`));
    await db.delete(users).where(like(users.id, `${PREFIX}-%`));
  });

  it("substitutes a constrained exercise with a valid candidate", async () => {
    const suffix = "sub";
    await seedUser(suffix);
    const block = await seedBlock(suffix);
    await seedSquatHistory(suffix);
    // Ban only the squat (a per-exercise block). Goblet squat (same squat
    // pattern, dumbbell) is a safe candidate. The overhead press is untouched.
    await db.insert(athleteConstraints).values({
      id: `${PREFIX}-ac-${suffix}`,
      userId: userId(suffix),
      equipment: [],
      mobility: [],
      injuries: [],
      bannedExerciseIds: [`${PREFIX}-barbell-squat`],
      correctivePriorityExerciseIds: [],
    });

    const result = await generateNextWeek(block, userId(suffix));

    const workout = result.workouts[0]!;
    const planned = workout.plannedExercises as unknown as PlannedExerciseRow[];
    const ids = planned.map((p) => p.exerciseId);

    // Substitute is scheduled; original barbell squat is gone.
    expect(ids).toContain(`${PREFIX}-goblet-squat`);
    expect(ids).not.toContain(`${PREFIX}-barbell-squat`);
    // Unconstrained overhead press is untouched.
    expect(ids).toContain(`${PREFIX}-overhead-press`);
    expect(planned).toHaveLength(2);
  });

  it("omits a constrained exercise when no candidate exists", async () => {
    const suffix = "omit";
    await seedUser(suffix);
    const block = await seedBlock(suffix);
    await seedSquatHistory(suffix);
    // no_overhead blocks the overhead press; the seeded pool has no other
    // push_vertical exercise, so it must be omitted (not substituted).
    await db.insert(athleteConstraints).values({
      id: `${PREFIX}-ac-${suffix}`,
      userId: userId(suffix),
      equipment: [],
      mobility: ["no_overhead"],
      injuries: [],
      bannedExerciseIds: [],
      correctivePriorityExerciseIds: [],
    });

    const result = await generateNextWeek(block, userId(suffix));

    const workout = result.workouts[0]!;
    const planned = workout.plannedExercises as unknown as PlannedExerciseRow[];
    const ids = planned.map((p) => p.exerciseId);

    // Session started with 2 exercises; the overhead press is omitted → 1 left.
    expect(ids).not.toContain(`${PREFIX}-overhead-press`);
    expect(ids).toContain(`${PREFIX}-barbell-squat`);
    expect(planned).toHaveLength(1);
  });

  it("produces identical scheduled exercises for an unconstrained user", async () => {
    const suffix = "plain";
    await seedUser(suffix);
    const block = await seedBlock(suffix);
    await seedSquatHistory(suffix);
    // No athlete_constraints, no permanent_substitutions → fast path.

    const result = await generateNextWeek(block, userId(suffix));

    const workout = result.workouts[0]!;
    const planned = workout.plannedExercises as unknown as PlannedExerciseRow[];
    const ids = planned.map((p) => p.exerciseId).sort();

    // Both original exercises remain, unchanged ids.
    expect(ids).toEqual(
      [`${PREFIX}-barbell-squat`, `${PREFIX}-overhead-press`].sort()
    );
  });
});
