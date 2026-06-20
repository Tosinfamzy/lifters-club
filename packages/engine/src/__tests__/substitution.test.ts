import { describe, it, expect } from "vitest";
import type { Exercise, AthleteConstraints } from "@gymapp/types";
import { findSubstitutes } from "../substitution";
import type { SubstitutionInput } from "../substitution";

function createExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "barbell-back-squat",
    name: "Barbell Back Squat",
    aliases: [],
    equipment: ["barbell"],
    movementPatterns: ["squat"],
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["hamstrings"],
    isCompound: true,
    isUnilateral: false,
    difficulty: "intermediate",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const source = createExercise({ id: "barbell-back-squat" });

// Two plausible squat substitutes: one barbell, one machine.
const candidates: Exercise[] = [
  createExercise({
    id: "front-squat",
    name: "Front Squat",
    equipment: ["barbell"],
    movementPatterns: ["squat"],
    primaryMuscles: ["quads", "glutes"],
  }),
  createExercise({
    id: "leg-press",
    name: "Leg Press",
    equipment: ["machine"],
    movementPatterns: ["squat"],
    primaryMuscles: ["quads", "glutes"],
  }),
];

describe("findSubstitutes with athlete constraints", () => {
  it("returns all viable candidates when no profile is provided (regression)", () => {
    const input: SubstitutionInput = {
      exercise: source,
      candidateExercises: candidates,
    };

    const results = findSubstitutes(input);
    const ids = results.map((r) => r.exercise.id);

    expect(ids).toContain("front-squat");
    expect(ids).toContain("leg-press");
  });

  it("produces identical ranking with an empty profile vs no profile", () => {
    const without = findSubstitutes({ exercise: source, candidateExercises: candidates });
    const emptyProfile: AthleteConstraints = { equipment: [], mobility: [] };
    const withEmpty = findSubstitutes({
      exercise: source,
      candidateExercises: candidates,
      athleteConstraints: emptyProfile,
    });

    expect(withEmpty.map((r) => r.exercise.id)).toEqual(without.map((r) => r.exercise.id));
    expect(withEmpty.map((r) => r.score)).toEqual(without.map((r) => r.score));
  });

  it("drops disallowed candidates (no_barbell removes the barbell substitute)", () => {
    const profile: AthleteConstraints = { equipment: ["no_barbell"], mobility: [] };
    const results = findSubstitutes({
      exercise: source,
      candidateExercises: candidates,
      athleteConstraints: profile,
    });
    const ids = results.map((r) => r.exercise.id);

    expect(ids).not.toContain("front-squat");
    expect(ids).toContain("leg-press");
  });

  it("drops a banned candidate by id", () => {
    const profile: AthleteConstraints = {
      equipment: [],
      mobility: [],
      bannedExerciseIds: ["leg-press"],
    };
    const results = findSubstitutes({
      exercise: source,
      candidateExercises: candidates,
      athleteConstraints: profile,
    });
    const ids = results.map((r) => r.exercise.id);

    expect(ids).not.toContain("leg-press");
    expect(ids).toContain("front-squat");
  });

  it("drops candidates blocked by a mobility restriction", () => {
    const profile: AthleteConstraints = { equipment: [], mobility: ["no_deep_knee_flexion"] };
    const results = findSubstitutes({
      exercise: source,
      candidateExercises: candidates,
      athleteConstraints: profile,
    });

    // Both candidates are squats — all blocked.
    expect(results).toHaveLength(0);
  });
});
