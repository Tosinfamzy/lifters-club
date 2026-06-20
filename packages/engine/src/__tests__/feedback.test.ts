import { describe, it, expect } from "vitest";
import {
  getProgressionModifier,
  evaluateDecision,
  evaluateExerciseRotation,
  evaluateDeloadRecommendation,
  evaluateSessionRecovery,
} from "../feedback";
import type { EvaluationContext } from "../feedback";
import { applyProgressionModifier } from "../progression";
import { applyVolumeModifier } from "../volume";
import type { ProgressionConfig } from "../progression";
import type { VolumeConfig } from "../volume";
import type {
  DecisionAccuracyStats,
  DecisionType,
  Decision,
  LoggedSet,
} from "@gymapp/types";

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

// ---------------------------------------------------------------------------
// Auto-evaluation for rotation / deload / recovery (and dispatcher behavior)
// ---------------------------------------------------------------------------

function makeDecision(
  type: DecisionType,
  input: Record<string, unknown>,
  output: Record<string, unknown>
): Decision {
  return {
    id: "decision-1",
    userId: "user-1",
    type,
    input,
    output,
    reasoning: "test",
    algorithmVersion: "1.1.0",
    createdAt: new Date(),
  };
}

function makeSet(
  exerciseId: string,
  rpe: number | undefined,
  overrides: Partial<LoggedSet> = {}
): LoggedSet {
  return {
    id: `set-${Math.random()}`,
    workoutLogId: "log-1",
    exerciseId,
    setNumber: 1,
    weight: 100,
    reps: 8,
    rpe,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("evaluateExerciseRotation", () => {
  it("succeeds when a swap is adopted and trained productively", () => {
    const decision = makeDecision(
      "exercise_rotation",
      { exerciseId: "barbell-back-squat" },
      { action: "swap", newExerciseId: "front-squat" }
    );
    const sets = [makeSet("front-squat", 7), makeSet("front-squat", 8)];

    const result = evaluateExerciseRotation(decision, sets);
    expect(result.success).toBe(true);
    expect(result.reason).toMatch(/Adopted swap/);
  });

  it("fails when a swap is not adopted (no sets for the new exercise)", () => {
    const decision = makeDecision(
      "exercise_rotation",
      { exerciseId: "barbell-back-squat" },
      { action: "swap", newExerciseId: "front-squat" }
    );
    // User trained the OLD exercise, not the recommended new one.
    const sets = [makeSet("barbell-back-squat", 7)];

    const result = evaluateExerciseRotation(decision, sets);
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/not adopted/);
  });

  it("succeeds when a keep was trained without grinding", () => {
    const decision = makeDecision(
      "exercise_rotation",
      { exerciseId: "barbell-back-squat" },
      { action: "keep" }
    );
    const sets = [makeSet("barbell-back-squat", 7), makeSet("barbell-back-squat", 8)];

    const result = evaluateExerciseRotation(decision, sets);
    expect(result.success).toBe(true);
    expect(result.reason).toMatch(/Kept exercise/);
  });

  it("fails when a kept exercise was grinding at maximal RPE", () => {
    const decision = makeDecision(
      "exercise_rotation",
      { exerciseId: "barbell-back-squat" },
      { action: "keep" }
    );
    const sets = [makeSet("barbell-back-squat", 10), makeSet("barbell-back-squat", 10)];

    const result = evaluateExerciseRotation(decision, sets);
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/grinding/);
  });

  it("fails a keep that was not trained in the session", () => {
    const decision = makeDecision(
      "exercise_rotation",
      { exerciseId: "barbell-back-squat" },
      { action: "keep" }
    );
    const result = evaluateExerciseRotation(decision, [makeSet("bench-press", 7)]);
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/not trained/);
  });
});

describe("evaluateDeloadRecommendation", () => {
  it("succeeds when a deload was recommended and session RPE dropped vs baseline", () => {
    const decision = makeDecision("deload_recommendation", {}, { recommended: true });
    const context: EvaluationContext = {
      completedSetCount: 6,
      sessionOverallRpe: 6,
      recentOverallRpe: [9, 9, 8.5],
    };

    const result = evaluateDeloadRecommendation(decision, context);
    expect(result.success).toBe(true);
    expect(result.reason).toMatch(/heeded/);
  });

  it("fails when a deload was recommended but RPE stayed high", () => {
    const decision = makeDecision("deload_recommendation", {}, { recommended: true });
    const context: EvaluationContext = {
      completedSetCount: 6,
      sessionOverallRpe: 9.5,
      recentOverallRpe: [9, 9, 8.5],
    };

    const result = evaluateDeloadRecommendation(decision, context);
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/ignored/);
  });

  it("succeeds when no deload was recommended and the session was sustainable", () => {
    const decision = makeDecision("deload_recommendation", {}, { recommended: false });
    const context: EvaluationContext = {
      completedSetCount: 6,
      sessionOverallRpe: 7.5,
      recentOverallRpe: [7, 8],
    };

    const result = evaluateDeloadRecommendation(decision, context);
    expect(result.success).toBe(true);
  });

  it("handles an empty recent-RPE baseline without dividing by zero", () => {
    const decision = makeDecision("deload_recommendation", {}, { recommended: true });
    const context: EvaluationContext = {
      completedSetCount: 6,
      sessionOverallRpe: 6,
      recentOverallRpe: [],
    };

    const result = evaluateDeloadRecommendation(decision, context);
    // No baseline → cannot confirm; gracefully not-successful, no NaN/crash.
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/baseline/);
  });
});

