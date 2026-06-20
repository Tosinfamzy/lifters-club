/**
 * Athlete Constraint Profile
 *
 * Models an athlete's *capability* restrictions (injuries, mobility, equipment
 * the athlete avoids). This is a different axis from the exercise-level
 * {@link Constraint} type, which describes apparatus an exercise *requires*.
 *
 * The engine consumes this profile to guarantee it never *recommends* an
 * unsafe movement.
 */

/**
 * Equipment classes an athlete avoids → filters by `Exercise.equipment`.
 */
export type EquipmentConstraint =
  | "no_barbell"
  | "no_machine"
  | "no_cable"
  | "no_dumbbell";

/**
 * Movements the athlete's body can't safely perform → filters by
 * `Exercise.movementPatterns`.
 */
export type MobilityConstraint =
  | "no_overhead"
  | "no_wrist_extension"
  | "no_deep_knee_flexion"
  | "no_spinal_loading"
  | "no_lumbar_flexion";

/**
 * Structured injury context for reasoning/audit (the "why").
 * Does NOT hard-filter exercises in the MVP — carried for context only.
 */
export interface InjuryFlag {
  /** Affected body region, e.g. "wrist", "lower_back". */
  region: string;
  /** Free-text note, e.g. "ganglion cyst". */
  note?: string;
  /** ISO date string for when the injury should be reviewed. */
  reviewDate?: string;
}

/**
 * An athlete's persisted constraint profile (one per user).
 */
export interface AthleteConstraints {
  /** Equipment classes the athlete avoids. */
  equipment: EquipmentConstraint[];
  /** Movement restrictions the athlete's body can't safely perform. */
  mobility: MobilityConstraint[];
  /** Structured injury context (reasoning/audit; does not hard-filter in MVP). */
  injuries?: InjuryFlag[];
  /** Specific exercise IDs to hard-exclude. */
  bannedExerciseIds?: string[];
  /** Exercise IDs protected from volume reduction (corrective work). */
  correctivePriorityExerciseIds?: string[];
}
