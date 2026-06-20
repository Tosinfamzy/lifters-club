/**
 * Weekly Plan Update
 *
 * Aggregates all decision types to generate the next week's training plan
 * with appropriate adjustments based on performance and recovery.
 */

import type {
  LoadDecision,
  VolumeDecision,
  DeloadDecision,
  RotationDecision,
  MuscleGroup,
  PlannedExercise,
  EquipmentType,
  MovementPattern,
} from "@gymapp/types";

/**
 * Pre-resolved constraint outcome for a planned exercise.
 *
 * The pure engine never fetches the library or evaluates constraints itself
 * (DIP — it depends on data passed in). The service resolves each exercise
 * against the athlete's profile and hands the engine this decision to apply.
 */
export interface ConstraintDecision {
  /** What the engine should do with this exercise. */
  action: "allow" | "substitute" | "omit";
  /** Substitute target id — required when `action === "substitute"`. */
  substituteExerciseId?: string;
  /** True when the substitute comes from the athlete's persisted swaps. */
  isPermanent?: boolean;
  /** Human-readable explanation for the substitution/omission. */
  reason?: string;
}

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
  /** Equipment used by this exercise (carried for audit/context). */
  equipment?: EquipmentType[];
  /** Movement patterns for this exercise (carried for audit/context). */
  movementPatterns?: MovementPattern[];
  /**
   * Pre-resolved constraint outcome. Absent or `action: "allow"` → unchanged
   * behavior. The service populates this; the engine only applies it.
   */
  constraintDecision?: ConstraintDecision;
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
  /** New exercise ID if swapped (by rotation OR constraint substitution) */
  newExerciseId?: string;
  /** Updated weight */
  weight: number;
  /** Updated set count */
  sets: number;
  /** Target rep range (unchanged or adjusted for deload) */
  repRange: [number, number];
  /** True when a constraint forced this exercise out of the plan entirely. */
  omitted?: boolean;
  /** Why the exercise was omitted (present only when `omitted`). */
  omissionReason?: string;
  /** What drove the swap when `newExerciseId` is set. */
  substitutionSource?: "rotation" | "constraint";
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

    // Constraint enforcement runs first and is unconditional (safety beats
    // progression — applies even on deload weeks). Precedence:
    // omit > constraint-substitute > rotation-swap.
    const constraintDecision = exercise.constraintDecision;

    // Omit: the athlete can't safely perform this and no candidate fit.
    // Drop it from the plan with no progression changes.
    if (constraintDecision?.action === "omit") {
      const reason = constraintDecision.reason ?? "Constraint omission";
      changes.push(`OMITTED ${exercise.exerciseId}: ${reason}`);
      exerciseUpdates.push({
        exerciseId: exercise.exerciseId,
        weight: exercise.currentWeight,
        sets: exercise.currentSets,
        repRange: exercise.targetRepRange,
        omitted: true,
        omissionReason: reason,
        decisions,
      });
      continue;
    }

    // Constraint substitution: swap to the resolved safe exercise. Load/volume/
    // deload still apply below (to the substitute), but the rotation swap is
    // suppressed so the constraint choice wins.
    const constraintSubstituteId =
      constraintDecision?.action === "substitute"
        ? constraintDecision.substituteExerciseId
        : undefined;

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
    let substitutionSource: PlannedExerciseUpdate["substitutionSource"];

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

    if (constraintSubstituteId) {
      // Constraint substitution wins over rotation. The swap is unconditional
      // (safety applies even on deload weeks).
      newExerciseId = constraintSubstituteId;
      finalExerciseId = constraintSubstituteId;
      substitutionSource = "constraint";
      const reason = constraintDecision?.reason ?? "Constraint substitution";
      changes.push(`${exercise.exerciseId} → ${newExerciseId}: ${reason}`);
    } else if (
      // Apply rotation (only if not deload week - keep exercises stable during
      // deload, and only when a constraint substitution didn't already fire)
      !isDeloadWeek &&
      rotationDecision.action === "swap" &&
      rotationDecision.newExerciseId
    ) {
      newExerciseId = rotationDecision.newExerciseId;
      finalExerciseId = rotationDecision.newExerciseId;
      substitutionSource = "rotation";
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
      substitutionSource,
      decisions,
    });
  }

  // Generate summary. Omitted exercises have no decisions, so they're naturally
  // excluded from the load/volume/rotation tallies.
  const loadChanges = exerciseUpdates.filter((e) => e.decisions.load?.action !== "maintain" && !e.omitted).length;
  const volumeChanges = exerciseUpdates.filter((e) => e.decisions.volume?.action !== "maintain" && !e.omitted).length;
  const rotationChanges = exerciseUpdates.filter((e) => e.newExerciseId).length;
  const omittedChanges = exerciseUpdates.filter((e) => e.omitted).length;

  let summary = `Week ${weekNumber + 1}`;
  if (isDeloadWeek) {
    summary += " (DELOAD)";
  }
  summary += `: ${loadChanges} load, ${volumeChanges} volume, ${rotationChanges} rotation changes`;
  if (omittedChanges > 0) {
    summary += `, ${omittedChanges} omitted`;
  }

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

