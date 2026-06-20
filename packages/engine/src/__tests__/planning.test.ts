import { describe, it, expect } from "vitest";
import { generateWeeklyPlan, calculatePerformanceTrend } from "../planning";
import type { WeeklyPlanInput, ExercisePerformance } from "../planning";

const createMockExercise = (
  overrides: Partial<ExercisePerformance> = {}
): ExercisePerformance => ({
  exerciseId: "bench-press",
  currentWeight: 100,
  currentSets: 4,
  targetRepRange: [8, 10],
  weeksOnExercise: 3,
  recentSets: [
    { reps: 10, rpe: 7, weight: 100 },
    { reps: 9, rpe: 7.5, weight: 100 },
    { reps: 9, rpe: 8, weight: 100 },
  ],
  recentPerformance: [
    { completedSets: 4, targetSets: 4, avgRpe: 7 },
    { completedSets: 4, targetSets: 4, avgRpe: 7.5 },
  ],
  performanceTrend: "stagnant",
  availableSubstitutes: ["incline-bench", "dumbbell-press"],
  ...overrides,
});

describe("generateWeeklyPlan", () => {
  it("generates a normal week plan with no changes needed", () => {
    const input: WeeklyPlanInput = {
      userId: "user-1",
      weekNumber: 3,
      totalWeeks: 12,
      exercises: [createMockExercise()],
      recentWeeklyRpe: [7, 7.5, 7],
      missedSessions: 0,
      consecutiveHardWeeks: 0,
    };

    const result = generateWeeklyPlan(input);

    expect(result.weekNumber).toBe(4);
    expect(result.isDeloadWeek).toBe(false);
    expect(result.exerciseUpdates).toHaveLength(1);
    expect(result.summary).toContain("Week 4");
  });

  it("triggers deload week after consecutive hard weeks", () => {
    const input: WeeklyPlanInput = {
      userId: "user-1",
      weekNumber: 5,
      totalWeeks: 12,
      exercises: [createMockExercise()],
      recentWeeklyRpe: [8, 8.5, 8.5],
      missedSessions: 0,
      consecutiveHardWeeks: 4, // Threshold is 4
    };

    const result = generateWeeklyPlan(input);

    expect(result.weekNumber).toBe(6);
    expect(result.isDeloadWeek).toBe(true);
    expect(result.deloadDecision.recommended).toBe(true);
    expect(result.changes.some(c => c.includes("DELOAD"))).toBe(true);
  });

  it("respects user-requested deload", () => {
    const input: WeeklyPlanInput = {
      userId: "user-1",
      weekNumber: 5,
      totalWeeks: 12,
      exercises: [createMockExercise()],
      recentWeeklyRpe: [6, 6, 6],
      missedSessions: 0,
      consecutiveHardWeeks: 0,
      userRequestedDeload: true,
    };

    const result = generateWeeklyPlan(input);

    expect(result.isDeloadWeek).toBe(true);
    expect(result.deloadDecision.reason).toContain("User requested");
  });

  it("applies deload modifiers to weight and sets", () => {
    const input: WeeklyPlanInput = {
      userId: "user-1",
      weekNumber: 3,
      totalWeeks: 12,
      exercises: [createMockExercise({ currentWeight: 100, currentSets: 4 })],
      recentWeeklyRpe: [9, 9, 9],
      missedSessions: 0,
      consecutiveHardWeeks: 4,
    };

    const result = generateWeeklyPlan(input);

    expect(result.isDeloadWeek).toBe(true);
    const update = result.exerciseUpdates[0];
    // Deload reduces intensity (85%) and volume (60%)
    expect(update?.weight).toBeLessThan(100);
    expect(update?.sets).toBeLessThan(4);
    // Rep range upper bound increases by 2
    expect(update?.repRange[1]).toBe(12);
  });

  it("rotates exercise when stagnant for too long", () => {
    const input: WeeklyPlanInput = {
      userId: "user-1",
      weekNumber: 7,
      totalWeeks: 12,
      exercises: [
        createMockExercise({
          weeksOnExercise: 8, // Stagnant rotation requires minWeeks * 2 = 8
          performanceTrend: "stagnant",
          availableSubstitutes: ["incline-bench", "dumbbell-press"],
        }),
      ],
      recentWeeklyRpe: [7, 7, 7],
      missedSessions: 0,
      consecutiveHardWeeks: 0,
    };

    const result = generateWeeklyPlan(input);

    expect(result.isDeloadWeek).toBe(false);
    const update = result.exerciseUpdates[0];
    // After 8+ weeks of stagnation, rotation should trigger
    expect(update?.newExerciseId).toBeDefined();
  });

  it("does not rotate during deload week", () => {
    const input: WeeklyPlanInput = {
      userId: "user-1",
      weekNumber: 7,
      totalWeeks: 12,
      exercises: [
        createMockExercise({
          weeksOnExercise: 10,
          performanceTrend: "stagnant",
        }),
      ],
      recentWeeklyRpe: [9, 9, 9],
      missedSessions: 0,
      consecutiveHardWeeks: 4,
      userRequestedDeload: true,
    };

    const result = generateWeeklyPlan(input);

    expect(result.isDeloadWeek).toBe(true);
    const update = result.exerciseUpdates[0];
    // No rotation during deload
    expect(update?.newExerciseId).toBeUndefined();
  });

  it("handles multiple exercises", () => {
    const input: WeeklyPlanInput = {
      userId: "user-1",
      weekNumber: 5,
      totalWeeks: 12,
      exercises: [
        createMockExercise({ exerciseId: "bench-press" }),
        createMockExercise({ exerciseId: "squat", currentWeight: 140 }),
        createMockExercise({ exerciseId: "deadlift", currentWeight: 180 }),
      ],
      recentWeeklyRpe: [7, 7.5, 7],
      missedSessions: 0,
      consecutiveHardWeeks: 0,
    };

    const result = generateWeeklyPlan(input);

    expect(result.exerciseUpdates).toHaveLength(3);
    expect(result.exerciseUpdates.map(u => u.exerciseId)).toEqual([
      "bench-press",
      "squat",
      "deadlift",
    ]);
  });

  it("generates accurate summary", () => {
    const input: WeeklyPlanInput = {
      userId: "user-1",
      weekNumber: 5,
      totalWeeks: 12,
      exercises: [createMockExercise()],
      recentWeeklyRpe: [7, 7, 7],
      missedSessions: 0,
      consecutiveHardWeeks: 0,
    };

    const result = generateWeeklyPlan(input);

    expect(result.summary).toMatch(/Week \d+/);
    expect(result.summary).toMatch(/\d+ load, \d+ volume, \d+ rotation changes/);
  });
});

