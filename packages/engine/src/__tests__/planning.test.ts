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
