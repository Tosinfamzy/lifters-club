import { z } from "zod";
import { muscleGroupSchema } from "./exercise";

export const trainingLevelSchema = z.enum(["beginner", "intermediate", "advanced"]);
export const primaryGoalSchema = z.enum(["strength", "hypertrophy", "conditioning"]);

export const userPreferencesSchema = z.object({
  focusAreas: z.array(muscleGroupSchema).optional(),
  avoidExercises: z.array(z.string()).optional(),
  equipmentAvailable: z.array(z.string()),
  daysPerWeek: z.number().int().min(1).max(7),
  sessionDurationMinutes: z.number().int().min(15).max(180),
});

export const plannedExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int().min(1).max(10),
  repRange: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  restSeconds: z.number().int().min(0).max(600),
  notes: z.string().optional(),
});

export const sessionTemplateSchema = z.object({
  dayNumber: z.number().int().min(1).max(7),
  name: z.string().min(1).max(100),
  focus: z.array(muscleGroupSchema),
  exercises: z.array(plannedExerciseSchema),
});

export const programTemplateSchema = z.object({
  weeks: z.number().int().min(1).max(52),
  sessions: z.array(sessionTemplateSchema),
});

export const createProgramSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).default(""),
  daysPerWeek: z.number().int().min(1).max(7),
  goal: primaryGoalSchema,
  level: trainingLevelSchema,
  template: programTemplateSchema,
});

export const loggedSetSchema = z.object({
  exerciseId: z.string().min(1),
  setNumber: z.number().int().min(1),
  weight: z.number().min(0),
  reps: z.number().int().min(0),
  rpe: z.number().min(1).max(10).optional(),
  notes: z.string().max(500).optional(),
});

export const createWorkoutLogSchema = z.object({
  workoutId: z.string().min(1),
  sets: z.array(loggedSetSchema),
  overallRpe: z.number().min(1).max(10).optional(),
  notes: z.string().max(1000).optional(),
});

export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
export type PlannedExerciseInput = z.infer<typeof plannedExerciseSchema>;
export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export type LoggedSetInput = z.infer<typeof loggedSetSchema>;
export type CreateWorkoutLogInput = z.infer<typeof createWorkoutLogSchema>;
