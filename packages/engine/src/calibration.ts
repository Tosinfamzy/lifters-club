/**
 * Calibration Engine
 *
 * Determines calibration path based on equipment and generates
 * calibration plans for new users to establish baseline weights.
 */

import type {
  CalibrationPath,
  CalibrationPlan,
  CalibrationExercise,
  CalibrationResult,
  MovementPattern,
  PrimaryGoal,
  LoggedSet,
} from "@gymapp/types";
import { estimateOneRepMax, calculateWorkingWeight } from "./estimation";

/**
 * Equipment types that determine calibration path
 */
type Equipment = "barbell" | "dumbbell" | "cables" | "machines" | "bodyweight";

/**
 * Configuration for calibration
 */
export interface CalibrationConfig {
  /** Target reps for calibration sets */
  calibrationReps: number;
  /** Number of calibration sets per exercise */
  calibrationSets: number;
  /** Whether to include all movement patterns */
  fullCalibration: boolean;
}

export const defaultCalibrationConfig: CalibrationConfig = {
  calibrationReps: 8,
  calibrationSets: 3,
  fullCalibration: true,
};

/**
 * Movement patterns mapped to calibration exercises by equipment type
 */
const CALIBRATION_MOVEMENTS: Record<CalibrationPath, CalibrationExercise[]> = {
  barbell: [
    { pattern: "squat", exerciseId: "barbell-back-squat", exerciseName: "Barbell Back Squat" },
    { pattern: "hinge", exerciseId: "conventional-deadlift", exerciseName: "Conventional Deadlift" },
    { pattern: "push_horizontal", exerciseId: "barbell-bench-press", exerciseName: "Barbell Bench Press" },
    { pattern: "pull_horizontal", exerciseId: "barbell-row", exerciseName: "Barbell Row" },
    { pattern: "push_vertical", exerciseId: "overhead-press", exerciseName: "Overhead Press" },
  ],
  dumbbell: [
    { pattern: "squat", exerciseId: "goblet-squat", exerciseName: "Goblet Squat" },
    { pattern: "hinge", exerciseId: "dumbbell-romanian-deadlift", exerciseName: "Dumbbell Romanian Deadlift" },
    { pattern: "push_horizontal", exerciseId: "dumbbell-bench-press", exerciseName: "Dumbbell Bench Press" },
    { pattern: "pull_horizontal", exerciseId: "dumbbell-row", exerciseName: "Dumbbell Row" },
    { pattern: "push_vertical", exerciseId: "dumbbell-shoulder-press", exerciseName: "Dumbbell Shoulder Press" },
  ],
  bodyweight: [], // No calibration for bodyweight-only users
  skip: [],
};

/**
 * Determine the calibration path based on available equipment
 *
 * @param equipment - List of equipment available to the user
 * @returns The recommended calibration path
 *
 * @example
 * getCalibrationPath(["barbell", "dumbbell"]) // Returns "barbell"
 * getCalibrationPath(["dumbbell"]) // Returns "dumbbell"
 * getCalibrationPath([]) // Returns "bodyweight"
 */
export function getCalibrationPath(equipment: Equipment[]): CalibrationPath {
  // Prefer barbell if available (most standardized)
  if (equipment.includes("barbell")) {
    return "barbell";
  }

  // Dumbbell is second choice
  if (equipment.includes("dumbbell")) {
    return "dumbbell";
  }

  // Bodyweight-only users skip calibration (use conservative start)
  if (equipment.length === 0 || equipment.every((e) => e === "bodyweight")) {
    return "bodyweight";
  }

  // Mixed equipment without barbell/dumbbell - skip calibration
  return "skip";
}

/**
 * Generate a calibration plan for a user
 *
 * @param calibrationPath - The determined calibration path
 * @param userGoal - User's training goal
 * @param config - Calibration configuration
 * @returns A calibration plan or null if calibration is skipped
 *
 * @example
 * generateCalibrationPlan("barbell", "strength")
 */
export function generateCalibrationPlan(
  calibrationPath: CalibrationPath,
  userGoal: PrimaryGoal,
  config: CalibrationConfig = defaultCalibrationConfig
): CalibrationPlan | null {
  // No calibration for bodyweight or skip paths
  if (calibrationPath === "bodyweight" || calibrationPath === "skip") {
    return null;
  }

  const exercises = CALIBRATION_MOVEMENTS[calibrationPath] ?? [];

  // For strength focus, prioritize compound movements
  // For hypertrophy, all movements are equally important
  let selectedExercises = exercises;
  if (!config.fullCalibration && userGoal === "strength") {
    // Just squat, hinge, and horizontal push for minimal calibration
    selectedExercises = exercises.filter((e) =>
      ["squat", "hinge", "push_horizontal"].includes(e.pattern)
    );
  }

  const instructions = generateCalibrationInstructions(
    calibrationPath,
    config.calibrationReps,
    config.calibrationSets
  );

  return {
    path: calibrationPath,
    exercises: selectedExercises,
    instructions,
  };
}

