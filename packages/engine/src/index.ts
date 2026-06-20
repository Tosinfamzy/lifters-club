// Engine version - bump when algorithm logic changes
export const ENGINE_VERSION = "1.1.0";

// Core decision functions
export {
  calculateLoadProgression,
  applyProgressionModifier,
  defaultCyclePhaseConfig,
} from "./progression";
export { calculateVolumeAdjustment, applyVolumeModifier } from "./volume";
export { calculateExerciseRotation } from "./rotation";
export { calculateDeloadNeed } from "./deload";
export { calculateSessionRecovery } from "./recovery";
export { calculateMissedSessionHandling } from "./missed-session";
export { generateWeeklyPlan, calculatePerformanceTrend, generateQuickWorkout } from "./planning";

// Readiness assessment
export { calculateSessionReadiness } from "./readiness";

// Decision feedback and evaluation
export {
  evaluateLoadProgression,
  evaluateVolumeAdjustment,
  evaluateExerciseRotation,
  evaluateDeloadRecommendation,
  evaluateSessionRecovery,
  evaluateDecision,
  getProgressionModifier,
  getDecisionConfidence,
} from "./feedback";

// Substitution functions
export { findSubstitutes, getTopSubstitutes, isValidSubstitute } from "./substitution";

// Athlete constraint resolver
export { isExerciseAllowed, defaultConstraintResolverConfig } from "./constraints";

// 1RM estimation and working weight calculation
export {
  estimateOneRepMax,
  calculateWorkingWeight,
  getPercentageOf1RM,
  getRepsAtPercentage,
  adjustForRecentness,
  getConservativeStartingWeight,
} from "./estimation";

// Calibration and baseline establishment
export {
  getCalibrationPath,
  generateCalibrationPlan,
  getCalibrationExerciseForPattern,
  processCalibrationResults,
  getWorkingWeightFromBaseline,
  shouldRunCalibration,
} from "./calibration";

// Input types
export type {
  ProgressionInput,
  VolumeInput,
  RotationInput,
  DeloadInput,
} from "./types";

// Recovery types
export type {
  RecoveryInput,
  RecoveryDecision,
  RecoveryConfig,
} from "./recovery";

// Missed session types
export type {
  MissedReason,
  MissedSessionInput,
  MissedSessionDecision,
  MissedSessionConfig,
} from "./missed-session";

// Planning types
export type {
  ExercisePerformance,
  ConstraintDecision,
  WeeklyPlanInput,
  PlannedExerciseUpdate,
  WeeklyPlanDecision,
  PlanningConfig,
  // Quick workout types
  AvailableExercise,
  QuickWorkoutInput,
  QuickWorkoutOutput,
  QuickWorkoutConfig,
} from "./planning";

// Substitution types
export type {
  SubstitutionInput,
  SubstitutionConfig,
  ScoredSubstitute,
} from "./substitution";

// Constraint resolver types
export type { ConstraintResolverConfig, ConstraintCheckResult } from "./constraints";

// Readiness types
export type {
  ReadinessInput,
  ReadinessResult,
  ReadinessRecommendation,
  ReadinessConfig,
} from "./readiness";

// Feedback types
export type { EvaluationResult, EvaluationContext, FeedbackEvalConfig } from "./feedback";

// Config types for customization
export type { ProgressionConfig } from "./progression";
export type { VolumeConfig } from "./volume";
export type { RotationConfig } from "./rotation";
export type { DeloadConfig } from "./deload";

// Estimation types
export type { EstimationConfig } from "./estimation";

// Calibration types
export type { CalibrationConfig, CalibrationSetInput } from "./calibration";
