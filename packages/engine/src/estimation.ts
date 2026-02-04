/**
 * 1RM Estimation and Working Weight Calculation Utilities
 *
 * These functions help convert between different rep ranges and
 * estimate maxes based on submaximal work.
 */

/**
 * Configuration for estimation calculations
 */
export interface EstimationConfig {
  /** Minimum reps to use Epley formula (below this, use direct percentage) */
  minRepsForEpley: number;
  /** Maximum reps considered reliable for estimation */
  maxRepsForEstimation: number;
  /** Safety factor for conservative estimates (0.9 = 10% reduction) */
  safetyFactor: number;
}

export const defaultEstimationConfig: EstimationConfig = {
  minRepsForEpley: 2,
  maxRepsForEstimation: 15,
  safetyFactor: 0.95,
};

/**
 * Estimate one-rep max using the Epley formula
 *
 * Formula: 1RM = weight × (1 + reps/30)
 *
 * This is one of the most commonly used and validated formulas,
 * working well for rep ranges between 2-15.
 *
 * @param weight - Weight lifted
 * @param reps - Number of reps completed
 * @param config - Optional configuration
 * @returns Estimated 1RM
 *
 * @example
 * estimateOneRepMax(100, 10) // Returns ~133.3
 */
export function estimateOneRepMax(
  weight: number,
  reps: number,
  config: EstimationConfig = defaultEstimationConfig
): number {
  if (weight <= 0 || reps <= 0) {
    return 0;
  }

  // For 1 rep, the weight IS the 1RM (or close to it)
  if (reps === 1) {
    return weight;
  }

  // For very high reps, estimation becomes unreliable
  const effectiveReps = Math.min(reps, config.maxRepsForEstimation);

  // Epley formula: 1RM = weight × (1 + reps/30)
  const estimated = weight * (1 + effectiveReps / 30);

  // Apply safety factor for conservative estimate
  return Math.round(estimated * config.safetyFactor * 10) / 10;
}

/**
 * Calculate working weight from estimated 1RM for a target rep range
 *
 * Uses the inverse of the Epley formula to determine what weight
 * should be used for a given rep target.
 *
 * @param oneRepMax - Estimated or known 1RM
 * @param targetReps - Target number of reps
 * @returns Working weight for the target rep range
 *
 * @example
 * calculateWorkingWeight(100, 8) // Returns ~78.9
 */
export function calculateWorkingWeight(
  oneRepMax: number,
  targetReps: number
): number {
  if (oneRepMax <= 0 || targetReps <= 0) {
    return 0;
  }

  // Inverse Epley: weight = 1RM / (1 + reps/30)
  const weight = oneRepMax / (1 + targetReps / 30);

  // Round to nearest 2.5 (standard plate increment)
  return Math.round(weight / 2.5) * 2.5;
}

/**
 * Calculate percentage of 1RM for a given rep count
 *
 * Useful for understanding intensity zones.
 *
 * @param reps - Number of reps
 * @returns Percentage of 1RM (as decimal, e.g., 0.75 for 75%)
 *
 * @example
 * getPercentageOf1RM(10) // Returns ~0.75
 */
export function getPercentageOf1RM(reps: number): number {
  if (reps <= 0) return 1;
  if (reps === 1) return 1;

  // Inverse of Epley: percentage = 1 / (1 + reps/30)
  return 1 / (1 + reps / 30);
}

/**
 * Get estimated reps at a given percentage of 1RM
 *
 * @param percentage - Percentage of 1RM (as decimal)
 * @returns Estimated reps achievable at that percentage
 *
 * @example
 * getRepsAtPercentage(0.75) // Returns ~10
 */
export function getRepsAtPercentage(percentage: number): number {
  if (percentage <= 0 || percentage > 1) return 0;
  if (percentage === 1) return 1;

  // Solve for reps: percentage = 1 / (1 + reps/30)
  // reps = 30 × (1/percentage - 1)
  const reps = 30 * (1 / percentage - 1);

  return Math.round(reps);
}

/**
 * Adjust 1RM estimate based on recentness of the data
 *
 * Older maxes should be treated more conservatively as
 * strength may have changed.
 *
 * @param estimatedMax - The estimated 1RM
 * @param recentness - How recent the data is
 * @returns Adjusted estimate
 */
export function adjustForRecentness(
  estimatedMax: number,
  recentness: "current" | "within_month" | "older"
): number {
  const adjustments = {
    current: 1.0,      // No adjustment for current data
    within_month: 0.95, // 5% reduction for month-old data
    older: 0.9,        // 10% reduction for older data
  };

  return Math.round(estimatedMax * adjustments[recentness] * 10) / 10;
}

/**
 * Calculate a conservative starting weight for a new exercise
 *
 * When no baseline exists, this provides a safe starting point
 * based on training level and target rep range.
 *
 * @param trainingLevel - User's experience level
 * @param targetReps - Target rep range
 * @param exerciseCategory - Type of exercise (compound vs isolation)
 * @returns Suggested starting weight in lbs
 */
export function getConservativeStartingWeight(
  trainingLevel: "beginner" | "intermediate" | "advanced",
  targetReps: number,
  exerciseCategory: "compound" | "isolation"
): number {
  // Base weights by level and category (in lbs)
  const baseWeights = {
    beginner: { compound: 45, isolation: 10 },     // Empty barbell / light dumbbells
    intermediate: { compound: 95, isolation: 20 }, // 1 plate / moderate dumbbells
    advanced: { compound: 135, isolation: 30 },    // 1.5 plates / heavier dumbbells
  };

  const baseWeight = baseWeights[trainingLevel][exerciseCategory];

  // Adjust for target rep range (higher reps = lighter starting weight)
  if (targetReps >= 12) {
    return Math.round(baseWeight * 0.8 / 5) * 5;
  }
  if (targetReps >= 8) {
    return Math.round(baseWeight * 0.9 / 5) * 5;
  }

  return baseWeight;
}
