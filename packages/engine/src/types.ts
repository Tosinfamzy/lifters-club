import type { CyclePhaseConfig, EquipmentInstance, LoggedSet } from "@gymapp/types";

export interface ProgressionInput {
  exerciseId: string;
  recentSets: Pick<LoggedSet, "reps" | "rpe" | "weight">[];
  currentWeight: number;
  targetRepRange: [number, number];

  /** Optional baseline weight to use when no recent sets exist */
  baselineWeight?: number;
  /** Optional baseline reps (used with baselineWeight for starting point calculation) */
  baselineReps?: number;

  /**
   * Optional cycle-phase protocol. When absent, load progression behaves
   * exactly as it did before this axis existed (byte-identical). Orthogonal
   * to self-tuning (which flows through the config arg).
   */
  cyclePhase?: CyclePhaseConfig;

  /**
   * Optional physical-machine context. When present, the prescribed weight is
   * snapped DOWN to a load this machine can actually make, and a confirmed
   * working weight (if any) is preferred as the cold-start baseline. Absent →
   * byte-identical to the pre-equipment behavior.
   */
  equipment?: EquipmentInstance;
}

export interface VolumeInput {
  exerciseId: string;
  currentSetCount: number;
  recentPerformance: {
    completedSets: number;
    targetSets: number;
    avgRpe: number;
  }[];
  maxSetsPerExercise?: number;
  minSetsPerExercise?: number;
  /**
   * When true, this exercise is corrective-priority and its volume is held
   * (never reduced). The calling layer sets this from the athlete's
   * `correctivePriorityExerciseIds`.
   */
  isCorrectivePriority?: boolean;
}

export interface RotationInput {
  exerciseId: string;
  weeksOnExercise: number;
  performanceTrend: "improving" | "stagnant" | "declining";
  availableSubstitutes: string[];
}

export interface DeloadInput {
  weekNumber: number;
  recentWeeklyRpe: number[];
  missedSessions: number;
  consecutiveHardWeeks: number;
}
