import type {
  Exercise,
  AthleteConstraints,
  EquipmentConstraint,
  MobilityConstraint,
  EquipmentType,
  MovementPattern,
} from "@gymapp/types";

/**
 * Result of evaluating an exercise against an athlete's constraint profile.
 */
export interface ConstraintCheckResult {
  allowed: boolean;
  /** Present only when `allowed` is false — explains the block. */
  reason?: string;
}

/**
 * Tunable mapping config for the constraint resolver (OCP — change behavior
 * via config, not code). Defaults are conservative-safe: when a coarse mapping
 * could plausibly include an unsafe pattern, it over-excludes rather than risk
 * recommending an unsafe movement.
 */
export interface ConstraintResolverConfig {
  /** Maps each equipment constraint to the `EquipmentType` it blocks. */
  equipmentMap: Record<EquipmentConstraint, EquipmentType>;
  /** Maps each mobility constraint to the `MovementPattern`s it blocks. */
  mobilityMap: Record<MobilityConstraint, MovementPattern[]>;
}

/**
 * Default resolver config. Movement maps are intentionally coarse and
 * conservative (e.g. `no_spinal_loading` blocks both squat and hinge).
 *
 * Note: `no_wrist_extension` has no movement-pattern proxy on `Exercise`
 * (it's a grip/joint-position concern), so it maps to no patterns in the MVP
 * and is effectively context-only. Grip-level filtering is deferred to phase 2.
 */
export const defaultConstraintResolverConfig: ConstraintResolverConfig = {
  equipmentMap: {
    no_barbell: "barbell",
    no_machine: "machine",
    no_cable: "cable",
    no_dumbbell: "dumbbell",
  },
  mobilityMap: {
    no_overhead: ["push_vertical"],
    no_deep_knee_flexion: ["squat", "lunge"],
    no_spinal_loading: ["squat", "hinge"],
    no_lumbar_flexion: ["hinge"],
    no_wrist_extension: [],
  },
};

/**
 * Decide whether an exercise is safe for an athlete given their constraint
 * profile.
 *
 * This is a pure function — no side effects, no DB calls.
 *
 * Resolution order (first block wins):
 * 1. `bannedExerciseIds` — hard per-exercise exclusion.
 * 2. `equipment` — block if the exercise uses a blocked equipment class.
 * 3. `mobility` — block if the exercise involves a blocked movement pattern.
 *
 * `injuries` and `correctivePriorityExerciseIds` never filter here — the former
 * is context-only, the latter drives volume protection elsewhere.
 *
 * @param exercise - The candidate exercise.
 * @param constraints - The athlete's constraint profile.
 * @param config - Tunable mapping config (optional).
 * @returns Whether the exercise is allowed, and a reason when blocked.
 */
export function isExerciseAllowed(
  exercise: Exercise,
  constraints: AthleteConstraints,
  config: ConstraintResolverConfig = defaultConstraintResolverConfig
): ConstraintCheckResult {
  // 1. Hard per-exercise exclusion.
  if (constraints.bannedExerciseIds?.includes(exercise.id)) {
    return { allowed: false, reason: `Exercise is banned (bannedExerciseIds)` };
  }

  // 2. Equipment restrictions.
  for (const restriction of constraints.equipment) {
    const blockedEquipment = config.equipmentMap[restriction];
    if (exercise.equipment.includes(blockedEquipment)) {
      return {
        allowed: false,
        reason: `Uses ${blockedEquipment} (${restriction} restriction)`,
      };
    }
  }

  // 3. Mobility restrictions.
  for (const restriction of constraints.mobility) {
    const blockedPatterns = config.mobilityMap[restriction];
    const conflict = exercise.movementPatterns.find((p) =>
      blockedPatterns.includes(p)
    );
    if (conflict) {
      return {
        allowed: false,
        reason: `Involves ${conflict} movement (${restriction} restriction)`,
      };
    }
  }

  return { allowed: true };
}
