import { describe, it, expect } from "vitest";
import type { Exercise, AthleteConstraints, PermanentSubstitution } from "@gymapp/types";
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

describe("findSubstitutes with permanent substitutions", () => {
  function makeSub(overrides: Partial<PermanentSubstitution> = {}): PermanentSubstitution {
    return {
      originalExerciseId: "barbell-back-squat",
      substituteExerciseId: "leg-press",
      reason: "injury",
      confirmedAt: new Date().toISOString(),
      weightCarries: true,
      ...overrides,
    };
  }

  it("returns a single result flagged isPermanent when a swap matches", () => {
    const results = findSubstitutes({
      exercise: source,
      candidateExercises: candidates,
      permanentSubstitutions: [makeSub()],
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.exercise.id).toBe("leg-press");
    expect(results[0]!.isPermanent).toBe(true);
    expect(results[0]!.score).toBe(1);
    expect(results[0]!.matchReasons[0]).toContain("Permanent substitution");
    expect(results[0]!.matchReasons[0]).toContain("injury");
  });

  it("falls through to ranking when no swap matches this exercise", () => {
    const results = findSubstitutes({
      exercise: source,
      candidateExercises: candidates,
      permanentSubstitutions: [makeSub({ originalExerciseId: "some-other-exercise" })],
    });

    // No short-circuit — both ranked candidates returned, none flagged permanent.
    const ids = results.map((r) => r.exercise.id);
    expect(ids).toContain("front-squat");
    expect(ids).toContain("leg-press");
    expect(results.every((r) => r.isPermanent !== true)).toBe(true);
  });

  it("falls through when the stored substitute isn't among the candidates", () => {
    const results = findSubstitutes({
      exercise: source,
      candidateExercises: candidates,
      permanentSubstitutions: [makeSub({ substituteExerciseId: "not-a-candidate" })],
    });

    // Substitute missing → safety valve: normal ranking, not the stale swap.
    expect(results.length).toBeGreaterThan(1);
    expect(results.every((r) => r.isPermanent !== true)).toBe(true);
  });

  it("does not resurrect a substitute blocked by the athlete's constraints", () => {
    const profile: AthleteConstraints = {
      equipment: [],
      mobility: [],
      bannedExerciseIds: ["leg-press"],
    };
    const results = findSubstitutes({
      exercise: source,
      candidateExercises: candidates,
      athleteConstraints: profile,
      permanentSubstitutions: [makeSub()], // points at the banned leg-press
    });

    // Constraint block wins: leg-press never returned, falls through to ranking.
    const ids = results.map((r) => r.exercise.id);
    expect(ids).not.toContain("leg-press");
    expect(ids).toContain("front-squat");
    expect(results.every((r) => r.isPermanent !== true)).toBe(true);
  });

  it("produces identical output to no-list when the list is absent (regression)", () => {
    const without = findSubstitutes({ exercise: source, candidateExercises: candidates });
    const withEmpty = findSubstitutes({
      exercise: source,
      candidateExercises: candidates,
      permanentSubstitutions: [],
    });

    expect(withEmpty.map((r) => r.exercise.id)).toEqual(without.map((r) => r.exercise.id));
    expect(withEmpty.map((r) => r.score)).toEqual(without.map((r) => r.score));
  });
});
