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
  workoutId: z.string().min(1).optional(),
  standaloneWorkoutId: z.string().min(1).optional(),
  sets: z.array(loggedSetSchema),
  overallRpe: z.number().min(1).max(10).optional(),
  notes: z.string().max(1000).optional(),
});

// ============ Workout Status ============

export const workoutStatusSchema = z.enum(["pending", "in_progress", "completed", "skipped"]);

// ============ Workout Templates ============

export const createWorkoutTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  focusMuscles: z.array(muscleGroupSchema).min(1),
  exercises: z.array(plannedExerciseSchema).min(1),
  estimatedDurationMinutes: z.number().int().min(10).max(180).optional(),
});

export const updateWorkoutTemplateSchema = createWorkoutTemplateSchema.partial();

// ============ Standalone Workouts ============

export const createStandaloneWorkoutSchema = z.object({
  name: z.string().min(1).max(255),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  templateId: z.string().min(1).max(64).optional(),
  weeklyPlanId: z.string().min(1).max(64).optional(),
  dayOfWeek: z.number().int().min(1).max(7).optional(),
  focusMuscles: z.array(muscleGroupSchema).min(1),
  exercises: z.array(plannedExerciseSchema).min(1),
});

export const updateStandaloneWorkoutSchema = createStandaloneWorkoutSchema.partial();

export const generateStandaloneWorkoutSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  focusMuscles: z.array(muscleGroupSchema).min(1),
  sessionDurationMinutes: z.number().int().min(15).max(180).optional(),
  saveAsTemplate: z.boolean().optional(),
  templateName: z.string().min(1).max(255).optional(),
}).refine(
  (data) => !data.saveAsTemplate || data.templateName,
  { message: "Template name required when saving as template", path: ["templateName"] }
);

// ============ Weekly Plans ============

export const weeklyPlanStatusSchema = z.enum(["active", "completed", "archived"]);

export const weeklyPlanWorkoutSchema = z.object({
  dayNumber: z.number().int().min(1).max(7),
  name: z.string().min(1).max(255),
  focusMuscles: z.array(muscleGroupSchema).min(1),
  exercises: z.array(plannedExerciseSchema).min(1),
});

export const createWeeklyPlanSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  daysPerWeek: z.number().int().min(1).max(7),
  goal: primaryGoalSchema,
  workouts: z.array(weeklyPlanWorkoutSchema).min(1),
});

export const updateWeeklyPlanSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  status: weeklyPlanStatusSchema.optional(),
});

export const generateWeeklyPlanSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  daysPerWeek: z.number().int().min(1).max(7),
  goal: primaryGoalSchema,
  focusMuscles: z.array(muscleGroupSchema).optional(),
});

// ============ Type Exports ============

export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
export type PlannedExerciseInput = z.infer<typeof plannedExerciseSchema>;
export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export type LoggedSetInput = z.infer<typeof loggedSetSchema>;
export type CreateWorkoutLogInput = z.infer<typeof createWorkoutLogSchema>;

export type CreateWorkoutTemplateInput = z.infer<typeof createWorkoutTemplateSchema>;
export type UpdateWorkoutTemplateInput = z.infer<typeof updateWorkoutTemplateSchema>;
export type CreateStandaloneWorkoutInput = z.infer<typeof createStandaloneWorkoutSchema>;
export type UpdateStandaloneWorkoutInput = z.infer<typeof updateStandaloneWorkoutSchema>;
export type GenerateStandaloneWorkoutInput = z.infer<typeof generateStandaloneWorkoutSchema>;
export type CreateWeeklyPlanInput = z.infer<typeof createWeeklyPlanSchema>;
export type UpdateWeeklyPlanInput = z.infer<typeof updateWeeklyPlanSchema>;
export type GenerateWeeklyPlanInput = z.infer<typeof generateWeeklyPlanSchema>;
