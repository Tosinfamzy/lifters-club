import { describe, it, expect } from "vitest";
import { calculateVolumeAdjustment } from "../volume";
import type { VolumeInput } from "../types";

describe("calculateVolumeAdjustment", () => {
  it("adds set when completing all sets with low RPE", () => {
    const input: VolumeInput = {
      exerciseId: "bench-press",
      currentSetCount: 3,
      recentPerformance: [
        { completedSets: 3, targetSets: 3, avgRpe: 6 },
        { completedSets: 3, targetSets: 3, avgRpe: 6.5 },
      ],
    };

    const result = calculateVolumeAdjustment(input);

    expect(result.action).toBe("add_set");
    expect(result.newSetCount).toBe(4);
    expect(result.reason).toContain("adding volume");
  });

  it("reduces sets when struggling with high RPE", () => {
    const input: VolumeInput = {
      exerciseId: "squat",
      currentSetCount: 5,
      recentPerformance: [
        { completedSets: 4, targetSets: 5, avgRpe: 9.5 },
        { completedSets: 3, targetSets: 5, avgRpe: 9.5 },
      ],
    };

    const result = calculateVolumeAdjustment(input);

    expect(result.action).toBe("reduce_set");
    expect(result.newSetCount).toBe(4);
    expect(result.reason).toContain("reducing volume");
  });

  it("maintains volume when performance is moderate", () => {
    const input: VolumeInput = {
      exerciseId: "row",
      currentSetCount: 4,
      recentPerformance: [
        { completedSets: 4, targetSets: 4, avgRpe: 8 },
        { completedSets: 4, targetSets: 4, avgRpe: 8 },
      ],
    };

    const result = calculateVolumeAdjustment(input);

    expect(result.action).toBe("maintain");
    expect(result.newSetCount).toBe(4);
  });

  it("requires minimum weeks of data before adjusting", () => {
    const input: VolumeInput = {
      exerciseId: "press",
      currentSetCount: 3,
      recentPerformance: [
        { completedSets: 3, targetSets: 3, avgRpe: 5 }, // Only 1 week
      ],
    };

    const result = calculateVolumeAdjustment(input);

    expect(result.action).toBe("maintain");
    expect(result.reason).toContain("Need 2 weeks");
  });

  it("respects max sets limit", () => {
    const input: VolumeInput = {
      exerciseId: "curl",
      currentSetCount: 6,
      recentPerformance: [
        { completedSets: 6, targetSets: 6, avgRpe: 6 },
        { completedSets: 6, targetSets: 6, avgRpe: 6 },
      ],
      maxSetsPerExercise: 6,
    };

    const result = calculateVolumeAdjustment(input);

    // Already at max, can't add more
    expect(result.action).toBe("maintain");
    expect(result.newSetCount).toBe(6);
  });

  it("respects min sets limit", () => {
    const input: VolumeInput = {
      exerciseId: "lateral-raise",
      currentSetCount: 2,
      recentPerformance: [
        { completedSets: 1, targetSets: 2, avgRpe: 9.5 },
        { completedSets: 1, targetSets: 2, avgRpe: 10 },
      ],
      minSetsPerExercise: 2,
    };

    const result = calculateVolumeAdjustment(input);

    // Already at min, can't reduce more
    expect(result.action).toBe("maintain");
    expect(result.newSetCount).toBe(2);
  });

  it("reduces volume when completion rate is low", () => {
    const input: VolumeInput = {
      exerciseId: "deadlift",
      currentSetCount: 4,
      recentPerformance: [
        { completedSets: 2, targetSets: 4, avgRpe: 8 },
        { completedSets: 3, targetSets: 4, avgRpe: 8 },
      ],
    };

    const result = calculateVolumeAdjustment(input);

    expect(result.action).toBe("reduce_set");
    expect(result.reason).toContain("Completion rate");
  });
});
