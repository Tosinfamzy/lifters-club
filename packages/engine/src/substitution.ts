import type { Exercise, MuscleGroup, MovementPattern, EquipmentType, Difficulty, AthleteConstraints } from "@gymapp/types";
import { isExerciseAllowed } from "./constraints";

/**
 * Input for finding exercise substitutes
 */
export interface SubstitutionInput {
  /** The exercise to find substitutes for */
  exercise: Exercise;
  /** All available exercises to choose from */
  candidateExercises: Exercise[];
  /** Equipment the user has access to */
  availableEquipment?: EquipmentType[];
  /** Maximum difficulty level to consider */
  maxDifficulty?: Difficulty;
  /** Exercises to exclude (e.g., already in workout) */
  excludeExerciseIds?: string[];
  /** User constraints (e.g., injuries) */
  constraints?: string[];
  /** Athlete capability profile — drops candidates the athlete can't safely perform */
  athleteConstraints?: AthleteConstraints;
}

/**
 * A scored substitute exercise
 */
export interface ScoredSubstitute {
  exercise: Exercise;
  score: number;
  matchReasons: string[];
}

/**
 * Configuration for substitution scoring
 */
export interface SubstitutionConfig {
  /** Weight for movement pattern match (0-1) */
  movementPatternWeight: number;
  /** Weight for primary muscle overlap (0-1) */
  primaryMuscleWeight: number;
  /** Weight for secondary muscle overlap (0-1) */
  secondaryMuscleWeight: number;
  /** Weight for compound/isolation match (0-1) */
  compoundMatchWeight: number;
  /** Weight for difficulty match (0-1) */
  difficultyWeight: number;
  /** Weight for equipment overlap (0-1) */
  equipmentWeight: number;
}

const defaultConfig: SubstitutionConfig = {
  movementPatternWeight: 0.35,
  primaryMuscleWeight: 0.25,
  secondaryMuscleWeight: 0.10,
  compoundMatchWeight: 0.10,
  difficultyWeight: 0.10,
  equipmentWeight: 0.10,
};

const difficultyOrder: Difficulty[] = ["beginner", "intermediate", "advanced"];

/**
 * Calculate similarity score between two arrays (Jaccard index)
 */
function arrayOverlap<T>(a: T[], b: T[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...a, ...b]).size;

  return intersection / union;
}

/**
 * Check if candidate equipment can satisfy exercise requirements
 * given available equipment
 */
function canUseWithEquipment(
  exerciseEquipment: EquipmentType[],
  availableEquipment: EquipmentType[]
): boolean {
  // At least one piece of equipment must be available
  return exerciseEquipment.some(eq => availableEquipment.includes(eq));
}

/**
 * Check if difficulty is at or below max
 */
function isDifficultyAllowed(
  exerciseDifficulty: Difficulty,
  maxDifficulty: Difficulty
): boolean {
  const exerciseIndex = difficultyOrder.indexOf(exerciseDifficulty);
  const maxIndex = difficultyOrder.indexOf(maxDifficulty);
  return exerciseIndex <= maxIndex;
}

/**
 * Check if exercise matches any user constraints
 */
function hasConstraintConflict(
  exerciseConstraints: string[],
  userConstraints: string[]
): boolean {
  return exerciseConstraints.some(c => userConstraints.includes(c));
}

/**
 * Calculate similarity score between two exercises
 */
