/**
 * Weekly Plan Update
 *
 * Aggregates all decision types to generate the next week's training plan
 * with appropriate adjustments based on performance and recovery.
 */

import type { LoadDecision, VolumeDecision, DeloadDecision, RotationDecision } from "@gymapp/types";

export interface ExercisePerformance {
  exerciseId: string;
  currentWeight: number;
  currentSets: number;
  targetRepRange: [number, number];
  weeksOnExercise: number;
  recentSets: { reps: number; rpe?: number; weight: number }[];
  recentPerformance: { completedSets: number; targetSets: number; avgRpe: number }[];
  performanceTrend: "improving" | "stagnant" | "declining";
  availableSubstitutes: string[];
}

export interface WeeklyPlanInput {
  userId: string;
  weekNumber: number;
  totalWeeks: number;
  /** Performance data for each exercise */
  exercises: ExercisePerformance[];
  /** Weekly RPE averages for recent weeks */
  recentWeeklyRpe: number[];
  /** Number of missed sessions recently */
  missedSessions: number;
  /** Consecutive hard weeks count */
  consecutiveHardWeeks: number;
  /** Whether user requested a deload */
  userRequestedDeload?: boolean;
}

export interface PlannedExerciseUpdate {
  exerciseId: string;
  /** New exercise ID if swapped */
  newExerciseId?: string;
  /** Updated weight */
  weight: number;
  /** Updated set count */
  sets: number;
  /** Target rep range (unchanged or adjusted for deload) */
  repRange: [number, number];
  /** All decisions that affected this exercise */
  decisions: {
    load?: LoadDecision;
    volume?: VolumeDecision;
    rotation?: RotationDecision;
  };
}

export interface WeeklyPlanDecision {
  weekNumber: number;
  isDeloadWeek: boolean;
  deloadDecision: DeloadDecision;
  exerciseUpdates: PlannedExerciseUpdate[];
  /** Summary of all changes */
  summary: string;
  /** Individual change descriptions */
  changes: string[];
}

export interface PlanningConfig {
  /** Deload volume reduction (e.g., 0.6 = 60% of normal) */
  deloadVolumeMultiplier: number;
  /** Deload intensity reduction */
  deloadIntensityMultiplier: number;
}

const defaultConfig: PlanningConfig = {
  deloadVolumeMultiplier: 0.6,
  deloadIntensityMultiplier: 0.85,
};

// Import the individual decision functions
import { calculateLoadProgression } from "./progression";
import { calculateVolumeAdjustment } from "./volume";
import { calculateDeloadNeed } from "./deload";
import { calculateExerciseRotation } from "./rotation";

/**
 * Generate next week's training plan with all adjustments
 */