// ============ Quick Workout Generation ============

/**
 * Available exercise with metadata for selection
 */
export interface AvailableExercise {
  exerciseId: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: EquipmentType[];
  isCompound: boolean;
  /** Most recent performance data if user has history */
  lastPerformance?: {
    weight: number;
    reps: number;
    rpe?: number;
    date: Date;
  };
  /** User's baseline if set during calibration */
  baseline?: {
    weight: number;
    reps: number;
  };
}

export interface QuickWorkoutInput {
  /** Target muscle groups for this workout */
  focusMuscles: MuscleGroup[];
  /** Available exercises (pre-filtered by equipment/constraints) */
  availableExercises: AvailableExercise[];
  /** User's available equipment (optional, for prioritization) */
  availableEquipment?: EquipmentType[];
  /** Target session duration in minutes (default: 45) */
  sessionDurationMinutes?: number;
  /** Training goal affects rep ranges */
  goal?: "strength" | "hypertrophy" | "conditioning";
}

export interface QuickWorkoutOutput {
  exercises: PlannedExercise[];
  estimatedDurationMinutes: number;
  /** Explains the selection rationale */
  reasoning: string[];
}

export interface QuickWorkoutConfig {
  /** Average time per set including rest (minutes) */
  minutesPerSet: number;
  /** Default rest between sets (seconds) */
  defaultRestSeconds: number;
  /** Minimum exercises to include */
  minExercises: number;
  /** Maximum exercises to include */
  maxExercises: number;
  /** How much to reduce weight for new exercises (multiplier) */
  newExerciseWeightMultiplier: number;
}

const defaultQuickWorkoutConfig: QuickWorkoutConfig = {
  minutesPerSet: 2.5, // ~90s rest + execution
  defaultRestSeconds: 90,
  minExercises: 3,
  maxExercises: 6,
  newExerciseWeightMultiplier: 0.7, // Start at 70% for exercises without history
};

/**
 * Get rep range based on training goal
 */
function getRepRangeForGoal(goal: "strength" | "hypertrophy" | "conditioning"): [number, number] {
  switch (goal) {
    case "strength":
      return [4, 6];
    case "hypertrophy":
      return [8, 12];
    case "conditioning":
      return [12, 20];
  }
}

/**
 * Get set count based on training goal
 */
function getSetCountForGoal(goal: "strength" | "hypertrophy" | "conditioning", isCompound: boolean): number {
  if (goal === "strength") {
    return isCompound ? 4 : 3;
  }
  if (goal === "hypertrophy") {
    return isCompound ? 4 : 3;
  }
  // Conditioning
  return isCompound ? 3 : 2;
}

/**
 * Score an exercise for selection based on muscle targeting and equipment preference
 */
function scoreExercise(
  exercise: AvailableExercise,
  focusMuscles: MuscleGroup[],
  availableEquipment?: EquipmentType[]
): number {
  let score = 0;

  // Primary muscle match is most important
  for (const muscle of exercise.primaryMuscles) {
    if (focusMuscles.includes(muscle)) {
      score += 10;
    }
  }

  // Secondary muscle match adds value
  for (const muscle of exercise.secondaryMuscles) {
    if (focusMuscles.includes(muscle)) {
      score += 3;
    }
  }

  // Compound exercises are generally more valuable
  if (exercise.isCompound) {
    score += 5;
  }

  // Prefer exercises user has history with
  if (exercise.lastPerformance) {
    score += 8;
  } else if (exercise.baseline) {
    score += 4;
  }

  // Equipment preference
  if (availableEquipment) {
    const hasPreferredEquipment = exercise.equipment.some((e) => availableEquipment.includes(e));
    if (hasPreferredEquipment) {
      score += 2;
    }
  }

  // Slight preference for barbell/dumbbell over machines for most goals
  if (exercise.equipment.includes("barbell") || exercise.equipment.includes("dumbbell")) {
    score += 1;
  }

  return score;
}

/**
 * Calculate working weight for an exercise
 */
