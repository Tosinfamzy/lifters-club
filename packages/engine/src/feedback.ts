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
 * Session-level facts the service gathers for non-exercise-scoped decisions.
 *
 * The engine stays pure: it never queries the DB or reads the clock. The
 * service computes these aggregates (session RPE, recent RPE window, the linked
 * readiness check) and passes them in. Existing exercise-scoped evaluators
 * ignore this context (additive "Option A" design — see the plan doc).
 */
export interface EvaluationContext {
  /** Number of sets completed in the evaluated session (all exercises). */
  completedSetCount: number;
  /** Overall RPE the user reported for this session, if any. */
  sessionOverallRpe?: number;
  /** Overall RPE of recent prior completed sessions — deload baseline. */
  recentOverallRpe?: number[];
  /** Readiness check linked to this session, if one was recorded. */
  readiness?: { score: number; recommendation: string };
}

/**
 * Thresholds for evaluating the non-load/volume decision types.
 *
 * Kept in one named-constant config (OCP): tweak the numbers without touching
 * the evaluator logic. RPE is the standard 1-10 scale.
 */
export interface FeedbackEvalConfig {
  /** Above this avg set RPE, training counts as "grinding" (rotation). */
  rotationGrindRpe: number;
  /** A session at/above this overall RPE is "maximal" / unsustainable. */
  maximalRpe: number;
  /** "light" session ceiling for set count (rest/light recovery recs). */
  lightSessionMaxSets: number;
  /** "light" session ceiling for overall RPE (rest/light recovery recs). */
  lightSessionMaxRpe: number;
}

const defaultFeedbackConfig: FeedbackEvalConfig = {
  rotationGrindRpe: 10,
  maximalRpe: 9,
  lightSessionMaxSets: 3,
  lightSessionMaxRpe: 6,
};

/**
 * Average RPE across sets that reported one. Returns undefined when no set
 * carried an RPE, so callers can distinguish "no signal" from "low effort".
 */
function averageRpe(sets: LoggedSet[]): number | undefined {
  const withRpe = sets.filter((s) => s.rpe !== undefined);
  if (withRpe.length === 0) return undefined;
  return withRpe.reduce((sum, s) => sum + (s.rpe ?? 0), 0) / withRpe.length;
}

/**
 * Mean of a numeric list, or undefined when empty (avoids divide-by-zero).
 */
function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
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
 * Evaluate if an exercise rotation decision was successful.
 *
 * Counterfactual caveat: this measures *adherence + a productive session*, not
 * whether the swap was the optimal choice (the path not taken is unobservable).
 *
 * Success criteria:
 * - swap: the user trained the recommended `newExerciseId` and did so without
 *   grinding (avg RPE below the grind threshold) — the swap was adopted.
 * - keep: the user kept training `input.exerciseId` without grinding.
 * Missing relevant sets → not successful (mirrors load/volume "no attempt").
 */
export function evaluateExerciseRotation(
  decision: Decision,
  subsequentSets: LoggedSet[],
  config: FeedbackEvalConfig = defaultFeedbackConfig
): EvaluationResult {
  const output = decision.output as {
    action?: "keep" | "swap";
    newExerciseId?: string;
  };
  const input = decision.input as { exerciseId?: string };

  const targetExerciseId =
    output.action === "swap" ? output.newExerciseId : input.exerciseId;

  if (!targetExerciseId) {
    return { success: false, reason: "Decision missing required data" };
  }

  const relevantSets = subsequentSets.filter(
    (s) => s.exerciseId === targetExerciseId
  );

  if (relevantSets.length === 0) {
    return output.action === "swap"
      ? {
          success: false,
          reason: "Recommended swap was not adopted — no sets for new exercise",
        }
      : {
          success: false,
          reason: "Kept exercise was not trained in this session",
        };
  }

  const avgRpe = averageRpe(relevantSets);
  if (avgRpe !== undefined && avgRpe >= config.rotationGrindRpe) {
    return {
      success: false,
      reason: `Trained ${relevantSets.length} sets but grinding at RPE ${avgRpe.toFixed(1)} (adherence only, not proof of optimal choice)`,
    };
  }

  const rpeText = avgRpe !== undefined ? ` at RPE ${avgRpe.toFixed(1)}` : "";
  return output.action === "swap"
    ? {
        success: true,
        reason: `Adopted swap — trained ${relevantSets.length} productive sets${rpeText} (adherence + outcome, not a counterfactual)`,
      }
    : {
        success: true,
        reason: `Kept exercise trained without grinding — ${relevantSets.length} sets${rpeText}`,
      };
}

/**
 * Evaluate if a deload recommendation was successful.
 *
 * Success criteria:
 * - recommended: the user actually backed off — this session's overall RPE
 *   dropped below the mean of recent prior sessions.
 * - not recommended: the user sustained training (overall RPE below maximal).
 * Empty `recentOverallRpe` is handled gracefully (no divide-by-zero).
 */
