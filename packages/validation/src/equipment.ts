import { z } from "zod";

/**
 * Machine-specific load bounds for a single exercise. Mirrors the engine's
 * `EquipmentInstance` (`@gymapp/types`). All weight fields are optional — an
 * absent increment means "no snap", an absent `minWeight` means 0, and an
 * absent `confirmedWorkingWeight` means "no baseline preference".
 *
 * The bounds match what `POST /decisions/load-progression` validates at the
 * boundary so a malformed instance can never reach the engine's snap: a
 * non-positive increment would make the snap meaningless (division), and a
 * negative weight is never physical.
 */
const equipmentBounds = {
  incrementConstraint: z.number().positive().optional(),
  minWeight: z.number().min(0).optional(),
  confirmedWorkingWeight: z.number().min(0).optional(),
};

/**
 * The engine-input shape: bounds only (no exercise id), used to validate the
 * optional `equipment` object on a load-progression request.
 */
export const equipmentInstanceInputSchema = z.object(equipmentBounds);

/**
 * The persisted CRUD shape: bounds + the exercise the instance applies to + an
 * optional human label for a specific machine.
 */
export const equipmentInstanceSchema = z.object({
  exerciseId: z.string().min(1, "Exercise ID is required"),
  ...equipmentBounds,
  label: z.string().max(255).optional(),
});

export type EquipmentInstanceInput = z.infer<typeof equipmentInstanceSchema>;