function calculateExerciseWeight(
  exercise: AvailableExercise,
  goal: "strength" | "hypertrophy" | "conditioning"
): number {
  // If user has recent performance, use it as baseline
  if (exercise.lastPerformance) {
    const { weight, reps, rpe } = exercise.lastPerformance;

    // If they hit high reps at low RPE, suggest a slight increase
    if (reps >= 10 && (rpe === undefined || rpe < 7)) {
      return Math.round(weight * 1.05 * 2) / 2; // Round to nearest 0.5
    }

    // If they were at high RPE, keep same or reduce slightly
    if (rpe && rpe >= 9) {
      return Math.round(weight * 0.95 * 2) / 2;
    }

    // Otherwise maintain
    return weight;
  }

  // If user has baseline from calibration
  if (exercise.baseline) {
    // Adjust baseline based on goal
    const goalMultiplier = goal === "strength" ? 0.9 : goal === "hypertrophy" ? 0.75 : 0.6;
    return Math.round(exercise.baseline.weight * goalMultiplier * 2) / 2;
  }

  // No history - return 0 to indicate user should set weight
  // The API can decide to use bodyweight or ask user
  return 0;
}

/**
 * Generate a quick workout based on focus muscles and available exercises
 *
 * This is a pure function - all data must be passed in. The API layer is responsible for:
 * 1. Querying exercise library for exercises matching focusMuscles
 * 2. Filtering by user's available equipment
 * 3. Enriching with user's exercise history (lastPerformance, baseline)
 */
export function generateQuickWorkout(
  input: QuickWorkoutInput,
  config: QuickWorkoutConfig = defaultQuickWorkoutConfig
): QuickWorkoutOutput {
  const {
    focusMuscles,
    availableExercises,
    availableEquipment,
    sessionDurationMinutes = 45,
    goal = "hypertrophy",
  } = input;

  const reasoning: string[] = [];

  if (availableExercises.length === 0) {
    return {
      exercises: [],
      estimatedDurationMinutes: 0,
      reasoning: ["No exercises available for the selected muscle groups and equipment."],
    };
  }

  // Score and sort exercises
  const scoredExercises = availableExercises
    .map((exercise) => ({
      exercise,
      score: scoreExercise(exercise, focusMuscles, availableEquipment),
    }))
    .sort((a, b) => b.score - a.score);

  // Estimate how many exercises we can fit
  const avgSetsPerExercise = 3.5;
  const setsAvailable = Math.floor(sessionDurationMinutes / config.minutesPerSet);
  const targetExerciseCount = Math.min(
    Math.max(config.minExercises, Math.floor(setsAvailable / avgSetsPerExercise)),
    config.maxExercises,
    scoredExercises.length
  );

  reasoning.push(
    `Target: ${targetExerciseCount} exercises in ${sessionDurationMinutes} minutes (~${setsAvailable} total sets)`
  );

  // Select exercises ensuring muscle coverage
  const selectedExercises: AvailableExercise[] = [];
  const coveredMuscles = new Set<MuscleGroup>();

  // First pass: ensure each focus muscle is covered by at least one exercise
  for (const muscle of focusMuscles) {
    if (selectedExercises.length >= targetExerciseCount) break;

    const bestForMuscle = scoredExercises.find(
      ({ exercise }) =>
        !selectedExercises.includes(exercise) &&
        exercise.primaryMuscles.includes(muscle)
    );

    if (bestForMuscle) {
      selectedExercises.push(bestForMuscle.exercise);
      bestForMuscle.exercise.primaryMuscles.forEach((m) => coveredMuscles.add(m));
      bestForMuscle.exercise.secondaryMuscles.forEach((m) => coveredMuscles.add(m));
      reasoning.push(`Selected ${bestForMuscle.exercise.exerciseId} for ${muscle}`);
    }
  }

  // Second pass: fill remaining slots with highest scoring exercises
  for (const { exercise } of scoredExercises) {
    if (selectedExercises.length >= targetExerciseCount) break;
    if (selectedExercises.includes(exercise)) continue;

    selectedExercises.push(exercise);
    reasoning.push(`Added ${exercise.exerciseId} (score: ${scoreExercise(exercise, focusMuscles, availableEquipment)})`);
  }

  // Build planned exercises
  const plannedExercises: PlannedExercise[] = selectedExercises.map((exercise) => {
    const sets = getSetCountForGoal(goal, exercise.isCompound);
    const weight = calculateExerciseWeight(exercise, goal);

    return {
      exerciseId: exercise.exerciseId,
      sets,
      repRange: getRepRangeForGoal(goal),
      restSeconds: exercise.isCompound ? config.defaultRestSeconds + 30 : config.defaultRestSeconds,
      notes: weight === 0 ? "Set weight based on feel - start light" : undefined,
    };
  });

  // Calculate actual duration
  const totalSets = plannedExercises.reduce((sum, e) => sum + e.sets, 0);
  const estimatedDurationMinutes = Math.round(totalSets * config.minutesPerSet);

  reasoning.push(`Generated ${plannedExercises.length} exercises with ${totalSets} total sets`);
  reasoning.push(`Estimated duration: ${estimatedDurationMinutes} minutes`);

  return {
    exercises: plannedExercises,
    estimatedDurationMinutes,
    reasoning,
  };
}
