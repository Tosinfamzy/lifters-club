import { describe, it, expect } from "vitest";
import { calculateLoadProgression } from "../progression";
import type { ProgressionInput } from "../types";

describe("calculateLoadProgression", () => {
  it("increases weight when hitting top of rep range with low RPE", () => {
    const input: ProgressionInput = {
      exerciseId: "bench-press",
      recentSets: [
        { reps: 10, rpe: 7, weight: 100 },
        { reps: 10, rpe: 7, weight: 100 },
        { reps: 10, rpe: 7, weight: 100 },
      ],
      currentWeight: 100,
      targetRepRange: [8, 10],
    };

    const result = calculateLoadProgression(input);

    expect(result.action).toBe("increase");
    expect(result.newWeight).toBe(105); // +5kg for weights >= 50
    expect(result.reason).toContain("ready to progress");
  });

  it("uses smaller increment for lighter weights", () => {
    const input: ProgressionInput = {
      exerciseId: "lateral-raise",
      recentSets: [
        { reps: 15, rpe: 6, weight: 10 },
        { reps: 15, rpe: 6, weight: 10 },
      ],
      currentWeight: 10,
      targetRepRange: [12, 15],
    };

    const result = calculateLoadProgression(input);

    expect(result.action).toBe("increase");
    expect(result.newWeight).toBe(12.5); // +2.5kg for weights < 50
  });

  it("decreases weight when below rep range", () => {
    const input: ProgressionInput = {
      exerciseId: "squat",
      recentSets: [
        { reps: 4, rpe: 9, weight: 140 },
        { reps: 3, rpe: 10, weight: 140 },
        { reps: 3, rpe: 10, weight: 140 },
      ],
      currentWeight: 140,
      targetRepRange: [6, 8],
    };

    const result = calculateLoadProgression(input);

    expect(result.action).toBe("decrease");
    expect(result.newWeight).toBe(135);
    expect(result.reason).toContain("reduce load");
  });

  it("decreases weight when RPE is too high", () => {
    const input: ProgressionInput = {
      exerciseId: "deadlift",
      recentSets: [
        { reps: 6, rpe: 10, weight: 180 },
        { reps: 5, rpe: 10, weight: 180 },
      ],
      currentWeight: 180,
      targetRepRange: [5, 7],
    };

    const result = calculateLoadProgression(input);

    expect(result.action).toBe("decrease");
    expect(result.reason).toContain("reduce load");
  });

  it("maintains weight when in target range with moderate RPE", () => {
    const input: ProgressionInput = {
      exerciseId: "row",
      recentSets: [
        { reps: 9, rpe: 8, weight: 80 },
        { reps: 8, rpe: 8, weight: 80 },
        { reps: 8, rpe: 8, weight: 80 },
      ],
      currentWeight: 80,
      targetRepRange: [8, 10],
    };

    const result = calculateLoadProgression(input);

    expect(result.action).toBe("maintain");
    expect(result.newWeight).toBe(80);
    expect(result.reason).toContain("on track");
  });

  it("maintains weight with no recent data", () => {
    const input: ProgressionInput = {
      exerciseId: "press",
      recentSets: [],
      currentWeight: 60,
      targetRepRange: [6, 8],
    };

    const result = calculateLoadProgression(input);

    expect(result.action).toBe("maintain");
    expect(result.newWeight).toBe(60);
    expect(result.reason).toContain("No recent data");
  });

  it("uses default RPE of 7 when no RPE recorded", () => {
    const input: ProgressionInput = {
      exerciseId: "curl",
      recentSets: [
        { reps: 12, weight: 15 },
        { reps: 12, weight: 15 },
      ],
      currentWeight: 15,
      targetRepRange: [10, 12],
    };

    const result = calculateLoadProgression(input);

    // Default RPE 7 < threshold 8, so should increase
    expect(result.action).toBe("increase");
  });

  it("respects custom config", () => {
    const input: ProgressionInput = {
      exerciseId: "bench",
      recentSets: [
        { reps: 10, rpe: 7.5, weight: 100 },
        { reps: 10, rpe: 7.5, weight: 100 },
      ],
      currentWeight: 100,
      targetRepRange: [8, 10],
    };

    // With stricter threshold, should maintain instead of increase
    const result = calculateLoadProgression(input, {
      rpeThresholdForIncrease: 7,
      rpeThresholdForDecrease: 9,
      smallIncrement: 2.5,
      largeIncrement: 5,
      weightThresholdForLargeIncrement: 50,
    });

    expect(result.action).toBe("maintain");
  });
});