function calculateSimilarityScore(
  source: Exercise,
  candidate: Exercise,
  config: SubstitutionConfig
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Movement pattern overlap
  const patternOverlap = arrayOverlap(
    source.movementPatterns as MovementPattern[],
    candidate.movementPatterns as MovementPattern[]
  );
  score += patternOverlap * config.movementPatternWeight;
  if (patternOverlap > 0) {
    const sharedPatterns = source.movementPatterns.filter(p =>
      candidate.movementPatterns.includes(p)
    );
    reasons.push(`Same movement pattern: ${sharedPatterns.join(", ")}`);
  }

  // Primary muscle overlap
  const primaryOverlap = arrayOverlap(
    source.primaryMuscles as MuscleGroup[],
    candidate.primaryMuscles as MuscleGroup[]
  );
  score += primaryOverlap * config.primaryMuscleWeight;
  if (primaryOverlap > 0) {
    const sharedMuscles = source.primaryMuscles.filter(m =>
      candidate.primaryMuscles.includes(m)
    );
    reasons.push(`Targets same primary muscles: ${sharedMuscles.join(", ")}`);
  }

  // Secondary muscle overlap
  const secondaryOverlap = arrayOverlap(
    source.secondaryMuscles as MuscleGroup[],
    candidate.secondaryMuscles as MuscleGroup[]
  );
  score += secondaryOverlap * config.secondaryMuscleWeight;

  // Compound/isolation match
  const compoundMatch = source.isCompound === candidate.isCompound ? 1 : 0;
  score += compoundMatch * config.compoundMatchWeight;
  if (compoundMatch) {
    reasons.push(source.isCompound ? "Both are compound exercises" : "Both are isolation exercises");
  }

  // Difficulty match (prefer same or easier)
  const sourceDiffIndex = difficultyOrder.indexOf(source.difficulty);
  const candidateDiffIndex = difficultyOrder.indexOf(candidate.difficulty);
  const difficultyDelta = Math.abs(sourceDiffIndex - candidateDiffIndex);
  const difficultyScore = difficultyDelta === 0 ? 1 : difficultyDelta === 1 ? 0.5 : 0;
  score += difficultyScore * config.difficultyWeight;
  if (source.difficulty === candidate.difficulty) {
    reasons.push(`Same difficulty level: ${source.difficulty}`);
  }

  // Equipment overlap
  const equipmentOverlap = arrayOverlap(
    source.equipment as EquipmentType[],
    candidate.equipment as EquipmentType[]
  );
  score += equipmentOverlap * config.equipmentWeight;
  if (equipmentOverlap > 0) {
    const sharedEquipment = source.equipment.filter(e =>
      candidate.equipment.includes(e)
    );
    reasons.push(`Uses similar equipment: ${sharedEquipment.join(", ")}`);
  }

  return { score, reasons };
}

/**
 * Find suitable substitutes for an exercise
 *
 * This is a pure function - no side effects, no DB calls.
 * All data is passed in and results are returned.
 */
export function findSubstitutes(
  input: SubstitutionInput,
  config: SubstitutionConfig = defaultConfig
): ScoredSubstitute[] {
  const {
    exercise,
    candidateExercises,
    availableEquipment,
    maxDifficulty = "advanced",
    excludeExerciseIds = [],
    constraints = [],
    athleteConstraints,
  } = input;

  const scoredCandidates: ScoredSubstitute[] = [];

  for (const candidate of candidateExercises) {
    // Skip the source exercise itself
    if (candidate.id === exercise.id) continue;

    // Skip excluded exercises
    if (excludeExerciseIds.includes(candidate.id)) continue;

    // Filter by available equipment if specified
    if (availableEquipment && availableEquipment.length > 0) {
      if (!canUseWithEquipment(candidate.equipment as EquipmentType[], availableEquipment)) {
        continue;
      }
    }

    // Filter by difficulty
    if (!isDifficultyAllowed(candidate.difficulty, maxDifficulty)) {
      continue;
    }

    // Filter by user constraints (apparatus the exercise requires)
    if (constraints.length > 0 && hasConstraintConflict(candidate.constraints ?? [], constraints)) {
      continue;
    }

    // Filter by athlete capability profile (injuries/mobility/equipment/banned)
    if (athleteConstraints && !isExerciseAllowed(candidate, athleteConstraints).allowed) {
      continue;
    }

    // Calculate similarity score
    const { score, reasons } = calculateSimilarityScore(exercise, candidate, config);

    // Only include if there's meaningful similarity
    if (score > 0.1) {
      scoredCandidates.push({
        exercise: candidate,
        score,
        matchReasons: reasons,
      });
    }
  }

  // Sort by score descending
  return scoredCandidates.sort((a, b) => b.score - a.score);
}

/**
 * Get the top N substitutes for an exercise
 */
export function getTopSubstitutes(
  input: SubstitutionInput,
  limit: number = 5,
  config: SubstitutionConfig = defaultConfig
): ScoredSubstitute[] {
  return findSubstitutes(input, config).slice(0, limit);
}

/**
 * Check if a specific exercise is a valid substitute
 */
export function isValidSubstitute(
  source: Exercise,
  candidate: Exercise,
  availableEquipment?: EquipmentType[],
  maxDifficulty: Difficulty = "advanced",
  constraints: string[] = [],
  minScore: number = 0.3,
  config: SubstitutionConfig = defaultConfig
): boolean {
  // Same exercise is not a valid substitute
  if (source.id === candidate.id) return false;

  // Check equipment constraint
  if (availableEquipment && availableEquipment.length > 0) {
    if (!canUseWithEquipment(candidate.equipment as EquipmentType[], availableEquipment)) {
      return false;
    }
  }

  // Check difficulty constraint
  if (!isDifficultyAllowed(candidate.difficulty, maxDifficulty)) {
    return false;
  }

  // Check user constraints
  if (constraints.length > 0 && hasConstraintConflict(candidate.constraints ?? [], constraints)) {
    return false;
  }

  // Calculate similarity score
  const { score } = calculateSimilarityScore(source, candidate, config);

  return score >= minScore;
}
