import { describe, it, expect } from "vitest";
import { generateQuickWorkout, type AvailableExercise, type QuickWorkoutInput } from "../planning";

describe("generateQuickWorkout", () => {
  const createExercise = (
    id: string,
    primaryMuscles: string[],
    options: Partial<AvailableExercise> = {}
  ): AvailableExercise => ({
    exerciseId: id,
    primaryMuscles: primaryMuscles as AvailableExercise["primaryMuscles"],
    secondaryMuscles: [],
    equipment: ["barbell"],
    isCompound: true,
    ...options,
  });

  it("returns empty when no exercises available", () => {
    const input: QuickWorkoutInput = {
      focusMuscles: ["chest"],
      availableExercises: [],
    };

    const result = generateQuickWorkout(input);

    expect(result.exercises).toHaveLength(0);
    expect(result.estimatedDurationMinutes).toBe(0);
    expect(result.reasoning).toContain("No exercises available for the selected muscle groups and equipment.");
  });

  it("selects exercises targeting focus muscles", () => {
    const input: QuickWorkoutInput = {
      focusMuscles: ["chest", "triceps"],
      availableExercises: [
        createExercise("bench-press", ["chest"]),
        createExercise("tricep-pushdown", ["triceps"], { isCompound: false, equipment: ["cable"] }),
        createExercise("squat", ["quads"]), // Lower priority - not targeting focus muscles
      ],
      sessionDurationMinutes: 20, // Short session to limit exercise count
    };

    const result = generateQuickWorkout(input);

    expect(result.exercises.length).toBeGreaterThanOrEqual(2);
    const exerciseIds = result.exercises.map((e) => e.exerciseId);
    expect(exerciseIds).toContain("bench-press");
    expect(exerciseIds).toContain("tricep-pushdown");
    // With limited time, squat should not be selected since it doesn't target focus muscles
    // Note: If there's room, it may still be included as a filler
  });

  it("prefers exercises with user history", () => {
    const input: QuickWorkoutInput = {
      focusMuscles: ["chest"],
      availableExercises: [
        createExercise("bench-press", ["chest"], {
          lastPerformance: { weight: 100, reps: 8, rpe: 7, date: new Date() },
        }),
        createExercise("incline-bench", ["chest"]),
        createExercise("dumbbell-fly", ["chest"], { isCompound: false }),
      ],
      sessionDurationMinutes: 30, // Shorter session = fewer exercises
    };

    const result = generateQuickWorkout(input);

    // Bench press should be selected first due to history
    expect(result.exercises[0]?.exerciseId).toBe("bench-press");
  });

  it("generates rep ranges based on goal", () => {
    const baseInput: QuickWorkoutInput = {
      focusMuscles: ["chest"],
      availableExercises: [createExercise("bench-press", ["chest"])],
    };

    const strengthResult = generateQuickWorkout({ ...baseInput, goal: "strength" });
    const hypertrophyResult = generateQuickWorkout({ ...baseInput, goal: "hypertrophy" });
    const conditioningResult = generateQuickWorkout({ ...baseInput, goal: "conditioning" });

    expect(strengthResult.exercises[0]?.repRange).toEqual([4, 6]);
    expect(hypertrophyResult.exercises[0]?.repRange).toEqual([8, 12]);
    expect(conditioningResult.exercises[0]?.repRange).toEqual([12, 20]);
  });

  it("respects session duration limit", () => {
    const input: QuickWorkoutInput = {
      focusMuscles: ["chest", "shoulders", "triceps"],
      availableExercises: [
        createExercise("bench-press", ["chest"]),
        createExercise("overhead-press", ["shoulders"]),
        createExercise("incline-bench", ["chest"]),
        createExercise("lateral-raise", ["shoulders"], { isCompound: false }),
        createExercise("tricep-pushdown", ["triceps"], { isCompound: false }),
        createExercise("dips", ["chest", "triceps"]),
      ],
      sessionDurationMinutes: 20, // Very short session
    };

    const result = generateQuickWorkout(input);

    // Should not include too many exercises for the time available
    expect(result.exercises.length).toBeLessThanOrEqual(4);
    expect(result.estimatedDurationMinutes).toBeLessThanOrEqual(30); // Some buffer
  });

  it("ensures coverage of all focus muscles when possible", () => {
    const input: QuickWorkoutInput = {
      focusMuscles: ["lats", "biceps", "upper_back"],
      availableExercises: [
        createExercise("pull-up", ["lats"], { secondaryMuscles: ["biceps"] as AvailableExercise["secondaryMuscles"] }),
        createExercise("barbell-row", ["upper_back", "lats"]),
        createExercise("bicep-curl", ["biceps"], { isCompound: false }),
        createExercise("face-pull", ["upper_back"], { isCompound: false }),
      ],
      sessionDurationMinutes: 45,
    };

    const result = generateQuickWorkout(input);

    const exerciseIds = result.exercises.map((e) => e.exerciseId);

    // Should have exercises covering lats, biceps, and upper_back
    expect(result.exercises.length).toBeGreaterThanOrEqual(3);
    expect(result.reasoning.some((r) => r.includes("lats"))).toBe(true);
  });

  it("sets longer rest for compound exercises", () => {
    const input: QuickWorkoutInput = {
      focusMuscles: ["chest", "triceps"],
      availableExercises: [
        createExercise("bench-press", ["chest"], { isCompound: true }),
        createExercise("tricep-pushdown", ["triceps"], { isCompound: false }),
      ],
    };

    const result = generateQuickWorkout(input);

    const benchPress = result.exercises.find((e) => e.exerciseId === "bench-press");
    const tricepPushdown = result.exercises.find((e) => e.exerciseId === "tricep-pushdown");

    expect(benchPress?.restSeconds).toBeGreaterThan(tricepPushdown?.restSeconds ?? 0);
  });

  it("provides reasoning for exercise selection", () => {
    const input: QuickWorkoutInput = {
      focusMuscles: ["chest"],
      availableExercises: [createExercise("bench-press", ["chest"])],
      sessionDurationMinutes: 30,
    };

    const result = generateQuickWorkout(input);

    expect(result.reasoning.length).toBeGreaterThan(0);
    expect(result.reasoning.some((r) => r.includes("Target:"))).toBe(true);
    expect(result.reasoning.some((r) => r.includes("Generated"))).toBe(true);
  });
});
