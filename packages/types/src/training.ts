import type { MuscleGroup } from "./exercise";

/**
 * Weight measurement unit
 */
export type WeightUnit = "lbs" | "kg";

/**
 * User training experience level
 */
export type TrainingLevel = "beginner" | "intermediate" | "advanced";

/**
 * User's primary training goal
 */
export type PrimaryGoal = "strength" | "hypertrophy" | "conditioning";

/**
 * User preferences for training
 */
export interface UserPreferences {
  focusAreas?: MuscleGroup[];
  avoidExercises?: string[];
  equipmentAvailable: string[];
  daysPerWeek: number;
  sessionDurationMinutes: number;
  weightUnit?: WeightUnit;
}

/**
 * Program template structure
 */
export interface ProgramTemplate {
  weeks: number;
  sessions: SessionTemplate[];
}

/**
 * Single session within a program
 */
export interface SessionTemplate {
  dayNumber: number;
  name: string;
  focus: MuscleGroup[];
  exercises: PlannedExercise[];
}

/**
 * Exercise prescription within a session
 */
export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repRange: [number, number];
  restSeconds: number;
  notes?: string;
}

/**
 * Program definition
 */
export interface Program {
  id: string;
  name: string;
  description: string;

  daysPerWeek: number;
  goal: PrimaryGoal;
  level: TrainingLevel;

  template: ProgramTemplate;

  createdAt: Date;
}

/**
 * Training Block - time-bounded program instance for a user
 */
export interface TrainingBlock {
  id: string;
  userId: string;
  programId: string;

  startDate: Date;
  endDate?: Date;
  currentWeek: number;

  status: "active" | "completed" | "paused";

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Workout status for both program and standalone workouts
 */
export type WorkoutStatus = "pending" | "in_progress" | "completed" | "skipped";

/**
 * Workout - planned session instance (tied to a training block/program)
 */
export interface Workout {
  id: string;
  trainingBlockId: string;

  scheduledDate: Date;
  weekNumber: number;
  dayNumber: number;

  plannedExercises: PlannedExercise[];
  status: WorkoutStatus;

  createdAt: Date;
  updatedAt: Date;
}

// ============ Standalone Workouts ============

/**
 * Workout Template - reusable workout blueprint (e.g., "Back Day", "Push Day")
 */
export interface WorkoutTemplate {
  id: string;
  userId: string;

  name: string;
  description?: string;

  focusMuscles: MuscleGroup[];
  exercises: PlannedExercise[];

  estimatedDurationMinutes?: number;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Weekly Plan - standalone week of workouts (not tied to multi-week programs)
 */
export interface WeeklyPlan {
  id: string;
  userId: string;

  name: string;
  description?: string;

  startDate: Date;
  daysPerWeek: number;

  goal: PrimaryGoal;
  status: "active" | "completed" | "archived";

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Standalone Workout - single workout not tied to a program
 */
export interface StandaloneWorkout {
  id: string;
  userId: string;

  templateId?: string; // if created from a template
  weeklyPlanId?: string; // if part of a weekly plan

  name: string;
  scheduledDate: Date;
  dayOfWeek?: number; // 1-7 for weekly plan placement

  plannedExercises: PlannedExercise[];
  focusMuscles: MuscleGroup[];

  status: WorkoutStatus;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Individual logged set
 */
export interface LoggedSet {
  id: string;
  workoutLogId: string;
  exerciseId: string;

  setNumber: number;
  weight: number;
  reps: number;
  rpe?: number; // 1-10 rating of perceived exertion

  notes?: string;

  createdAt: Date;
}

/**
 * Workout Log - completed workout record
 * Can be linked to a program workout, standalone workout, or neither (retrospective)
 */
export interface WorkoutLog {
  id: string;
  workoutId?: string; // program workout (nullable)
  standaloneWorkoutId?: string; // standalone workout (nullable)
  userId: string;

  startedAt: Date;
  completedAt?: Date;

  sets: LoggedSet[];

  overallRpe?: number;
  notes?: string;

  createdAt: Date;
}

/**
 * Types of decisions the engine can make
 */
export type DecisionType =
  | "load_progression"
  | "volume_adjustment"
  | "exercise_rotation"
  | "deload_recommendation"
  | "session_recovery"
  | "missed_session"
  | "weekly_plan_update";

/**
 * Decision audit record
 */
export interface Decision {
  id: string;
  userId: string;
  workoutId?: string;

  type: DecisionType;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  reasoning: string;

  algorithmVersion: string;

  createdAt: Date;
}

// ============ Decision Feedback Types ============

/**
 * What happened after a decision was made
 */
export type DecisionOutcome = "followed" | "overridden" | "ignored";

/**
 * Why a user overrode a decision
 */
export type OverrideReason =
  | "felt_too_heavy"
  | "felt_too_light"
  | "equipment_unavailable"
  | "time_constraint"
  | "injury_concern"
  | "other";

/**
 * Human-readable labels for override reasons
 */
export const OVERRIDE_REASON_LABELS: Record<OverrideReason, string> = {
  felt_too_heavy: "Feels too heavy today",
  felt_too_light: "Feels too light",
  equipment_unavailable: "Equipment not available",
  time_constraint: "Short on time",
  injury_concern: "Minor injury/discomfort",
  other: "Other reason",
};

/**
 * Recorded outcome for a decision
 */
export interface DecisionOutcomeRecord {
  id: string;
  decisionId: string;
  userId: string;

  outcome: DecisionOutcome;
  success: boolean | null; // null if not yet evaluated

  overrideReason?: OverrideReason;

  expectedValue?: Record<string, unknown>;
  actualValue?: Record<string, unknown>;

  evaluatedAt?: Date;
  createdAt: Date;
}

/**
 * Accuracy statistics for a user's decisions
 */
export interface DecisionAccuracyStats {
  userId: string;
  totalDecisions: number;
  followed: number;
  overridden: number;
  ignored: number;
  successRate: number; // of followed decisions that were evaluated
  overrideReasons: Partial<Record<OverrideReason, number>>;
  byType: Partial<
    Record<
      DecisionType,
      {
        total: number;
        followed: number;
        successRate: number;
      }
    >
  >;
}

/**
 * Load progression decision output
 */
export interface LoadDecision {
  action: "increase" | "maintain" | "decrease";
  newWeight: number;
  reason: string;
}

/**
 * Volume adjustment decision output
 */
export interface VolumeDecision {
  action: "add_set" | "maintain" | "reduce_set";
  newSetCount: number;
  reason: string;
}

/**
 * Exercise rotation decision output
 */
export interface RotationDecision {
  action: "keep" | "swap";
  newExerciseId?: string;
  reason: string;
}

/**
 * Deload recommendation output
 */
export interface DeloadDecision {
  recommended: boolean;
  reason: string;
}
