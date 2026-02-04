// Engine version - bump when algorithm logic changes
export const ENGINE_VERSION = "1.0.0";

// Core decision functions
export { calculateLoadProgression } from "./progression";
export { calculateVolumeAdjustment } from "./volume";
export { calculateExerciseRotation } from "./rotation";
export { calculateDeloadNeed } from "./deload";
export { calculateSessionRecovery } from "./recovery";
export { calculateMissedSessionHandling } from "./missed-session";
export { generateWeeklyPlan, calculatePerformanceTrend } from "./planning";

// Readiness assessment
export { calculateSessionReadiness } from "./readiness";

// Substitution functions
export { findSubstitutes, getTopSubstitutes, isValidSubstitute } from "./substitution";

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
  WeeklyPlanInput,
  PlannedExerciseUpdate,
  WeeklyPlanDecision,
  PlanningConfig,
} from "./planning";

// Substitution types
export type {
  SubstitutionInput,
  SubstitutionConfig,
  ScoredSubstitute,
} from "./substitution";

// Readiness types
export type {
  ReadinessInput,
  ReadinessResult,
  ReadinessRecommendation,
  ReadinessConfig,
} from "./readiness";

// Config types for customization
export type { ProgressionConfig } from "./progression";
export type { VolumeConfig } from "./volume";
export type { RotationConfig } from "./rotation";
export type { DeloadConfig } from "./deload";