describe("evaluateSessionRecovery", () => {
  it("succeeds when a rest recommendation was heeded with a light session", () => {
    const decision = makeDecision(
      "session_recovery",
      {},
      { recommendation: "rest_day", volumeModifier: 0, intensityModifier: 0 }
    );
    const context: EvaluationContext = {
      completedSetCount: 2,
      sessionOverallRpe: 4,
      readiness: { score: 2, recommendation: "rest" },
    };

    const result = evaluateSessionRecovery(decision, context);
    expect(result.success).toBe(true);
    expect(result.reason).toMatch(/heeded/);
  });

  it("fails when a rest recommendation was ignored with a heavy session", () => {
    const decision = makeDecision(
      "session_recovery",
      {},
      { recommendation: "rest_day", volumeModifier: 0, intensityModifier: 0 }
    );
    const context: EvaluationContext = {
      completedSetCount: 12,
      sessionOverallRpe: 9.5,
    };

    const result = evaluateSessionRecovery(decision, context);
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/ignored/);
  });

  it("succeeds when a full session was completed at non-maximal RPE", () => {
    const decision = makeDecision(
      "session_recovery",
      {},
      { recommendation: "full_session", volumeModifier: 1, intensityModifier: 1 }
    );
    const context: EvaluationContext = {
      completedSetCount: 10,
      sessionOverallRpe: 7.5,
    };

    const result = evaluateSessionRecovery(decision, context);
    expect(result.success).toBe(true);
    expect(result.reason).toMatch(/full session/i);
  });

  it("succeeds when a reduced-volume session was modulated below maximal", () => {
    const decision = makeDecision(
      "session_recovery",
      {},
      { recommendation: "reduced_volume", volumeModifier: 0.7, intensityModifier: 1 }
    );
    const context: EvaluationContext = {
      completedSetCount: 6,
      sessionOverallRpe: 7,
    };

    const result = evaluateSessionRecovery(decision, context);
    expect(result.success).toBe(true);
  });
});

describe("evaluateDecision dispatcher", () => {
  it("returns null for missed_session (manual-only)", () => {
    const decision = makeDecision("missed_session", {}, { action: "resume" });
    expect(evaluateDecision(decision, [])).toBeNull();
  });

  it("returns null for weekly_plan_update (not completion-evaluable)", () => {
    const decision = makeDecision("weekly_plan_update", {}, {});
    expect(evaluateDecision(decision, [])).toBeNull();
  });

  it("returns null for deload/recovery when no context is provided", () => {
    const deload = makeDecision("deload_recommendation", {}, { recommended: true });
    const recovery = makeDecision("session_recovery", {}, { recommendation: "rest_day" });
    expect(evaluateDecision(deload, [])).toBeNull();
    expect(evaluateDecision(recovery, [])).toBeNull();
  });

  it("dispatches deload/recovery when context is provided", () => {
    const context: EvaluationContext = {
      completedSetCount: 2,
      sessionOverallRpe: 4,
      recentOverallRpe: [9],
    };
    const deload = makeDecision("deload_recommendation", {}, { recommended: true });
    const recovery = makeDecision("session_recovery", {}, { recommendation: "rest_day" });
    expect(evaluateDecision(deload, [], context)).not.toBeNull();
    expect(evaluateDecision(recovery, [], context)).not.toBeNull();
  });

  it("evaluates load_progression unchanged when context is omitted", () => {
    const decision = makeDecision(
      "load_progression",
      { exerciseId: "bench-press", targetRepRange: [8, 10] },
      { action: "increase", newWeight: 100 }
    );
    const sets = [makeSet("bench-press", 7, { weight: 100, reps: 9 })];
    const result = evaluateDecision(decision, sets);
    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
  });

  it("evaluates volume_adjustment unchanged when context is omitted", () => {
    const decision = makeDecision(
      "volume_adjustment",
      { exerciseId: "bench-press" },
      { action: "add_set", newSetCount: 2 }
    );
    const sets = [makeSet("bench-press", 7), makeSet("bench-press", 7)];
    const result = evaluateDecision(decision, sets);
    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
  });
});
