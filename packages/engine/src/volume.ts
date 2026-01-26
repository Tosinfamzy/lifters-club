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