describe("generateWeeklyPlan — constraint enforcement", () => {
  it("substitutes the exercise when constraintDecision is 'substitute'", () => {
    const input: WeeklyPlanInput = {
      userId: "user-1",
      weekNumber: 3,
      totalWeeks: 12,
      exercises: [
        createMockExercise({
          exerciseId: "barbell-back-squat",
          constraintDecision: {
            action: "substitute",
            substituteExerciseId: "goblet-squat",
            isPermanent: false,
            reason: "Uses barbell (no_barbell restriction); substituted with goblet-squat",
          },
        }),
      ],
      recentWeeklyRpe: [7, 7, 7],
      missedSessions: 0,
      consecutiveHardWeeks: 0,
    };

    const result = generateWeeklyPlan(input);
    const update = result.exerciseUpdates[0];

    expect(update?.newExerciseId).toBe("goblet-squat");
    expect(update?.substitutionSource).toBe("constraint");
    expect(update?.omitted).toBeUndefined();
    expect(
      result.changes.some((c) => c.includes("barbell-back-squat → goblet-squat"))
    ).toBe(true);
  });

  it("constraint substitution suppresses the rotation swap", () => {
    const input: WeeklyPlanInput = {
      userId: "user-1",
      weekNumber: 7,
      totalWeeks: 12,
      exercises: [
        createMockExercise({
          exerciseId: "barbell-back-squat",
          // Conditions that would otherwise trigger a rotation swap.
          weeksOnExercise: 10,
          performanceTrend: "stagnant",
          availableSubstitutes: ["leg-press", "hack-squat"],
          constraintDecision: {
            action: "substitute",
            substituteExerciseId: "goblet-squat",
            reason: "constraint",
          },
        }),
      ],
      recentWeeklyRpe: [7, 7, 7],
      missedSessions: 0,
      consecutiveHardWeeks: 0,
    };

    const result = generateWeeklyPlan(input);
    const update = result.exerciseUpdates[0];

    // Constraint target wins; rotation did not also fire.
    expect(update?.newExerciseId).toBe("goblet-squat");
    expect(update?.substitutionSource).toBe("constraint");
    // Only one swap change line for this exercise.
    const swapLines = result.changes.filter((c) =>
      c.startsWith("barbell-back-squat →")
    );
    expect(swapLines).toHaveLength(1);
  });

  it("still applies load/volume/deload scaling to a substituted exercise", () => {
    const input: WeeklyPlanInput = {
      userId: "user-1",
      weekNumber: 3,
      totalWeeks: 12,
      exercises: [
        createMockExercise({
          exerciseId: "barbell-back-squat",
          currentWeight: 100,
          currentSets: 4,
          constraintDecision: {
            action: "substitute",
            substituteExerciseId: "goblet-squat",
            reason: "constraint",
          },
        }),
      ],
      recentWeeklyRpe: [9, 9, 9],
      missedSessions: 0,
      consecutiveHardWeeks: 4, // forces deload
    };

    const result = generateWeeklyPlan(input);
    const update = result.exerciseUpdates[0];

    expect(result.isDeloadWeek).toBe(true);
    expect(update?.newExerciseId).toBe("goblet-squat");
    // Deload still scales the survivor.
    expect(update?.weight).toBeLessThan(100);
    expect(update?.sets).toBeLessThan(4);
    expect(update?.repRange[1]).toBe(12);
  });

  it("omits the exercise when constraintDecision is 'omit'", () => {
    const input: WeeklyPlanInput = {
      userId: "user-1",
      weekNumber: 3,
      totalWeeks: 12,
      exercises: [
        createMockExercise({
          exerciseId: "overhead-press",
          constraintDecision: {
            action: "omit",
            reason: "Involves push_vertical movement (no_overhead restriction)",
          },
        }),
      ],
      recentWeeklyRpe: [7, 7, 7],
      missedSessions: 0,
      consecutiveHardWeeks: 0,
    };

    const result = generateWeeklyPlan(input);
    const update = result.exerciseUpdates[0];

    expect(update?.omitted).toBe(true);
    expect(update?.omissionReason).toContain("no_overhead");
    expect(update?.newExerciseId).toBeUndefined();
    // No progression decisions applied to an omitted exercise.
    expect(update?.decisions.load).toBeUndefined();
    expect(update?.decisions.volume).toBeUndefined();
    expect(update?.decisions.rotation).toBeUndefined();
    expect(result.changes.some((c) => c.startsWith("OMITTED overhead-press"))).toBe(true);
    expect(result.summary).toContain("1 omitted");
  });

  it("omits even on a deload week (safety is unconditional)", () => {
    const input: WeeklyPlanInput = {
      userId: "user-1",
      weekNumber: 3,
      totalWeeks: 12,
      exercises: [
        createMockExercise({
          exerciseId: "overhead-press",
          constraintDecision: {
            action: "omit",
            reason: "Involves push_vertical movement (no_overhead restriction)",
          },
        }),
        createMockExercise({ exerciseId: "bench-press" }),
      ],
      recentWeeklyRpe: [9, 9, 9],
      missedSessions: 0,
      consecutiveHardWeeks: 4, // deload
    };

    const result = generateWeeklyPlan(input);
    expect(result.isDeloadWeek).toBe(true);

    const omitted = result.exerciseUpdates.find((u) => u.exerciseId === "overhead-press");
    expect(omitted?.omitted).toBe(true);
    const survivor = result.exerciseUpdates.find((u) => u.exerciseId === "bench-press");
    expect(survivor?.omitted).toBeUndefined();
  });

  it("is backward-compatible: no constraintDecision → identical output", () => {
    const base: WeeklyPlanInput = {
      userId: "user-1",
      weekNumber: 3,
      totalWeeks: 12,
      exercises: [createMockExercise()],
      recentWeeklyRpe: [7, 7.5, 7],
      missedSessions: 0,
      consecutiveHardWeeks: 0,
    };

    const withAllow = generateWeeklyPlan({
      ...base,
      exercises: [createMockExercise({ constraintDecision: { action: "allow" } })],
    });
    const without = generateWeeklyPlan(base);

    // 'allow' and undefined produce the same shape (modulo substitutionSource,
    // which stays undefined in both cases).
    expect(withAllow.exerciseUpdates[0]?.newExerciseId).toBe(
      without.exerciseUpdates[0]?.newExerciseId
    );
    expect(withAllow.exerciseUpdates[0]?.weight).toBe(
      without.exerciseUpdates[0]?.weight
    );
    expect(withAllow.exerciseUpdates[0]?.sets).toBe(without.exerciseUpdates[0]?.sets);
    expect(without.exerciseUpdates[0]?.substitutionSource).toBeUndefined();
    expect(without.exerciseUpdates[0]?.omitted).toBeUndefined();
    expect(without.summary).not.toContain("omitted");
  });
});

