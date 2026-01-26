import { z } from "zod";

export const movementPatternSchema = z.enum([
  "squat",
  "hinge",
  "lunge",
  "push_horizontal",
  "push_vertical",
  "pull_horizontal",
  "pull_vertical",
  "carry",
  "core_anti",
  "isolation_upper",
  "isolation_lower",
  "conditioning",
]);

export const equipmentTypeSchema = z.enum([
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "bodyweight",
  "band",
  "specialty",
  "cardio",
]);

export const muscleGroupSchema = z.enum([
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "chest",
  "lats",
  "upper_back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "core",
]);

export const difficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

export const constraintSchema = z.enum([
  "rack",
  "bench",
  "cables",
  "pull_up_bar",
  "dip_station",
]);

export const exerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  aliases: z.array(z.string()).default([]),

  equipment: z.array(equipmentTypeSchema).min(1),
  movementPatterns: z.array(movementPatternSchema).min(1),
  primaryMuscles: z.array(muscleGroupSchema).min(1),
  secondaryMuscles: z.array(muscleGroupSchema).default([]),

  isCompound: z.boolean(),
  isUnilateral: z.boolean().default(false),
  difficulty: difficultySchema,

  constraints: z.array(constraintSchema).optional(),
});

export const createExerciseSchema = exerciseSchema.omit({
  id: true,
}).extend({
  id: z.string().min(1).optional(), // Allow auto-generation
});

export const updateExerciseSchema = exerciseSchema.partial().omit({
  id: true,
});

export const substitutionQuerySchema = z.object({
  exerciseId: z.string().min(1),
  excludeEquipment: z.array(equipmentTypeSchema).optional(),
  excludeConstraints: z.array(constraintSchema).optional(),
  preferredDifficulty: difficultySchema.optional(),
});

export type ExerciseInput = z.infer<typeof exerciseSchema>;
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;
export type SubstitutionQueryInput = z.infer<typeof substitutionQuerySchema>;