export function generateWeeklyPlan(
  input: WeeklyPlanInput,
  config: PlanningConfig = defaultConfig
): WeeklyPlanDecision {
  const {
    weekNumber,
    exercises,
    recentWeeklyRpe,
    missedSessions,
    consecutiveHardWeeks,
    userRequestedDeload,
  } = input;

  const changes: string[] = [];
  const exerciseUpdates: PlannedExerciseUpdate[] = [];

  // First, check if deload is needed
  const deloadDecision = userRequestedDeload
    ? { recommended: true, reason: "User requested deload week" }
    : calculateDeloadNeed({
        weekNumber,
        recentWeeklyRpe,
        missedSessions,
        consecutiveHardWeeks,
      });

  const isDeloadWeek = deloadDecision.recommended;

  if (isDeloadWeek) {
    changes.push(`DELOAD WEEK: ${deloadDecision.reason}`);
  }

  // Process each exercise
  for (const exercise of exercises) {
    const decisions: PlannedExerciseUpdate["decisions"] = {};

    // Calculate load progression
    const loadDecision = calculateLoadProgression({
      exerciseId: exercise.exerciseId,
      recentSets: exercise.recentSets,
      currentWeight: exercise.currentWeight,
      targetRepRange: exercise.targetRepRange,
    });
    decisions.load = loadDecision;

    // Calculate volume adjustment
    const volumeDecision = calculateVolumeAdjustment({
      exerciseId: exercise.exerciseId,
      currentSetCount: exercise.currentSets,
      recentPerformance: exercise.recentPerformance,
    });
    decisions.volume = volumeDecision;

    // Calculate exercise rotation
    const rotationDecision = calculateExerciseRotation({
      exerciseId: exercise.exerciseId,
      weeksOnExercise: exercise.weeksOnExercise,
      performanceTrend: exercise.performanceTrend,
      availableSubstitutes: exercise.availableSubstitutes,
    });
    decisions.rotation = rotationDecision;

    // Apply decisions
    let finalWeight = loadDecision.newWeight;
    let finalSets = volumeDecision.newSetCount;
    let finalRepRange = exercise.targetRepRange;
    let finalExerciseId = exercise.exerciseId;
    let newExerciseId: string | undefined;

    // Apply deload modifications
    if (isDeloadWeek) {
      finalWeight = Math.round(finalWeight * config.deloadIntensityMultiplier * 2) / 2; // Round to nearest 0.5
      finalSets = Math.max(2, Math.ceil(finalSets * config.deloadVolumeMultiplier));
      // Increase rep range slightly for deload
      finalRepRange = [
        exercise.targetRepRange[0],
        exercise.targetRepRange[1] + 2,
      ];
    }

    // Apply rotation (only if not deload week - keep exercises stable during deload)
    if (!isDeloadWeek && rotationDecision.action === "swap" && rotationDecision.newExerciseId) {
      newExerciseId = rotationDecision.newExerciseId;
      finalExerciseId = rotationDecision.newExerciseId;
      changes.push(`${exercise.exerciseId} → ${newExerciseId}: ${rotationDecision.reason}`);
    }

    // Track load changes
    if (loadDecision.action !== "maintain") {
      changes.push(
        `${finalExerciseId}: ${loadDecision.action} weight to ${finalWeight}kg — ${loadDecision.reason}`
      );
    }

    // Track volume changes
    if (volumeDecision.action !== "maintain") {
      changes.push(
        `${finalExerciseId}: ${volumeDecision.action === "add_set" ? "add" : "remove"} set (now ${finalSets}) — ${volumeDecision.reason}`
      );
    }

    exerciseUpdates.push({
      exerciseId: exercise.exerciseId,
      newExerciseId,
      weight: finalWeight,
      sets: finalSets,
      repRange: finalRepRange,
      decisions,
    });
  }

  // Generate summary
  const loadChanges = exerciseUpdates.filter((e) => e.decisions.load?.action !== "maintain").length;
  const volumeChanges = exerciseUpdates.filter((e) => e.decisions.volume?.action !== "maintain").length;
  const rotationChanges = exerciseUpdates.filter((e) => e.newExerciseId).length;

  let summary = `Week ${weekNumber + 1}`;
  if (isDeloadWeek) {
    summary += " (DELOAD)";
  }
  summary += `: ${loadChanges} load, ${volumeChanges} volume, ${rotationChanges} rotation changes`;

  return {
    weekNumber: weekNumber + 1,
    isDeloadWeek,
    deloadDecision,
    exerciseUpdates,
    summary,
    changes,
  };
}

/**
 * Calculate performance trend from recent data
 */
export function calculatePerformanceTrend(
  recentWeights: number[],
  recentReps: number[]
): "improving" | "stagnant" | "declining" {
  if (recentWeights.length < 3 || recentReps.length < 3) {
    return "stagnant"; // Not enough data
  }

  // Calculate estimated 1RM trend using Epley formula: weight * (1 + reps/30)
  const estimatedMaxes = recentWeights.map((w, i) => {
    const reps = recentReps[i] ?? 0;
    return w * (1 + reps / 30);
  });

  // Compare recent average to older average
  const first = estimatedMaxes[0] ?? 0;
  const second = estimatedMaxes[1] ?? 0;
  const recentAvg = (first + second) / 2;
  const olderAvg =
    estimatedMaxes.slice(2).reduce((sum, v) => sum + v, 0) / (estimatedMaxes.length - 2);

  const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

  if (changePercent > 2) return "improving";
  if (changePercent < -2) return "declining";
  return "stagnant";
}
