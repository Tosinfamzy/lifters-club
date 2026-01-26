import type { RotationDecision } from "@gymapp/types";
import type { RotationInput } from "./types";

/**
 * Configuration for exercise rotation decisions
 */
export interface RotationConfig {
  minWeeksBeforeRotation: number;
  maxWeeksOnExercise: number;
}

const defaultConfig: RotationConfig = {
  minWeeksBeforeRotation: 4,
  maxWeeksOnExercise: 12,
};

/**
 * Calculate whether to keep or swap an exercise
 * based on time on exercise and performance trend
 */
export function calculateExerciseRotation(
  input: RotationInput,
  config: RotationConfig = defaultConfig
): RotationDecision {
  const { weeksOnExercise, performanceTrend, availableSubstitutes } = input;

  // Not enough time on exercise yet
  if (weeksOnExercise < config.minWeeksBeforeRotation) {
    return {
      action: "keep",
      reason: `Only ${weeksOnExercise} weeks on exercise — minimum ${config.minWeeksBeforeRotation} weeks before rotation`,
    };
  }

  // No substitutes available
  if (availableSubstitutes.length === 0) {
    return {
      action: "keep",
      reason: "No suitable substitutes available",
    };
  }

  // Forced rotation after max weeks
  if (weeksOnExercise >= config.maxWeeksOnExercise) {
    return {
      action: "swap",
      newExerciseId: availableSubstitutes[0],
      reason: `${weeksOnExercise} weeks on exercise — rotating for variety`,
    };
  }

  // Performance-based rotation
  if (performanceTrend === "declining" && weeksOnExercise >= config.minWeeksBeforeRotation) {
    return {
      action: "swap",
      newExerciseId: availableSubstitutes[0],
      reason: "Performance declining — trying a fresh stimulus",
    };
  }

  if (performanceTrend === "stagnant" && weeksOnExercise >= config.minWeeksBeforeRotation * 2) {
    return {
      action: "swap",
      newExerciseId: availableSubstitutes[0],
      reason: "Performance stagnant for extended period — rotating for new stimulus",
    };
  }

  return {
    action: "keep",
    reason: `Performance ${performanceTrend} — no rotation needed`,
  };
}
