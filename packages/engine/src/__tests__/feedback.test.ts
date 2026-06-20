import { describe, it, expect } from "vitest";
import { getProgressionModifier } from "../feedback";
import { applyProgressionModifier } from "../progression";
import { applyVolumeModifier } from "../volume";
import type { ProgressionConfig } from "../progression";
import type { VolumeConfig } from "../volume";
import type { DecisionAccuracyStats, DecisionType } from "@gymapp/types";

// Mirrors the engine's module-private defaults (not exported).
const DEFAULT_PROGRESSION_CONFIG: ProgressionConfig = {
  rpeThresholdForIncrease: 8,
  rpeThresholdForDecrease: 9,
  smallIncrement: 2.5,
  largeIncrement: 5,
  weightThresholdForLargeIncrement: 50,
};

const DEFAULT_VOLUME_CONFIG: VolumeConfig = {
  minSets: 2,
  maxSets: 6,
  rpeThresholdForAdd: 7,
  rpeThresholdForReduce: 9,
  weeksBeforeAdjustment: 2,
};

function makeStats(
  type: DecisionType,
  total: number,
  successRate: number
): DecisionAccuracyStats {
  return {
    userId: "user-1",
    totalDecisions: total,
    followed: total,
    overridden: 0,
    ignored: 0,
    successRate,
    overrideReasons: {},
    byType: {
      [type]: { total, followed: total, successRate },
    },
  };
}

describe("getProgressionModifier", () => {
  it("returns 1.0 (no-op) when there is no data for the type", () => {
    const stats = makeStats("volume_adjustment", 10, 0.9); // different type
    expect(getProgressionModifier(stats, "load_progression")).toBe(1.0);
  });

  it("returns 1.0 (cold start) when total < 5", () => {
    const stats = makeStats("load_progression", 4, 0.2);
    expect(getProgressionModifier(stats, "load_progression")).toBe(1.0);
  });

  it("returns 0.8 (conservative) when successRate < 0.6", () => {
    const stats = makeStats("load_progression", 10, 0.5);
    expect(getProgressionModifier(stats, "load_progression")).toBe(0.8);
  });

  it("returns 1.1 (aggressive) when successRate > 0.85", () => {
    const stats = makeStats("load_progression", 10, 0.9);
    expect(getProgressionModifier(stats, "load_progression")).toBe(1.1);
  });

  it("returns 1.0 for a moderate successRate", () => {
    const stats = makeStats("load_progression", 10, 0.75);
    expect(getProgressionModifier(stats, "load_progression")).toBe(1.0);
  });

  it("treats the 0.6 / 0.85 boundaries as moderate (inclusive band)", () => {
    expect(getProgressionModifier(makeStats("load_progression", 10, 0.6), "load_progression")).toBe(1.0);
    expect(getProgressionModifier(makeStats("load_progression", 10, 0.85), "load_progression")).toBe(1.0);
  });
});

