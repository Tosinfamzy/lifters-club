/**
 * Permanent Substitution
 *
 * Models an athlete's *persisted* exercise swap. When set, the engine returns
 * the chosen substitute directly instead of re-deriving one each time — which
 * fixes the "un-apply" error class where a deliberate swap kept getting reverted
 * because `findSubstitutes` recomputed it every call.
 *
 * Distinct from the on-the-fly substitution scoring: a permanent substitution is
 * a stored user decision, not a ranked suggestion.
 */

/**
 * Why an athlete permanently swapped an exercise. A small enum (mirrors
 * `InjuryFlag`) so the engine can build clean reason strings.
 */
export type SubstitutionReason =
  | "anatomy"
  | "injury"
  | "fit_preference"
  | "mobility"
  | "other";

/**
 * An athlete's persisted exercise swap (multiple rows per user, one per
 * original exercise).
 */
export interface PermanentSubstitution {
  /** The exercise being replaced. */
  originalExerciseId: string;
  /** The exercise to use in its place. */
  substituteExerciseId: string;
  /** Why the swap was made. */
  reason: SubstitutionReason;
  /** Optional free-text context (e.g. "left knee can't tolerate leg press"). */
  note?: string;
  /** ISO date string for when the athlete confirmed the swap. */
  confirmedAt: string;
  /**
   * Whether load progression should carry over from the original exercise's
   * history when the substitute lacks its own. Persisted for the phase-2
   * weight-carry read-through; not yet consumed by the progression engine.
   */
  weightCarries: boolean;
}
