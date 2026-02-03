/**
 * Local type definitions for the mobile app
 * These mirror the types from @gymapp/types but are defined locally
 * to avoid direct package dependencies in the mobile app
 */

/**
 * Actions available in Exercise Actions Sheet
 */
export type ExerciseAction = "info" | "alternatives" | "skip" | "mark_done";

/**
 * User preference for exercise substitution
 * Stored in AsyncStorage for offline-first support
 */
export interface ExercisePreference {
  originalId: string;
  substituteId: string;
  timestamp: string;
  reason?: string;
}

/**
 * Exercise entity (minimal version for mobile)
 */
export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  equipment: string[];
  movementPatterns: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  isCompound: boolean;
  isUnilateral: boolean;
  difficulty: string;
  constraints?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result from substitution algorithm (matches ScoredSubstitute in the app)
 */
export interface SubstitutionResult {
  exercise: {
    id: string;
    name: string;
    equipment: string[];
    difficulty: "beginner" | "intermediate" | "advanced";
  };
  score: number;
  matchReasons: string[];
}
