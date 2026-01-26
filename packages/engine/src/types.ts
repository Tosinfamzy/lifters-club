import type { LoggedSet } from "@gymapp/types";

export interface ProgressionInput {
  exerciseId: string;
  recentSets: Pick<LoggedSet, "reps" | "rpe" | "weight">[];
  currentWeight: number;
  targetRepRange: [number, number];
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
