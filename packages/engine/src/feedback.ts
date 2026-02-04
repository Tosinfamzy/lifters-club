/**
 * Decision feedback and evaluation functions
 *
 * These functions evaluate whether decisions were successful
 * and adjust algorithm aggressiveness based on historical accuracy.
 */

import type { DecisionType, LoggedSet, Decision, DecisionAccuracyStats } from "@gymapp/types";

export interface EvaluationResult {
  success: boolean;
  reason: string;
}

/**
 * Evaluate if a load progression decision was successful
 *
 * Success criteria:
 * - User completed target reps at recommended weight
 * - RPE was not maximal (not 10)
 * - Reps didn't drop significantly below target
 *
 * @param decision - The original decision that was made
 * @param subsequentSets - Sets logged after the decision was implemented
 */
export function evaluateLoadProgression(
  decision: Decision,
  subsequentSets: LoggedSet[]
): EvaluationResult {
  const output = decision.output as {
    newWeight?: number;
    action?: string;
  };
  const input = decision.input as {
    exerciseId?: string;
    targetRepRange?: [number, number];
  };

  const recommendedWeight = output.newWeight;
  const exerciseId = input.exerciseId;
  const targetRepRange = input.targetRepRange;

  if (!recommendedWeight || !exerciseId) {
    return { success: false, reason: "Decision missing required data" };
  }

  // Filter sets for the specific exercise at or near recommended weight
  const relevantSets = subsequentSets.filter(
    (s) =>
      s.exerciseId === exerciseId &&
      Math.abs(s.weight - recommendedWeight) <= 5 // Within 5 units of recommended
  );

  if (relevantSets.length === 0) {
    return { success: false, reason: "User did not attempt recommended weight" };
  }

  // Calculate average reps and RPE
  const avgReps =
    relevantSets.reduce((sum, s) => sum + s.reps, 0) / relevantSets.length;
  const setsWithRpe = relevantSets.filter((s) => s.rpe !== undefined);
  const avgRpe =
    setsWithRpe.length > 0
      ? setsWithRpe.reduce((sum, s) => sum + (s.rpe || 8), 0) / setsWithRpe.length
      : 8;

  // Get target min reps
  const targetMinReps = targetRepRange ? targetRepRange[0] : 6;

  // Failure conditions
  if (avgReps < targetMinReps - 2) {
    return {
      success: false,
      reason: `Reps dropped significantly below target (${avgReps.toFixed(1)} vs ${targetMinReps} min)`,
    };
  }

  if (avgRpe >= 10) {
    return {
      success: false,
      reason: "Sets were maximal effort (RPE 10) - progression too aggressive",
    };
  }

  // Success
  return {
    success: true,
    reason: `User completed ${avgReps.toFixed(1)} reps at RPE ${avgRpe.toFixed(1)}`,
  };
}

/**
 * Evaluate if a volume adjustment decision was successful
 */
export function evaluateVolumeAdjustment(
  decision: Decision,
  subsequentSets: LoggedSet[]
): EvaluationResult {
  const output = decision.output as {
    newSetCount?: number;
    action?: string;
  };
  const input = decision.input as {
    exerciseId?: string;
  };

  const targetSets = output.newSetCount;
  const exerciseId = input.exerciseId;

  if (!targetSets || !exerciseId) {
    return { success: false, reason: "Decision missing required data" };
  }

  // Count sets for the exercise
  const completedSets = subsequentSets.filter(
    (s) => s.exerciseId === exerciseId
  ).length;

  // Success if user completed at least the target sets
  if (completedSets >= targetSets) {
    return {
      success: true,
      reason: `User completed ${completedSets} sets (target: ${targetSets})`,
    };
  }

  return {
    success: false,
    reason: `User completed only ${completedSets} sets (target: ${targetSets})`,
  };
}

/**
 * Generic decision evaluation dispatcher
 */
export function evaluateDecision(
  decision: Decision,
  subsequentSets: LoggedSet[]
): EvaluationResult | null {
  switch (decision.type) {
    case "load_progression":
      return evaluateLoadProgression(decision, subsequentSets);
    case "volume_adjustment":
      return evaluateVolumeAdjustment(decision, subsequentSets);
    default:
      // Other decision types don't have automatic evaluation yet
      return null;
  }
}

/**
 * Calculate progression modifier based on historical accuracy
 *
 * This adjusts how aggressive the algorithm is based on how well
 * its previous recommendations worked for this user.
 *
 * @param accuracyStats - User's decision accuracy statistics
 * @param decisionType - The type of decision being made
 * @returns Modifier to apply to progression (0.8 = more conservative, 1.1 = more aggressive)
 */
export function getProgressionModifier(
  accuracyStats: DecisionAccuracyStats,
  decisionType: DecisionType
): number {
  const typeStats = accuracyStats.byType[decisionType];

  // Need at least 5 decisions to have meaningful data
  if (!typeStats || typeStats.total < 5) {
    return 1.0; // Default - no modification
  }

  // If success rate is low, be more conservative
  if (typeStats.successRate < 0.6) {
    return 0.8; // Reduce progression aggressiveness by 20%
  }

  // If success rate is high, can be slightly more aggressive
  if (typeStats.successRate > 0.85) {
    return 1.1; // Increase progression aggressiveness by 10%
  }

  // Moderate success rate - use default
  return 1.0;
}

/**
 * Get confidence level for a decision based on data quality
 */
export function getDecisionConfidence(
  recentDataPoints: number,
  accuracyStats?: DecisionAccuracyStats,
  decisionType?: DecisionType
): "low" | "medium" | "high" {
  // Low confidence if very little data
  if (recentDataPoints < 3) {
    return "low";
  }

  // Check historical accuracy if available
  if (accuracyStats && decisionType) {
    const typeStats = accuracyStats.byType[decisionType];
    if (typeStats && typeStats.total >= 10) {
      if (typeStats.successRate >= 0.8) {
        return "high";
      }
      if (typeStats.successRate < 0.6) {
        return "low";
      }
    }
  }

  // Medium confidence for moderate data
  if (recentDataPoints >= 6) {
    return "high";
  }

  return "medium";
}
