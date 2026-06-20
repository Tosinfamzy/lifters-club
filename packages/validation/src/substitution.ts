import { z } from "zod";

/**
 * Why an athlete permanently swapped an exercise. Matches the
 * `SubstitutionReason` union in `@gymapp/types`.
 */
export const substitutionReasonSchema = z.enum([
  "anatomy",
  "injury",
  "fit_preference",
  "mobility",
  "other",
]);

/**
 * An athlete's persisted exercise swap. The `.refine` rejects a self-map
 * (swapping an exercise for itself), which is never a meaningful substitution.
 */
export const permanentSubstitutionSchema = z
  .object({
    originalExerciseId: z.string().min(1, "Original exercise ID is required"),
    substituteExerciseId: z.string().min(1, "Substitute exercise ID is required"),
    reason: substitutionReasonSchema,
    note: z.string().max(500).optional(),
    // Optional ISO string; the route defaults it to "now" server-side when omitted.
    confirmedAt: z.string().optional(),
    // Defaults true: most swaps want load progression to carry over.
    weightCarries: z.boolean().default(true),
  })
  .refine(
    (data) => data.originalExerciseId !== data.substituteExerciseId,
    { message: "Cannot substitute an exercise for itself" }
  );

export type PermanentSubstitutionInput = z.infer<typeof permanentSubstitutionSchema>;
export type SubstitutionReasonInput = z.infer<typeof substitutionReasonSchema>;
