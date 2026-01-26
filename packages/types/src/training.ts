import type { MuscleGroup } from "./exercise";

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
 * Workout - planned session instance
 */
export interface Workout {
  id: string;
  trainingBlockId: string;

  scheduledDate: Date;
  weekNumber: number;
  dayNumber: number;

  plannedExercises: PlannedExercise[];
  status: "pending" | "in_progress" | "completed" | "skipped";

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
 */
export interface WorkoutLog {
  id: string;
  workoutId: string;
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

  createdAt: Date;
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
