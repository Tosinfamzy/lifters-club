import { describe, it, expect } from "vitest";
import { calculateExerciseRotation } from "../rotation";
import type { RotationInput } from "../types";

describe("calculateExerciseRotation", () => {
  it("keeps exercise when not enough time on it", () => {
    const input: RotationInput = {
      exerciseId: "bench-press",
      weeksOnExercise: 2,
      performanceTrend: "improving",
      availableSubstitutes: ["incline-press", "dumbbell-press"],
    };

    const result = calculateExerciseRotation(input);

    expect(result.action).toBe("keep");
    expect(result.reason).toContain("minimum 4 weeks");
  });

  it("keeps exercise when no substitutes available", () => {
    const input: RotationInput = {
      exerciseId: "squat",
      weeksOnExercise: 10,
      performanceTrend: "stagnant",
      availableSubstitutes: [],
    };

    const result = calculateExerciseRotation(input);

    expect(result.action).toBe("keep");
    expect(result.reason).toContain("No suitable substitutes");
  });

  it("swaps exercise after max weeks", () => {
    const input: RotationInput = {
      exerciseId: "deadlift",
      weeksOnExercise: 12,
      performanceTrend: "stagnant",
      availableSubstitutes: ["romanian-deadlift", "trap-bar-deadlift"],
    };

    const result = calculateExerciseRotation(input);

    expect(result.action).toBe("swap");
    expect(result.newExerciseId).toBe("romanian-deadlift");
    expect(result.reason).toContain("rotating for variety");
  });

  it("swaps exercise when performance is declining", () => {
    const input: RotationInput = {
      exerciseId: "row",
      weeksOnExercise: 6,
      performanceTrend: "declining",
      availableSubstitutes: ["cable-row", "t-bar-row"],
    };

    const result = calculateExerciseRotation(input);

    expect(result.action).toBe("swap");
    expect(result.newExerciseId).toBe("cable-row");
    expect(result.reason).toContain("Performance declining");
  });

  it("swaps exercise when stagnant for extended period", () => {
    const input: RotationInput = {
      exerciseId: "press",
      weeksOnExercise: 8,
      performanceTrend: "stagnant",
      availableSubstitutes: ["dumbbell-press", "machine-press"],
    };

    const result = calculateExerciseRotation(input);

    expect(result.action).toBe("swap");
    expect(result.reason).toContain("stagnant for extended period");
  });

  it("keeps exercise when improving", () => {
    const input: RotationInput = {
      exerciseId: "curl",
      weeksOnExercise: 8,
      performanceTrend: "improving",
      availableSubstitutes: ["hammer-curl", "preacher-curl"],
    };

    const result = calculateExerciseRotation(input);

    expect(result.action).toBe("keep");
    expect(result.reason).toContain("improving");
  });

  it("keeps exercise when stagnant but not long enough", () => {
    const input: RotationInput = {
      exerciseId: "lateral-raise",
      weeksOnExercise: 5,
      performanceTrend: "stagnant",
      availableSubstitutes: ["cable-lateral-raise"],
    };

    const result = calculateExerciseRotation(input);

    expect(result.action).toBe("keep");
    expect(result.reason).toContain("stagnant");
  });
});
