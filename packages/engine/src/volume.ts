import type { VolumeDecision } from "@gymapp/types";
import type { VolumeInput } from "./types";

/**
 * Configuration for volume adjustment decisions
 */
export interface VolumeConfig {
  minSets: number;
  maxSets: number;
  rpeThresholdForAdd: number;
  rpeThresholdForReduce: number;
  weeksBeforeAdjustment: number;
}

const defaultConfig: VolumeConfig = {
  minSets: 2,
  maxSets: 6,
  rpeThresholdForAdd: 7,
  rpeThresholdForReduce: 9,
  weeksBeforeAdjustment: 2,
};

/**
 * Self-tuning constants for {@link applyVolumeModifier}.
 *
 * Volume has no increment field (sets move ±1), so the lever is
 * `rpeThresholdForAdd`: lowering it makes "add a set" harder (conservative),
 * raising it makes it easier (aggressive). Isolated and named so the mapping
 * is reviewable/retunable. See `docs/plans/decision-self-tuning.md`.
 */

/**
 * RPE-threshold nudge applied to `rpeThresholdForAdd` when tuning.
 * Conservative modifiers subtract it; aggressive modifiers add it.
 */
const RPE_ADD_THRESHOLD_NUDGE = 0.5;

/**
 * Clamp bounds for `rpeThresholdForAdd` (defaults to 7). Working sets live in
 * the RPE 6-9 band, so tuning stays in-window.
 */
const MIN_RPE_THRESHOLD_FOR_ADD = 6;
const MAX_RPE_THRESHOLD_FOR_ADD = 9;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Translate a scalar progression modifier into a tuned {@link VolumeConfig}.
 *
 * Semantics (mirrors `applyProgressionModifier`):
 * - `modifier === 1.0` → returns the config unchanged (exact no-op).
 * - conservative (`< 1`) lowers `rpeThresholdForAdd` by
 *   `RPE_ADD_THRESHOLD_NUDGE` (adding a set requires more headroom);
 *   aggressive (`> 1`) raises it. Result is clamped to
 *   `[MIN_RPE_THRESHOLD_FOR_ADD, MAX_RPE_THRESHOLD_FOR_ADD]`.
 * - set bounds (`minSets`/`maxSets`) and `rpeThresholdForReduce`/
 *   `weeksBeforeAdjustment` are left untouched.
 *
 * Pure: depends only on its arguments.
 *
 * @param modifier - Scalar from `getProgressionModifier` (0.8 | 1.0 | 1.1)
 * @param config - Base config to tune (defaults to the module default)
 * @returns A tuned config (a new object; never mutates the input)
 */
export function applyVolumeModifier(
  modifier: number,
  config: VolumeConfig = defaultConfig
): VolumeConfig {
  // Exact no-op preserves cold-start behavior byte-for-byte.
  if (modifier === 1.0) {
    return config;
  }

  const rpeDelta = modifier < 1 ? -RPE_ADD_THRESHOLD_NUDGE : RPE_ADD_THRESHOLD_NUDGE;

  return {
    ...config,
    rpeThresholdForAdd: clamp(
      config.rpeThresholdForAdd + rpeDelta,
      MIN_RPE_THRESHOLD_FOR_ADD,
      MAX_RPE_THRESHOLD_FOR_ADD
    ),
  };
}

/**
 * Calculate whether to add, maintain, or reduce sets
 * based on recent performance trends
 */
export function calculateVolumeAdjustment(
  input: VolumeInput,
  config: VolumeConfig = defaultConfig
): VolumeDecision {
  const { currentSetCount, recentPerformance } = input;
  const maxSets = input.maxSetsPerExercise ?? config.maxSets;
  const minSets = input.minSetsPerExercise ?? config.minSets;

  if (recentPerformance.length < config.weeksBeforeAdjustment) {
    return {
      action: "maintain",
      newSetCount: currentSetCount,
      reason: `Need ${config.weeksBeforeAdjustment} weeks of data before adjusting volume`,
    };
  }

  // Calculate completion rate and average RPE
  const avgCompletion =
    recentPerformance.reduce((sum, p) => sum + p.completedSets / p.targetSets, 0) /
    recentPerformance.length;
  const avgRpe =
    recentPerformance.reduce((sum, p) => sum + p.avgRpe, 0) / recentPerformance.length;

  // If completing all sets with low RPE → add volume
  if (avgCompletion >= 1 && avgRpe < config.rpeThresholdForAdd && currentSetCount < maxSets) {
    return {
      action: "add_set",
      newSetCount: currentSetCount + 1,
      reason: `Completing all sets at RPE ${avgRpe.toFixed(1)} — adding volume`,
    };
  }

  // If struggling to complete sets or very high RPE → reduce
  if ((avgCompletion < 0.8 || avgRpe > config.rpeThresholdForReduce) && currentSetCount > minSets) {
    // Corrective-priority exercises hold their volume — these are rehab/
    // movement-quality work the athlete should not cut, even when fatigued.
    if (input.isCorrectivePriority) {
      return {
        action: "maintain",
        newSetCount: currentSetCount,
        reason: `Corrective-priority exercise — volume held at ${currentSetCount} sets`,
      };
    }

    return {
      action: "reduce_set",
      newSetCount: currentSetCount - 1,
      reason: `Completion rate ${(avgCompletion * 100).toFixed(0)}% at RPE ${avgRpe.toFixed(1)} — reducing volume`,
    };
  }

  return {
    action: "maintain",
    newSetCount: currentSetCount,
    reason: `Volume appropriate for current performance`,
  };
}
