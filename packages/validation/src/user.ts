import { z } from "zod";
import { trainingLevelSchema, primaryGoalSchema, userPreferencesSchema } from "./training";

export const createUserSchema = z.object({
  clerkId: z.string().min(1),
  email: z.string().email(),
  trainingLevel: trainingLevelSchema,
  primaryGoal: primaryGoalSchema,
  preferences: userPreferencesSchema,
});

export const updateUserSchema = z.object({
  trainingLevel: trainingLevelSchema.optional(),
  primaryGoal: primaryGoalSchema.optional(),
  preferences: userPreferencesSchema.partial().optional(),
});

export type CreateUserSchemaInput = z.infer<typeof createUserSchema>;
export type UpdateUserSchemaInput = z.infer<typeof updateUserSchema>;