/**
 * Generate human-readable calibration instructions
 */
function generateCalibrationInstructions(
  path: CalibrationPath,
  targetReps: number,
  sets: number
): string {
  return `
For each exercise, perform ${sets} sets of ${targetReps} reps.
Start with a light weight and increase until the last set feels like an RPE 7-8
(you could do 2-3 more reps if needed).

Use proper form and don't push to failure.
${path === "barbell" ? "Start with just the barbell (45 lbs) to warm up." : "Start with light dumbbells to warm up."}

Record the weight from your final working set for each exercise.
  `.trim();
}

/**
 * Get calibration exercises for a specific movement pattern
 *
 * @param pattern - The movement pattern
 * @param path - The calibration path
 * @returns The exercise for that pattern, or undefined
 */
export function getCalibrationExerciseForPattern(
  pattern: MovementPattern,
  path: CalibrationPath
): CalibrationExercise | undefined {
  if (path === "bodyweight" || path === "skip") {
    return undefined;
  }

  const movements = CALIBRATION_MOVEMENTS[path];
  return movements?.find((e) => e.pattern === pattern);
}

/**
 * Process calibration workout results into baseline weights
 *
 * Takes the logged sets from a calibration workout and converts them
 * into baseline records that can be saved.
 *
 * @param calibrationSets - Sets logged during calibration
 * @param targetReps - The target rep count used during calibration
 * @returns Array of baseline results
 *
 * @example
 * processCalibrationResults([
 *   { exerciseId: "barbell-bench-press", weight: 135, reps: 8, rpe: 7 },
 *   { exerciseId: "barbell-bench-press", weight: 135, reps: 8, rpe: 8 },
 * ])
 */
export function processCalibrationResults(
  calibrationSets: LoggedSet[],
  targetReps: number = 8
): CalibrationResult[] {
  // Group sets by exercise
  const setsByExercise = new Map<string, LoggedSet[]>();

  for (const set of calibrationSets) {
    const existing = setsByExercise.get(set.exerciseId) || [];
    existing.push(set);
    setsByExercise.set(set.exerciseId, existing);
  }

  const results: CalibrationResult[] = [];

  for (const [exerciseId, sets] of setsByExercise) {
    // Use the heaviest set that was completed with good form
    // (assuming sets are logged in order, last set is often the heaviest)
    const bestSet = sets.reduce((best, current) => {
      // Prefer sets at or near target reps
      const currentNearTarget = Math.abs(current.reps - targetReps) <= 2;
      const bestNearTarget = Math.abs(best.reps - targetReps) <= 2;

      if (currentNearTarget && !bestNearTarget) return current;
      if (!currentNearTarget && bestNearTarget) return best;

      // Both near target or both not - prefer higher weight
      return current.weight >= best.weight ? current : best;
    });

    // Calculate estimated 1RM from the best set
    const estimatedE1RM = estimateOneRepMax(bestSet.weight, bestSet.reps);

    results.push({
      exerciseId,
      baselineWeight: bestSet.weight,
      baselineReps: bestSet.reps,
      estimatedE1RM,
    });
  }

  return results;
}

/**
 * Calculate working weight for a baseline given target reps
 *
 * @param baseline - The user's baseline for an exercise
 * @param targetReps - Target reps for the working set
 * @returns Recommended working weight
 */
export function getWorkingWeightFromBaseline(
  baseline: { estimatedE1RM?: number; baselineWeight: number; baselineReps: number },
  targetReps: number
): number {
  // If we have estimated 1RM, use it
  if (baseline.estimatedE1RM) {
    return calculateWorkingWeight(baseline.estimatedE1RM, targetReps);
  }

  // Otherwise estimate from baseline
  const e1rm = estimateOneRepMax(baseline.baselineWeight, baseline.baselineReps);
  return calculateWorkingWeight(e1rm, targetReps);
}

/**
 * Check if a user needs calibration based on their equipment
 *
 * @param equipment - User's available equipment
 * @returns Whether calibration is recommended
 */
export function shouldRunCalibration(equipment: Equipment[]): boolean {
  const path = getCalibrationPath(equipment);
  return path !== "bodyweight" && path !== "skip";
}
