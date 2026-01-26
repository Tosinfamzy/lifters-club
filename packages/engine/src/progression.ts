import type { LoadDecision } from "@gymapp/types";
import type { ProgressionInput } from "./types";

/**
 * Configuration for load progression decisions
 */
export interface ProgressionConfig {
  rpeThresholdForIncrease: number;
  rpeThresholdForDecrease: number;
  smallIncrementKg: number;
  largeIncrementKg: number;
  weightThresholdForLargeIncrement: number;
}

const defaultConfig: ProgressionConfig = {
  rpeThresholdForIncrease: 8,
  rpeThresholdForDecrease: 9,
  smallIncrementKg: 2.5,
  largeIncrementKg: 5,
  weightThresholdForLargeIncrement: 50,
};

/**
 * Calculate whether to increase, maintain, or decrease weight
 * based on recent set performance
 */
export function calculateLoadProgression(
  input: ProgressionInput,
  config: ProgressionConfig = defaultConfig
): LoadDecision {
  const { recentSets, currentWeight, targetRepRange } = input;
  const [minReps, maxReps] = targetRepRange;

  if (recentSets.length === 0) {
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
      ? config.smallIncrementKg
      : config.largeIncrementKg;

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
