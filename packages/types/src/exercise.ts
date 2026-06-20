/**
 * Movement Pattern Taxonomy (12 patterns)
 * Categorizes exercises by their primary movement mechanics
 */
export type MovementPattern =
  | "squat"           // knee-dominant lower
  | "hinge"           // hip-dominant lower
  | "lunge"           // single-leg, split stance
  | "push_horizontal" // bench, push-up
  | "push_vertical"   // overhead press
  | "pull_horizontal" // rows
  | "pull_vertical"   // pull-ups, lat pulldown
  | "carry"           // loaded locomotion
  | "core_anti"       // anti-extension, anti-rotation, anti-lateral
  | "isolation_upper" // curls, tricep work, lateral raises
  | "isolation_lower" // leg curl, leg extension, calf raise
  | "conditioning";   // sled, bike, ski erg, burpees

/**
 * Equipment Taxonomy (9 types)
 */
export type EquipmentType =
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "cable"
  | "machine"
  | "bodyweight"
  | "band"
  | "specialty"    // trap bar, landmine, GHD, etc.
  | "cardio";      // bike, rower, ski erg, sled

/**
 * Muscle Group Taxonomy (12 groups)
 */
export type MuscleGroup =
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "chest"
  | "lats"
  | "upper_back"    // traps, rhomboids, rear delts
  | "shoulders"     // primarily anterior/lateral delts
  | "biceps"
  | "triceps"
  | "forearms"
  | "core";

export type Difficulty = "beginner" | "intermediate" | "advanced";

/**
 * Grip Taxonomy
 *
 * The hand/forearm position an exercise loads. Part of exercise identity
 * (close-grip-bench is its own row), so each exercise has at most one grip.
 *
 * `none` and an absent grip are NEVER blocked by the constraint resolver — an
 * untagged exercise is treated as grip-agnostic and is never wrongly excluded.
 */
export type Grip =
  | "pronated"    // overhand (palms away/down) — loads wrist extension
  | "supinated"   // underhand (palms toward/up)
  | "neutral"     // palms facing each other (hammer/parallel)
  | "mixed"       // one pronated, one supinated (e.g. heavy deadlift)
  | "none";       // grip-agnostic (machines, bodyweight without a bar)

export type Constraint =
  | "rack"
  | "bench"
  | "cables"
  | "pull_up_bar"
  | "dip_station";

/**
 * Core Exercise entity
 * Represents a single exercise in the Exercise Library
 */
export interface Exercise {
  id: string;
  name: string;
  aliases: string[];

  equipment: EquipmentType[];
  movementPatterns: MovementPattern[];
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];

  isCompound: boolean;
  isUnilateral: boolean;
  difficulty: Difficulty;

  /** Hand/forearm position. Absent or `none` is never grip-filtered. */
  grip?: Grip;

  constraints?: Constraint[];

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Query parameters for finding exercise substitutes
 */
export interface SubstitutionQuery {
  exerciseId: string;
  excludeEquipment?: EquipmentType[];
  excludeConstraints?: Constraint[];
  preferredDifficulty?: Difficulty;
}

/**
 * Result from substitution algorithm
 */
export interface SubstitutionResult {
  exercise: Exercise;
  matchScore: number;
  reason: string;
}

/**
 * User preference for exercise substitution
 * Stored in AsyncStorage for offline-first support
 */
export interface ExercisePreference {
  originalId: string;
  substituteId: string;
  timestamp: string;
  reason?: string;
}

/**
 * Actions available in Exercise Actions Sheet
 */
export type ExerciseAction = "info" | "alternatives" | "skip" | "mark_done";