export function evaluateDeloadRecommendation(
  decision: Decision,
  context: EvaluationContext,
  config: FeedbackEvalConfig = defaultFeedbackConfig
): EvaluationResult {
  const output = decision.output as { recommended?: boolean };
  const sessionRpe = context.sessionOverallRpe;

  if (sessionRpe === undefined) {
    return {
      success: false,
      reason: "No session RPE recorded — cannot evaluate deload adherence",
    };
  }

  if (output.recommended) {
    const baseline = mean(context.recentOverallRpe ?? []);
    if (baseline === undefined) {
      return {
        success: false,
        reason: "No recent baseline to compare — cannot confirm the deload",
      };
    }
    if (sessionRpe < baseline) {
      return {
        success: true,
        reason: `Deload heeded — session RPE ${sessionRpe.toFixed(1)} dropped vs recent baseline ${baseline.toFixed(1)}`,
      };
    }
    return {
      success: false,
      reason: `Deload ignored — session RPE ${sessionRpe.toFixed(1)} did not drop vs baseline ${baseline.toFixed(1)}`,
    };
  }

  // Not recommended: success if the session was sustainable.
  if (sessionRpe < config.maximalRpe) {
    return {
      success: true,
      reason: `No deload needed and confirmed — session sustained at RPE ${sessionRpe.toFixed(1)}`,
    };
  }
  return {
    success: false,
    reason: `No deload recommended but session was maximal (RPE ${sessionRpe.toFixed(1)}) — recovery may have been needed`,
  };
}

/**
 * Evaluate if a session recovery recommendation was successful.
 *
 * Counterfactual caveat: we measure whether the user's realized session matched
 * the recommended modulation, not whether that modulation was ideal.
 *
 * Success criteria by recommendation:
 * - rest_day / light_session: the session was actually light (low set count
 *   and/or low overall RPE).
 * - full_session: completed at non-maximal RPE.
 * - reduced_volume / reduced_intensity: session aggregates sit at/below the
 *   recommended modulation (fewer sets and/or lower RPE than a full effort).
 */
export function evaluateSessionRecovery(
  decision: Decision,
  context: EvaluationContext,
  config: FeedbackEvalConfig = defaultFeedbackConfig
): EvaluationResult {
  const output = decision.output as {
    recommendation?: string;
    volumeModifier?: number;
    intensityModifier?: number;
  };

  const recommendation = output.recommendation;
  const { completedSetCount, sessionOverallRpe } = context;

  if (!recommendation) {
    return { success: false, reason: "Decision missing recovery recommendation" };
  }

  const isLight =
    completedSetCount <= config.lightSessionMaxSets ||
    (sessionOverallRpe !== undefined && sessionOverallRpe <= config.lightSessionMaxRpe);

  switch (recommendation) {
    case "rest_day":
    case "light_session":
      return isLight
        ? {
            success: true,
            reason: `Recovery heeded — light session (${completedSetCount} sets${sessionOverallRpe !== undefined ? `, RPE ${sessionOverallRpe.toFixed(1)}` : ""})`,
          }
        : {
            success: false,
            reason: `Recovery ignored — ${completedSetCount} sets${sessionOverallRpe !== undefined ? ` at RPE ${sessionOverallRpe.toFixed(1)}` : ""}, not the recommended light session`,
          };

    case "full_session":
      if (sessionOverallRpe === undefined) {
        return completedSetCount > 0
          ? { success: true, reason: `Completed full session — ${completedSetCount} sets logged` }
          : { success: false, reason: "Full session recommended but nothing was logged" };
      }
      return sessionOverallRpe < config.maximalRpe
        ? {
            success: true,
            reason: `Completed full session at non-maximal RPE ${sessionOverallRpe.toFixed(1)}`,
          }
        : {
            success: false,
            reason: `Full session completed but at maximal RPE ${sessionOverallRpe.toFixed(1)} — recovery may have been insufficient`,
          };

    case "reduced_volume":
    case "reduced_intensity":
    default: {
      // Backed-off session: at/below maximal effort counts as following the
      // recommended modulation (adherence, not proof of optimal dosing).
      if (sessionOverallRpe !== undefined && sessionOverallRpe >= config.maximalRpe) {
        return {
          success: false,
          reason: `Reduction recommended but session hit RPE ${sessionOverallRpe.toFixed(1)} — modulation not applied`,
        };
      }
      return {
        success: true,
        reason: `Session modulated per recommendation — ${completedSetCount} sets${sessionOverallRpe !== undefined ? ` at RPE ${sessionOverallRpe.toFixed(1)}` : ""} (adherence, not a counterfactual)`,
      };
    }
  }
}

/**
 * Generic decision evaluation dispatcher.
 *
 * Exercise-scoped types (load/volume/rotation) read from `subsequentSets`.
 * Non-exercise types (deload/recovery) read session aggregates from `context`,
 * which the service supplies. `missed_session` and `weekly_plan_update` remain
 * manual-only for now and fall through to `null`.
 */
export function evaluateDecision(
  decision: Decision,
  subsequentSets: LoggedSet[],
  context?: EvaluationContext
): EvaluationResult | null {
  switch (decision.type) {
    case "load_progression":
      return evaluateLoadProgression(decision, subsequentSets);
    case "volume_adjustment":
      return evaluateVolumeAdjustment(decision, subsequentSets);
    case "exercise_rotation":
      return evaluateExerciseRotation(decision, subsequentSets);
    case "deload_recommendation":
      if (!context) return null;
      return evaluateDeloadRecommendation(decision, context);
    case "session_recovery":
      if (!context) return null;
      return evaluateSessionRecovery(decision, context);
    default:
      // missed_session and weekly_plan_update stay manual-only for now.
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
