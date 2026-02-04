import type { MovementPattern } from "./exercise";

/**
 * Equipment-based calibration path
 * Determines which exercises to use for baseline establishment
 */
export type CalibrationPath = "barbell" | "dumbbell" | "bodyweight" | "skip";

/**
 * How the user chose to establish their baseline weights
 */
export type BaselineMethod = "known_maxes" | "calibration" | "conservative_start";

/**
 * Source of a baseline weight
 */
export type BaselineSource = "user_input" | "calibration" | "inferred";

/**
 * How recent the user's known max is
 */
export type MaxRecentness = "current" | "within_month" | "older";

/**
 * A user-provided known max for an exercise
 */
export interface KnownMax {
  exerciseId: string;
  weight: number;
  reps: number;
  recentness: MaxRecentness;
}

/**
 * Input for the baseline establishment process
 */
export interface BaselineInput {
  method: BaselineMethod;
  calibrationPath: CalibrationPath;
  knownMaxes?: KnownMax[];
}

/**
 * A single baseline record for an exercise
 */
export interface UserBaseline {
  id: string;
  userId: string;
  exerciseId: string;
  baselineWeight: number;
  baselineReps: number;
  estimatedE1RM?: number;
  source: BaselineSource;
  establishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mapping of movement pattern to calibration exercise
 */
export interface CalibrationExercise {
  pattern: MovementPattern;
  exerciseId: string;
  exerciseName: string;
}

/**
 * A generated calibration plan for a user
 */
export interface CalibrationPlan {
  path: CalibrationPath;
  exercises: CalibrationExercise[];
  instructions: string;
}

/**
 * Result of processing calibration workout results
 */
export interface CalibrationResult {
  exerciseId: string;
  baselineWeight: number;
  baselineReps: number;
  estimatedE1RM: number;
}
