import type { ExerciseProgress } from "./workout.types";

/** Request body for `POST /api/decisions/within-session` (sans persistence ids). */
export interface WithinSessionRequest {
  exerciseId: string;
  completedSet: { weight: number; reps: number; rpe?: number };
  targetRepRange: [number, number];
  plannedWeight: number;
  remainingSets: number;
}

/**
 * Build the within-session engine input from the set just completed.
 *
 * Pure + null-safe so it can be unit-tested without rendering: returns null when
 * the set lacks usable weight/reps. `plannedWeight` is derived (the client has no
 * explicit per-exercise target weight): prefer last session's working weight,
 * else the first completed set this session, else the weight just done — this is
 * what gates the engine's mid-session-PR flag (`weight > plannedWeight`).
 *
 * @param exercise - The exercise AFTER the set at `setIndex` is marked completed.
 * @param setIndex - Index of the set that was just completed.
 */
export function buildWithinSessionInput(
  exercise: ExerciseProgress,
  setIndex: number
): WithinSessionRequest | null {
  const set = exercise.sets[setIndex];
  if (!set || !set.weight || !set.reps) return null;

  const weight = parseFloat(set.weight);
  const reps = parseInt(set.reps, 10);
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null;

  const rpe = set.rpe ? parseFloat(set.rpe) : undefined;

  const firstCompleted = exercise.sets.find((s) => s.completed && s.weight);
  const plannedWeight =
    exercise.lastPerformance?.weight ??
    (firstCompleted ? parseFloat(firstCompleted.weight) : weight);

  const remainingSets = exercise.sets.filter((s, i) => i > setIndex && !s.completed).length;

  return {
    exerciseId: exercise.exerciseId,
    completedSet: { weight, reps, rpe: Number.isFinite(rpe as number) ? rpe : undefined },
    targetRepRange: exercise.repRange,
    plannedWeight,
    remainingSets,
  };
}
