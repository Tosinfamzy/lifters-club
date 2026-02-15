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