describe("applyProgressionModifier", () => {
  it("returns the config unchanged for modifier 1.0 (exact no-op)", () => {
    const result = applyProgressionModifier(1.0, DEFAULT_PROGRESSION_CONFIG);
    expect(result).toEqual(DEFAULT_PROGRESSION_CONFIG);
    // Same reference proves byte-for-byte no-op.
    expect(result).toBe(DEFAULT_PROGRESSION_CONFIG);
  });

  it("uses the module default config when none is passed (1.0)", () => {
    expect(applyProgressionModifier(1.0)).toEqual(DEFAULT_PROGRESSION_CONFIG);
  });

  it("shrinks increments and lowers the RPE threshold for 0.8 (conservative)", () => {
    const result = applyProgressionModifier(0.8, DEFAULT_PROGRESSION_CONFIG);
    expect(result.smallIncrement).toBeCloseTo(2.0); // 2.5 * 0.8
    expect(result.largeIncrement).toBeCloseTo(4.0); // 5 * 0.8
    expect(result.rpeThresholdForIncrease).toBe(7.5); // 8 - 0.5
    // Untouched fields.
    expect(result.rpeThresholdForDecrease).toBe(9);
    expect(result.weightThresholdForLargeIncrement).toBe(50);
  });

  it("grows increments and raises the RPE threshold for 1.1 (aggressive)", () => {
    const result = applyProgressionModifier(1.1, DEFAULT_PROGRESSION_CONFIG);
    expect(result.smallIncrement).toBeCloseTo(2.75); // 2.5 * 1.1
    expect(result.largeIncrement).toBeCloseTo(5.5); // 5 * 1.1
    expect(result.rpeThresholdForIncrease).toBe(8.5); // 8 + 0.5
  });

  it("does not mutate the input config", () => {
    const input = { ...DEFAULT_PROGRESSION_CONFIG };
    applyProgressionModifier(0.8, input);
    expect(input).toEqual(DEFAULT_PROGRESSION_CONFIG);
  });

  it("clamps increments to the lower floor at extreme conservative modifiers", () => {
    // A tiny modifier would push increments below 1.0 kg; the floor holds.
    const result = applyProgressionModifier(0.1, DEFAULT_PROGRESSION_CONFIG);
    expect(result.smallIncrement).toBe(1.0);
    expect(result.largeIncrement).toBe(1.0);
    // RPE threshold clamps to its floor of 7.
    expect(result.rpeThresholdForIncrease).toBe(7.5); // single -0.5 nudge, still > 7
  });

  it("clamps increments and RPE threshold at extreme aggressive modifiers", () => {
    const result = applyProgressionModifier(10, DEFAULT_PROGRESSION_CONFIG);
    // increments capped at 2x default.
    expect(result.smallIncrement).toBe(5.0); // 2 * 2.5
    expect(result.largeIncrement).toBe(10.0); // 2 * 5
    // RPE threshold capped at 9.
    expect(result.rpeThresholdForIncrease).toBe(8.5);
  });

  it("respects the RPE threshold floor when starting from a low config", () => {
    const lowConfig: ProgressionConfig = { ...DEFAULT_PROGRESSION_CONFIG, rpeThresholdForIncrease: 7 };
    const result = applyProgressionModifier(0.8, lowConfig);
    expect(result.rpeThresholdForIncrease).toBe(7); // 7 - 0.5 clamped up to 7
  });
});

describe("applyVolumeModifier", () => {
  it("returns the config unchanged for modifier 1.0 (exact no-op)", () => {
    const result = applyVolumeModifier(1.0, DEFAULT_VOLUME_CONFIG);
    expect(result).toEqual(DEFAULT_VOLUME_CONFIG);
    expect(result).toBe(DEFAULT_VOLUME_CONFIG);
  });

  it("uses the module default config when none is passed (1.0)", () => {
    expect(applyVolumeModifier(1.0)).toEqual(DEFAULT_VOLUME_CONFIG);
  });

  it("lowers rpeThresholdForAdd for 0.8 (adding a set is harder)", () => {
    const result = applyVolumeModifier(0.8, DEFAULT_VOLUME_CONFIG);
    expect(result.rpeThresholdForAdd).toBe(6.5); // 7 - 0.5
    // Set bounds untouched.
    expect(result.minSets).toBe(2);
    expect(result.maxSets).toBe(6);
    expect(result.rpeThresholdForReduce).toBe(9);
  });

  it("raises rpeThresholdForAdd for 1.1 (adding a set is easier)", () => {
    const result = applyVolumeModifier(1.1, DEFAULT_VOLUME_CONFIG);
    expect(result.rpeThresholdForAdd).toBe(7.5); // 7 + 0.5
  });

  it("clamps rpeThresholdForAdd to its bounds at extremes", () => {
    const lowConfig: VolumeConfig = { ...DEFAULT_VOLUME_CONFIG, rpeThresholdForAdd: 6 };
    expect(applyVolumeModifier(0.8, lowConfig).rpeThresholdForAdd).toBe(6); // 6 - 0.5 clamped to 6

    const highConfig: VolumeConfig = { ...DEFAULT_VOLUME_CONFIG, rpeThresholdForAdd: 9 };
    expect(applyVolumeModifier(1.1, highConfig).rpeThresholdForAdd).toBe(9); // 9 + 0.5 clamped to 9
  });

  it("does not mutate the input config", () => {
    const input = { ...DEFAULT_VOLUME_CONFIG };
    applyVolumeModifier(1.1, input);
    expect(input).toEqual(DEFAULT_VOLUME_CONFIG);
  });
});
