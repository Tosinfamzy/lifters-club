import { z } from "zod";

/**
 * Equipment classes an athlete avoids. Matches the `EquipmentConstraint`
 * union in `@gymapp/types`.
 */
export const equipmentConstraintSchema = z.enum([
  "no_barbell",
  "no_machine",
  "no_cable",
  "no_dumbbell",
]);

/**
 * Movement restrictions an athlete's body can't safely perform. Matches the
 * `MobilityConstraint` union in `@gymapp/types`.
 */
export const mobilityConstraintSchema = z.enum([
  "no_overhead",
  "no_wrist_extension",
  "no_deep_knee_flexion",
  "no_spinal_loading",
  "no_lumbar_flexion",
]);

/**
 * Grip positions an athlete must avoid. Matches the `GripRestriction` union
 * in `@gymapp/types`.
 */
export const gripRestrictionSchema = z.enum([
  "neutral_grip_only",
  "no_pronated",
  "no_supinated",
]);

/**
 * Structured injury context (the "why"). Does not hard-filter in the MVP.
 */
export const injuryFlagSchema = z.object({
  region: z.string().min(1, "Injury region is required"),
  note: z.string().max(500).optional(),
  reviewDate: z.string().optional(),
});

/**
 * Full athlete constraint profile (one per user).
 */
export const athleteConstraintsSchema = z.object({
  equipment: z.array(equipmentConstraintSchema).default([]),
  mobility: z.array(mobilityConstraintSchema).default([]),
  grip: z.array(gripRestrictionSchema).default([]),
  injuries: z.array(injuryFlagSchema).default([]),
  bannedExerciseIds: z.array(z.string().min(1)).default([]),
  correctivePriorityExerciseIds: z.array(z.string().min(1)).default([]),
});

export type AthleteConstraintsInput = z.infer<typeof athleteConstraintsSchema>;
export type InjuryFlagInput = z.infer<typeof injuryFlagSchema>;
