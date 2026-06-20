/**
 * Athlete profile loaders
 *
 * Shared data-access helpers for an athlete's constraint profile, persisted
 * exercise swaps, and exercise-row mapping. Extracted from `routes/exercises.ts`
 * so both the substitutes route and the week-generation service resolve
 * constraints from a single source (DRY).
 *
 * Clerk-id variants exist for public/authed HTTP routes (the caller has a
 * `clerkId`); user-id variants exist for internal services (the caller already
 * holds the internal `users.id`).
 */

import { db } from "@gymapp/db";
import {
  exercises,
  users,
  athleteConstraints,
  permanentSubstitutions,
} from "@gymapp/db/schema";
import { eq } from "drizzle-orm";
import type {
  Exercise,
  EquipmentType,
  Difficulty,
  AthleteConstraints,
  PermanentSubstitution,
  SubstitutionReason,
} from "@gymapp/types";

/** Row shape from a `select().from(exercises)`. */
type ExerciseRow = typeof exercises.$inferSelect;

/**
 * Map a raw `exercises` row to the engine `Exercise` type.
 */
export function mapToExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    aliases: (row.aliases ?? []) as string[],
    equipment: row.equipment as EquipmentType[],
    movementPatterns: row.movementPatterns as Exercise["movementPatterns"],
    primaryMuscles: row.primaryMuscles as Exercise["primaryMuscles"],
    secondaryMuscles: (row.secondaryMuscles ?? []) as Exercise["secondaryMuscles"],
    isCompound: row.isCompound,
    isUnilateral: row.isUnilateral,
    difficulty: row.difficulty as Difficulty,
    // CRITICAL: carry grip through or the resolver's grip filtering no-ops.
    grip: (row.grip ?? undefined) as Exercise["grip"],
    constraints: (row.constraints ?? []) as Exercise["constraints"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Load an athlete's constraint profile by internal user id.
 *
 * Returns undefined when no profile is saved so callers can fast-path the
 * unconstrained case.
 */
export async function loadAthleteConstraintsForUserId(
  userId: string
): Promise<AthleteConstraints | undefined> {
  const profile = await db
    .select()
    .from(athleteConstraints)
    .where(eq(athleteConstraints.userId, userId))
    .limit(1);

  if (profile.length === 0) return undefined;

  const row = profile[0]!;
  return {
    equipment: row.equipment as AthleteConstraints["equipment"],
    mobility: row.mobility as AthleteConstraints["mobility"],
    grip: row.grip as AthleteConstraints["grip"],
    injuries: row.injuries as unknown as AthleteConstraints["injuries"],
    bannedExerciseIds: row.bannedExerciseIds,
    correctivePriorityExerciseIds: row.correctivePriorityExerciseIds,
  };
}

/**
 * Load an athlete's constraint profile by Clerk id.
 *
 * The substitutes route is public, so callers may be anonymous (no clerkId).
 * Returns undefined when anonymous or when no profile is saved.
 */
export async function loadAthleteConstraintsForClerkId(
  clerkId: string | undefined
): Promise<AthleteConstraints | undefined> {
  if (!clerkId) return undefined;

  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (user.length === 0) return undefined;

  return loadAthleteConstraintsForUserId(user[0]!.id);
}

/**
 * Load an athlete's persisted exercise swaps by internal user id.
 *
 * Returns undefined when the user has no saved swaps so callers can fast-path.
 */
export async function loadPermanentSubstitutionsForUserId(
  userId: string
): Promise<PermanentSubstitution[] | undefined> {
  const rows = await db
    .select()
    .from(permanentSubstitutions)
    .where(eq(permanentSubstitutions.userId, userId));

  if (rows.length === 0) return undefined;

  return rows.map((row) => ({
    originalExerciseId: row.originalExerciseId,
    substituteExerciseId: row.substituteExerciseId,
    reason: row.reason as SubstitutionReason,
    note: row.note ?? undefined,
    confirmedAt: row.confirmedAt.toISOString(),
    weightCarries: row.weightCarries,
  }));
}

/**
 * Load an athlete's persisted exercise swaps by Clerk id.
 *
 * Like {@link loadAthleteConstraintsForClerkId}, anonymous callers (no clerkId)
 * or users with no saved swaps get undefined.
 */
export async function loadPermanentSubstitutionsForClerkId(
  clerkId: string | undefined
): Promise<PermanentSubstitution[] | undefined> {
  if (!clerkId) return undefined;

  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (user.length === 0) return undefined;

  return loadPermanentSubstitutionsForUserId(user[0]!.id);
}