describe("calculatePerformanceTrend", () => {
  it("returns stagnant with insufficient data", () => {
    const result = calculatePerformanceTrend([100, 102], [10, 10]);
    expect(result).toBe("stagnant");
  });

  it("detects improving trend", () => {
    // Newer weights/reps are higher
    const weights = [110, 108, 100, 100, 100];
    const reps = [10, 10, 10, 10, 10];

    const result = calculatePerformanceTrend(weights, reps);
    expect(result).toBe("improving");
  });

  it("detects declining trend", () => {
    // Newer weights are lower
    const weights = [90, 92, 100, 100, 100];
    const reps = [10, 10, 10, 10, 10];

    const result = calculatePerformanceTrend(weights, reps);
    expect(result).toBe("declining");
  });

  it("detects stagnant trend with minimal change", () => {
    // Weights are nearly the same
    const weights = [100, 100, 100, 100, 100];
    const reps = [10, 10, 10, 10, 10];

    const result = calculatePerformanceTrend(weights, reps);
    expect(result).toBe("stagnant");
  });

  it("considers reps in trend calculation via estimated 1RM", () => {
    // Same weight but more reps = improving estimated max
    const weights = [100, 100, 100, 100, 100];
    const reps = [12, 12, 8, 8, 8]; // Recent reps higher

    const result = calculatePerformanceTrend(weights, reps);
    expect(result).toBe("improving");
  });

  it("handles empty arrays gracefully", () => {
    const result = calculatePerformanceTrend([], []);
    expect(result).toBe("stagnant");
  });
});
