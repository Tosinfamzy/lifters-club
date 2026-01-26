import type { TrainingLevel, PrimaryGoal, UserPreferences } from "./training";

/**
 * User entity
 */
export interface User {
  id: string;
  clerkId: string;
  email: string;

  trainingLevel: TrainingLevel;
  primaryGoal: PrimaryGoal;
  preferences: UserPreferences;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new user
 */
export interface CreateUserInput {
  clerkId: string;
  email: string;
  trainingLevel: TrainingLevel;
  primaryGoal: PrimaryGoal;
  preferences: {
    focusAreas?: string[];
    equipmentAvailable: string[];
    daysPerWeek: number;
    sessionDurationMinutes: number;
  };
}

/**
 * Input for updating user
 */
export interface UpdateUserInput {
  trainingLevel?: TrainingLevel;
  primaryGoal?: PrimaryGoal;
  preferences?: Partial<{
    focusAreas: string[];
    avoidExercises: string[];
    equipmentAvailable: string[];
    daysPerWeek: number;
    sessionDurationMinutes: number;
  }>;
}
