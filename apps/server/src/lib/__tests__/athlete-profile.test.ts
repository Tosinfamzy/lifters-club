/**
 * Unit tests for the pure mapping helper in athlete-profile.
 *
 * The DB-backed loaders are exercised end-to-end by the week-generation and
 * exercises route integration tests; here we only cover `mapToExercise`, which
 * is a pure row→domain transform with defensive null handling.
 */

import { describe, it, expect } from "vitest";
import { mapToExercise } from "../athlete-profile";

type ExerciseRow = Parameters<typeof mapToExercise>[0];

const now = new Date("2026-01-01T00:00:00.000Z");

function makeRow(overrides: Partial<ExerciseRow> = {}): ExerciseRow {
  return {
    id: "barbell-back-squat",
    name: "Barbell Back Squat",
    aliases: ["back squat"],
    equipment: ["barbell"],
    movementPatterns: ["squat"],
    primaryMuscles: ["quads"],
    secondaryMuscles: ["glutes"],
    isCompound: true,
    isUnilateral: false,
    difficulty: "intermediate",
    constraints: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as ExerciseRow;
}

describe("mapToExercise", () => {
  it("maps a fully-populated row to the engine Exercise shape", () => {
    const exercise = mapToExercise(makeRow());

    expect(exercise).toEqual({
      id: "barbell-back-squat",
      name: "Barbell Back Squat",
      aliases: ["back squat"],
      equipment: ["barbell"],
      movementPatterns: ["squat"],
      primaryMuscles: ["quads"],
      secondaryMuscles: ["glutes"],
      isCompound: true,
      isUnilateral: false,
      difficulty: "intermediate",
      constraints: [],
      createdAt: now,
      updatedAt: now,
    });
  });

  it("defaults nullable jsonb arrays to empty arrays", () => {
    const exercise = mapToExercise(
      makeRow({ aliases: null, secondaryMuscles: null, constraints: null })
    );

    expect(exercise.aliases).toEqual([]);
    expect(exercise.secondaryMuscles).toEqual([]);
    expect(exercise.constraints).toEqual([]);
  });
});
