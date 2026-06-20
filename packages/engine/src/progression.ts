import type { LoadDecision } from "@gymapp/types";
import type { ProgressionInput } from "./types";
import { calculateWorkingWeight, estimateOneRepMax } from "./estimation";

/**
 * Configuration for load progression decisions
 */
export interface ProgressionConfig {
  rpeThresholdForIncrease: number;
  rpeThresholdForDecrease: number;
  smallIncrement: number;
  largeIncrement: number;
  weightThresholdForLargeIncrement: number;
}

const defaultConfig: ProgressionConfig = {
  rpeThresholdForIncrease: 8,
  rpeThresholdForDecrease: 9,
  smallIncrement: 2.5,
  largeIncrement: 5,
  weightThresholdForLargeIncrement: 50,
};

/**
 * Self-tuning constants for {@link applyProgressionModifier}.
 *
 * These translate the scalar modifier from `getProgressionModifier`
 * (0.8 conservative / 1.0 no-op / 1.1 aggressive) into a tuned config.
 * They are isolated and named so the mapping is reviewable and retunable
 * without touching the translation logic. See
 * `docs/plans/decision-self-tuning.md` for the rationale.
 */

/**
 * RPE-threshold nudge applied to `rpeThresholdForIncrease` when tuning.
 * Conservative modifiers subtract it (progress sooner is harder),
 * aggressive modifiers add it. Kept small so tuning stays in-window.
 */
const RPE_THRESHOLD_NUDGE = 0.5;

/**
 * Clamp bounds for `rpeThresholdForIncrease`. The evidence-based working
 * range is RPE 7-9; RPE 6 is below the useful progression range, so the
 * floor is 7.
 */
const MIN_RPE_THRESHOLD_FOR_INCREASE = 7;
const MAX_RPE_THRESHOLD_FOR_INCREASE = 9;

/**
 * Lower clamp for tuned increments, in kg. Matches the smallest practical
 * real-world plate jump (microplates), so a conservative modifier never
 * produces a sub-practical increment.
 */
const MIN_INCREMENT = 1.0;

/**
 * Upper clamp multiplier for tuned increments, relative to each increment's
 * default. Bounds the worst case of an aggressive modifier to 2x default.
 */
const MAX_INCREMENT_MULTIPLE_OF_DEFAULT = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Translate a scalar progression modifier into a tuned {@link ProgressionConfig}.
 *
 * Semantics (see `docs/plans/decision-self-tuning.md` tuning table):
 * - `modifier === 1.0` → returns the config unchanged (exact no-op).
 * - increments are scaled by `modifier`, then clamped to
 *   `[MIN_INCREMENT, MAX_INCREMENT_MULTIPLE_OF_DEFAULT × default]`.
 * - `rpeThresholdForIncrease` is nudged ∓`RPE_THRESHOLD_NUDGE`
 *   (conservative lowers it, aggressive raises it), then clamped to
 *   `[MIN_RPE_THRESHOLD_FOR_INCREASE, MAX_RPE_THRESHOLD_FOR_INCREASE]`.
 * - `rpeThresholdForDecrease` and `weightThresholdForLargeIncrement` are
 *   left untouched.
 *
 * Pure: depends only on its arguments.
 *
 * @param modifier - Scalar from `getProgressionModifier` (0.8 | 1.0 | 1.1)
 * @param config - Base config to tune (defaults to the module default)
 * @returns A tuned config (a new object; never mutates the input)
 */
export function applyProgressionModifier(
  modifier: number,
  config: ProgressionConfig = defaultConfig
): ProgressionConfig {
  // Exact no-op preserves cold-start behavior byte-for-byte.
  if (modifier === 1.0) {
    return config;
  }

  const rpeDelta = modifier < 1 ? -RPE_THRESHOLD_NUDGE : RPE_THRESHOLD_NUDGE;

  return {
    ...config,
    smallIncrement: clamp(
      config.smallIncrement * modifier,
      MIN_INCREMENT,
      defaultConfig.smallIncrement * MAX_INCREMENT_MULTIPLE_OF_DEFAULT
    ),
    largeIncrement: clamp(
      config.largeIncrement * modifier,
      MIN_INCREMENT,
      defaultConfig.largeIncrement * MAX_INCREMENT_MULTIPLE_OF_DEFAULT
    ),
    rpeThresholdForIncrease: clamp(
      config.rpeThresholdForIncrease + rpeDelta,
      MIN_RPE_THRESHOLD_FOR_INCREASE,
      MAX_RPE_THRESHOLD_FOR_INCREASE
    ),
  };
}

/**
 * Calculate whether to increase, maintain, or decrease weight
 * based on recent set performance
 */
export function calculateLoadProgression(
  input: ProgressionInput,
  config: ProgressionConfig = defaultConfig
): LoadDecision {
  const { recentSets, currentWeight, targetRepRange, baselineWeight, baselineReps } = input;
  const [minReps, maxReps] = targetRepRange;

  // When no recent sets, use baseline if available
  if (recentSets.length === 0) {
    if (baselineWeight !== undefined && baselineReps !== undefined) {
      // Calculate working weight from baseline for target rep range
      const targetReps = Math.floor((minReps + maxReps) / 2);
      const e1rm = estimateOneRepMax(baselineWeight, baselineReps);
      const workingWeight = calculateWorkingWeight(e1rm, targetReps);

      return {
        action: "maintain",
        newWeight: workingWeight,
        reason: `Using baseline weight as starting point (${baselineWeight}×${baselineReps} → ${workingWeight}kg for ${targetReps} reps)`,
      };
    }

    return {
      action: "maintain",
      newWeight: currentWeight,
      reason: "No recent data to base decision on",
    };
  }

  // Calculate average reps and RPE from recent sets
  const avgReps = recentSets.reduce((sum, s) => sum + s.reps, 0) / recentSets.length;
  const setsWithRpe = recentSets.filter((s) => s.rpe !== undefined);
  const avgRpe =
    setsWithRpe.length > 0
      ? setsWithRpe.reduce((sum, s) => sum + s.rpe!, 0) / setsWithRpe.length
      : 7; // Default assumption

  const increment =
    currentWeight < config.weightThresholdForLargeIncrement
      ? config.smallIncrement
      : config.largeIncrement;

  // Decision logic
  if (avgReps >= maxReps && avgRpe < config.rpeThresholdForIncrease) {
    // Hitting top of rep range with room to spare → increase
    return {
      action: "increase",
      newWeight: currentWeight + increment,
      reason: `Averaging ${avgReps.toFixed(1)} reps at RPE ${avgRpe.toFixed(1)} — ready to progress`,
    };
  }

  if (avgReps < minReps || avgRpe > config.rpeThresholdForDecrease) {
    // Below rep range or grinding → decrease
    return {
      action: "decrease",
      newWeight: Math.max(0, currentWeight - increment),
      reason: `Averaging ${avgReps.toFixed(1)} reps at RPE ${avgRpe.toFixed(1)} — reduce load to maintain quality`,
    };
  }

  return {
    action: "maintain",
    newWeight: currentWeight,
    reason: `Averaging ${avgReps.toFixed(1)} reps at RPE ${avgRpe.toFixed(1)} — on track, maintain load`,
  };
}
