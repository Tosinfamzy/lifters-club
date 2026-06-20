/**
 * Week Generation Service
 *
 * Generates the next week's workouts for a training block by:
 * 1. Gathering exercise performance data from recent logged sets
 * 2. Calling the decision engine's generateWeeklyPlan()
 * 3. Creating workout records with adjusted weights/volumes
 * 4. Persisting all decisions for transparency
 */

import { db } from "@gymapp/db";
import {
  trainingBlocks,
  workouts,
  programs,
  decisions,
  workoutLogs,
  loggedSets,
  userBaselines,
  exercises,
} from "@gymapp/db/schema";
import { eq, and, desc, gte, inArray, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  generateWeeklyPlan,
  calculatePerformanceTrend,
  getTopSubstitutes,
  isExerciseAllowed,
  type WeeklyPlanInput,
  type ExercisePerformance,
} from "@gymapp/engine";
import type {
  DecisionType,
  Exercise,
  PermanentSubstitution,
  EquipmentType,
  MovementPattern,
} from "@gymapp/types";
import { logger as globalLogger } from "../lib/logger";
import { MS_PER_WEEK } from "../constants";
import {
  loadAthleteConstraintsForUserId,
  loadPermanentSubstitutionsForUserId,
  mapToExercise,
} from "../lib/athlete-profile";

/** Max candidate exercises to pull for constraint substitution. Mirrors the
 * substitutes route's pre-filter cap. */
const CANDIDATE_POOL_LIMIT = 200;
/** How many constraint-filtered substitutes to expose for rotation. */
const AVAILABLE_SUBSTITUTES_LIMIT = 5;

interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repRange: [number, number];
  restSeconds: number;
  notes?: string;
}

interface ProgramSession {
  dayNumber: number;
  name: string;
  focus: string[];
  exercises: PlannedExercise[];
}

interface ProgramTemplate {
  weeks: number;
  sessions: ProgramSession[];
}

interface GenerateWeekResult {
  workouts: typeof workouts.$inferSelect[];
  decisions: typeof decisions.$inferSelect[];
  weekNumber: number;
  isDeloadWeek: boolean;
  summary: string;
}

interface GenerateWeekOptions {
  forceDeload?: boolean;
}

/**
 * Generate the next week's workouts for a training block
 *
 * @param trainingBlockId - The training block to generate workouts for
 * @param userId - The user who owns the training block
 * @param options - Optional settings like forceDeload
 */
export async function generateNextWeek(
  trainingBlockId: string,
  userId: string,
  options: GenerateWeekOptions = {}
): Promise<GenerateWeekResult> {
  // 1. Fetch training block with program
  const blockResult = await db
    .select({
      block: trainingBlocks,
      program: programs,
    })
    .from(trainingBlocks)
    .innerJoin(programs, eq(trainingBlocks.programId, programs.id))
    .where(
      and(
        eq(trainingBlocks.id, trainingBlockId),
        eq(trainingBlocks.userId, userId)
      )
    )
    .limit(1);

  if (blockResult.length === 0) {
    throw new Error("Training block not found or access denied");
  }

  const { block, program } = blockResult[0]!;

  if (block.status !== "active") {
    throw new Error("Training block is not active");
  }

  const template = program.template as unknown as ProgramTemplate;
  const nextWeek = block.currentWeek + 1;

  // Check if we've exceeded the program duration
  if (nextWeek > template.weeks) {
    throw new Error(
      `Program only has ${template.weeks} weeks. Consider completing or extending the training block.`
    );
  }

  // 2. Check if workouts already exist for this week
  const existingWorkouts = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(
      and(
        eq(workouts.trainingBlockId, trainingBlockId),
        eq(workouts.weekNumber, nextWeek)
      )
    )
    .limit(1);

  if (existingWorkouts.length > 0) {
    throw new Error(`Workouts already exist for week ${nextWeek}`);
  }

  // 3. Gather exercise performance data
  const exercisePerformance = await gatherExercisePerformance(
    userId,
    template.sessions
  );

  // 4. Calculate weekly metrics
  const weeklyMetrics = await calculateWeeklyMetrics(userId, trainingBlockId);

  // 5. Build input for the planning engine
  const planInput: WeeklyPlanInput = {
    userId,
    weekNumber: block.currentWeek,
    totalWeeks: template.weeks,
    exercises: exercisePerformance,
    recentWeeklyRpe: weeklyMetrics.recentWeeklyRpe,
    missedSessions: weeklyMetrics.missedSessions,
    consecutiveHardWeeks: weeklyMetrics.consecutiveHardWeeks,
    userRequestedDeload: options.forceDeload,
  };

  // 6. Generate the weekly plan
  const weeklyPlan = generateWeeklyPlan(planInput);

  globalLogger.info(
    {
      trainingBlockId,
      userId,
      weekNumber: nextWeek,
      isDeload: weeklyPlan.isDeloadWeek,
      changes: weeklyPlan.changes.length,
    },
    "Generated weekly plan"
  );

  // 7. Create workout records with adjusted exercises
  const startDate = new Date(block.startDate);
  // Calculate the start of the new week (week 1 starts at startDate)
  const weekStartDate = new Date(startDate);
  weekStartDate.setDate(weekStartDate.getDate() + (nextWeek - 1) * 7);

  // Create a map for quick lookup of exercise updates
  const updateMap = new Map(
    weeklyPlan.exerciseUpdates.map((u) => [u.exerciseId, u])
  );

  const workoutsToCreate = template.sessions.map((session) => {
    const workoutDate = new Date(weekStartDate);
    workoutDate.setDate(workoutDate.getDate() + session.dayNumber - 1);

    // Apply exercise updates to each planned exercise. Constraint-omitted
    // exercises are dropped entirely so the built workout never schedules an
    // unsafe movement.
    const adjustedExercises = session.exercises
      .filter((exercise) => !updateMap.get(exercise.exerciseId)?.omitted)
      .map((exercise) => {
        const update = updateMap.get(exercise.exerciseId);
        if (update) {
          return {
            exerciseId: update.newExerciseId ?? exercise.exerciseId,
            sets: update.sets,
            repRange: update.repRange,
            restSeconds: exercise.restSeconds,
            notes: exercise.notes,
          };
        }
        // No update available, use original values
        return exercise;
      });

    return {
      id: `${trainingBlockId}-w${nextWeek}-d${session.dayNumber}`,
      trainingBlockId,
      scheduledDate: workoutDate.toISOString().split("T")[0]!,
      weekNumber: nextWeek,
      dayNumber: session.dayNumber,
      plannedExercises: adjustedExercises as unknown as Record<string, unknown>[],
      status: "pending" as const,
    };
  });

  // 8. Persist decisions for each exercise update
  const decisionsToCreate = weeklyPlan.exerciseUpdates.flatMap((update) => {
    const decisionRecords: {
      id: string;
      userId: string;
      workoutId: string | null;
      type: string;
      input: Record<string, unknown>;
      output: Record<string, unknown>;
      reasoning: string;
      algorithmVersion: string;
    }[] = [];

    // Find the workout that contains this exercise
    const workoutForExercise = workoutsToCreate.find((w) =>
      (w.plannedExercises as unknown as PlannedExercise[]).some(
        (e) => e.exerciseId === (update.newExerciseId ?? update.exerciseId)
      )
    );

    // Load decision
    if (update.decisions.load) {
      decisionRecords.push({
        id: `dec_${nanoid(12)}`,
        userId,
        workoutId: workoutForExercise?.id ?? null,
        type: "load_progression" as DecisionType,
        input: {
          exerciseId: update.exerciseId,
          weekNumber: nextWeek,
        },
        output: {
          action: update.decisions.load.action,
          newWeight: update.decisions.load.newWeight,
        },
        reasoning: update.decisions.load.reason,
        algorithmVersion: "1.0.0",
      });
    }

    // Volume decision
    if (update.decisions.volume) {
      decisionRecords.push({
        id: `dec_${nanoid(12)}`,
        userId,
        workoutId: workoutForExercise?.id ?? null,
        type: "volume_adjustment" as DecisionType,
        input: {
          exerciseId: update.exerciseId,
          weekNumber: nextWeek,
        },
        output: {
          action: update.decisions.volume.action,
          newSetCount: update.decisions.volume.newSetCount,
        },
        reasoning: update.decisions.volume.reason,
        algorithmVersion: "1.0.0",
      });
    }

    // Rotation decision. Only persist for genuine rotation swaps — constraint
    // substitutions are surfaced via plan changes[] + structured logs, not
    // formal decision rows (no new DecisionType).
    if (
      update.decisions.rotation &&
      update.newExerciseId &&
      update.substitutionSource === "rotation"
    ) {
      decisionRecords.push({
        id: `dec_${nanoid(12)}`,
        userId,
        workoutId: workoutForExercise?.id ?? null,
        type: "exercise_rotation" as DecisionType,
        input: {
          exerciseId: update.exerciseId,
          weekNumber: nextWeek,
        },
        output: {
          action: update.decisions.rotation.action,
          newExerciseId: update.newExerciseId,
        },
        reasoning: update.decisions.rotation.reason,
        algorithmVersion: "1.0.0",
      });
    }

    return decisionRecords;
  });

  // Add deload decision if applicable
  if (weeklyPlan.isDeloadWeek) {
    decisionsToCreate.push({
      id: `dec_${nanoid(12)}`,
      userId,
      workoutId: null,
      type: "deload_recommendation" as DecisionType,
      input: {
        weekNumber: nextWeek,
        recentWeeklyRpe: planInput.recentWeeklyRpe,
        consecutiveHardWeeks: planInput.consecutiveHardWeeks,
        userRequested: options.forceDeload ?? false,
      },
      output: {
        recommended: true,
      },
      reasoning: weeklyPlan.deloadDecision.reason,
      algorithmVersion: "1.0.0",
    });
  }

  // 9. Insert all records in the database within a transaction
  // Use optimistic locking to prevent race conditions
  const expectedCurrentWeek = block.currentWeek;

  const { createdWorkouts, createdDecisions } = await db.transaction(
    async (tx) => {
      // 10. Update the training block's current week with optimistic lock
      // Only update if currentWeek hasn't changed since we read it
      const updateResult = await tx
        .update(trainingBlocks)
        .set({ currentWeek: nextWeek, updatedAt: new Date() })
        .where(
          and(
            eq(trainingBlocks.id, trainingBlockId),
            eq(trainingBlocks.currentWeek, expectedCurrentWeek)
          )
        )
        .returning({ id: trainingBlocks.id });

      // Check if update succeeded (row was affected)
      if (updateResult.length === 0) {
        throw new Error(
          "Week generation conflict - another request may have already generated this week. Please refresh and try again."
        );
      }

      const insertedWorkouts =
        workoutsToCreate.length > 0
          ? await tx.insert(workouts).values(workoutsToCreate).returning()
          : [];

      const insertedDecisions =
        decisionsToCreate.length > 0
          ? await tx.insert(decisions).values(decisionsToCreate).returning()
          : [];

      return {
        createdWorkouts: insertedWorkouts,
        createdDecisions: insertedDecisions,
      };
    }
  );

  globalLogger.info(
    {
      trainingBlockId,
      userId,
      weekNumber: nextWeek,
      workoutsCreated: createdWorkouts.length,
      decisionsCreated: createdDecisions.length,
    },
    "Week generation complete"
  );

  return {
    workouts: createdWorkouts,
    decisions: createdDecisions,
    weekNumber: nextWeek,
    isDeloadWeek: weeklyPlan.isDeloadWeek,
    summary: weeklyPlan.summary,
  };
}

/**
 * Gather performance data for all exercises in the program
 */
async function gatherExercisePerformance(
  userId: string,
  sessions: ProgramSession[]
): Promise<ExercisePerformance[]> {
  // Collect all unique exercise IDs from the program template
  const exerciseIds = new Set<string>();
  const exerciseDefaults = new Map<
    string,
    { sets: number; repRange: [number, number] }
  >();

  for (const session of sessions) {
    for (const exercise of session.exercises) {
      exerciseIds.add(exercise.exerciseId);
      exerciseDefaults.set(exercise.exerciseId, {
        sets: exercise.sets,
        repRange: exercise.repRange,
      });
    }
  }

  if (exerciseIds.size === 0) {
    return [];
  }

  // Fetch user baselines for these exercises
  const baselines = await db
    .select()
    .from(userBaselines)
    .where(
      and(
        eq(userBaselines.userId, userId),
        inArray(userBaselines.exerciseId, Array.from(exerciseIds))
      )
    );

  // Create baseline lookup map
  const baselineMap = new Map(
    baselines.map((b) => [b.exerciseId, b.baselineWeight])
  );

  // Get recent logged sets for these exercises (last 4 weeks / ~30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentSets = await db
    .select({
      set: loggedSets,
      log: workoutLogs,
    })
    .from(loggedSets)
    .innerJoin(workoutLogs, eq(loggedSets.workoutLogId, workoutLogs.id))
    .where(
      and(
        eq(workoutLogs.userId, userId),
        inArray(loggedSets.exerciseId, Array.from(exerciseIds)),
        gte(workoutLogs.startedAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(workoutLogs.startedAt), loggedSets.setNumber);

  // Group sets by exercise
  const setsByExercise = new Map<
    string,
    { set: typeof loggedSets.$inferSelect; log: typeof workoutLogs.$inferSelect }[]
  >();

  for (const row of recentSets) {
    const existing = setsByExercise.get(row.set.exerciseId) ?? [];
    existing.push(row);
    setsByExercise.set(row.set.exerciseId, existing);
  }

  // Build performance data for each exercise
  const performanceData: ExercisePerformance[] = [];

  for (const exerciseId of exerciseIds) {
    const defaults = exerciseDefaults.get(exerciseId)!;
    const sets = setsByExercise.get(exerciseId) ?? [];
    const baselineWeight = baselineMap.get(exerciseId) ?? 0;

    if (sets.length === 0) {
      // No history, use baseline weight if available
      performanceData.push({
        exerciseId,
        currentWeight: baselineWeight,
        currentSets: defaults.sets,
        targetRepRange: defaults.repRange,
        weeksOnExercise: 0,
        recentSets: [],
        recentPerformance: [],
        performanceTrend: "stagnant",
        availableSubstitutes: [],
      });
      continue;
    }

    // Calculate metrics from logged sets
    const recentSetData = sets.slice(0, 15).map((s) => ({
      reps: s.set.reps,
      rpe: s.set.rpe ?? undefined,
      weight: s.set.weight,
    }));

    // Group sets by workout session to calculate session performance
    const sessionGroups = new Map<
      string,
      { sets: typeof sets; date: Date }
    >();
    for (const s of sets) {
      const logId = s.log.id;
      const existing = sessionGroups.get(logId);
      if (existing) {
        existing.sets.push(s);
      } else {
        sessionGroups.set(logId, { sets: [s], date: s.log.startedAt });
      }
    }

    // Calculate performance per session
    const sessionPerf = Array.from(sessionGroups.values())
      .slice(0, 4)
      .map((session) => {
        const sessionSets = session.sets;
        const avgRpe =
          sessionSets.reduce((sum, s) => sum + (s.set.rpe ?? 7), 0) /
          sessionSets.length;
        return {
          completedSets: sessionSets.length,
          targetSets: defaults.sets,
          avgRpe,
        };
      });

    // Calculate performance trend from recent weights and reps
    const recentWeights = recentSetData.slice(0, 6).map((s) => s.weight);
    const recentReps = recentSetData.slice(0, 6).map((s) => s.reps);
    const trend = calculatePerformanceTrend(recentWeights, recentReps);

    // Estimate weeks on this exercise (based on unique workout dates)
    const uniqueDates = new Set(
      sets.map((s) => s.log.startedAt.toISOString().split("T")[0])
    );
    const weeksOnExercise = Math.ceil(uniqueDates.size / 2); // Assume ~2 sessions per week

    // Get most recent weight as current weight
    const currentWeight = sets[0]?.set.weight ?? 0;

    performanceData.push({
      exerciseId,
      currentWeight,
      currentSets: defaults.sets,
      targetRepRange: defaults.repRange,
      weeksOnExercise,
      recentSets: recentSetData,
      recentPerformance: sessionPerf,
      performanceTrend: trend,
      availableSubstitutes: [],
    });
  }

  // Resolve each exercise against the athlete's constraint profile + persisted
  // swaps. When the athlete has neither, this is a no-op fast path that avoids
  // the library query and leaves performanceData byte-identical to before.
  await applyConstraintResolution(userId, performanceData);

  return performanceData;
}

/**
 * Resolve every planned exercise against the athlete's constraint profile and
 * persisted swaps, mutating each `ExercisePerformance` in place with a
 * `constraintDecision`, equipment/movement metadata, and a constraint-filtered
 * `availableSubstitutes` pool (which fixes the previously-dead rotation path).
 *
 * Fast path: if the athlete has no constraints and no permanent subs, returns
 * immediately without touching the exercise library — preserving exact parity
 * (and performance) for unconstrained users.
 */
async function applyConstraintResolution(
  userId: string,
  performanceData: ExercisePerformance[]
): Promise<void> {
  if (performanceData.length === 0) return;

  const constraints = await loadAthleteConstraintsForUserId(userId);
  const permanentSubs = await loadPermanentSubstitutionsForUserId(userId);

  // Fast path: nothing to enforce → leave output exactly as today.
  if (!constraints && !permanentSubs) return;

  const plannedIds = performanceData.map((p) => p.exerciseId);

  // Fetch metadata for the planned exercises themselves.
  const plannedRows = await db
    .select()
    .from(exercises)
    .where(inArray(exercises.id, plannedIds));
  const metadataById = new Map<string, Exercise>(
    plannedRows.map((row) => [row.id, mapToExercise(row)])
  );

  // Build a constraint-aware candidate pool, pre-filtered to exercises that
  // overlap a planned exercise's movement patterns or primary muscles. Mirrors
  // the substitutes route's containment pre-filter.
  const candidatePool = await loadCandidatePool(
    Array.from(metadataById.values()),
    permanentSubs
  );

  for (const perf of performanceData) {
    const exercise = metadataById.get(perf.exerciseId);

    // Missing metadata: we can't reason about safety, so allow and warn rather
    // than silently dropping the exercise.
    if (!exercise) {
      perf.constraintDecision = { action: "allow" };
      globalLogger.warn(
        { userId, exerciseId: perf.exerciseId },
        "Constraint resolution skipped: exercise metadata not found"
      );
      continue;
    }

    perf.equipment = exercise.equipment as EquipmentType[];
    perf.movementPatterns = exercise.movementPatterns as MovementPattern[];

    const allowed = constraints
      ? isExerciseAllowed(exercise, constraints)
      : { allowed: true as const };

    if (allowed.allowed) {
      // Populate a constraint-filtered substitute pool so rotation can only
      // rotate into exercises the athlete can safely perform.
      const subs = getTopSubstitutes(
        {
          exercise,
          candidateExercises: candidatePool,
          athleteConstraints: constraints,
          permanentSubstitutions: permanentSubs,
        },
        AVAILABLE_SUBSTITUTES_LIMIT
      );
      perf.availableSubstitutes = subs.map((s) => s.exercise.id);
      perf.constraintDecision = { action: "allow" };
      continue;
    }

    // Blocked: try to resolve a safe substitute (permanent-sub-first, then
    // constraint-filtered ranking — both handled inside the engine).
    const subs = getTopSubstitutes({
      exercise,
      candidateExercises: candidatePool,
      athleteConstraints: constraints,
      permanentSubstitutions: permanentSubs,
    });

    const best = subs[0];
    if (best) {
      const reason = `${allowed.reason}; substituted with ${best.exercise.id} (${best.matchReasons[0] ?? "best match"})`;
      perf.constraintDecision = {
        action: "substitute",
        substituteExerciseId: best.exercise.id,
        isPermanent: best.isPermanent ?? false,
        reason,
      };
      globalLogger.info(
        {
          userId,
          originalExerciseId: perf.exerciseId,
          action: "substitute",
          substituteExerciseId: best.exercise.id,
          isPermanent: best.isPermanent ?? false,
          reason,
        },
        "Constraint substitution resolved"
      );
    } else {
      const reason = allowed.reason ?? "Blocked by constraint profile";
      perf.constraintDecision = { action: "omit", reason };
      globalLogger.info(
        {
          userId,
          originalExerciseId: perf.exerciseId,
          action: "omit",
          reason,
        },
        "Constraint omission resolved"
      );
    }
  }
}

/**
 * Build a candidate exercise pool for constraint substitution. Pre-filters the
 * library to exercises overlapping any planned exercise's movement patterns or
 * primary muscles (the same containment strategy the substitutes route uses),
 * then tops up with any permanent-substitute targets that the pre-filter missed
 * so the engine's permanent-sub short-circuit can honor them.
 */
async function loadCandidatePool(
  plannedExercises: Exercise[],
  permanentSubs: PermanentSubstitution[] | undefined
): Promise<Exercise[]> {
  const movementPatterns = new Set<string>();
  const primaryMuscles = new Set<string>();
  for (const exercise of plannedExercises) {
    exercise.movementPatterns.forEach((p) => movementPatterns.add(p));
    exercise.primaryMuscles.forEach((m) => primaryMuscles.add(m));
  }

  const conditions = [
    ...Array.from(movementPatterns).map(
      (pattern) => sql`${exercises.movementPatterns} @> ${JSON.stringify([pattern])}`
    ),
    ...Array.from(primaryMuscles).map(
      (muscle) => sql`${exercises.primaryMuscles} @> ${JSON.stringify([muscle])}`
    ),
  ];

  const rows =
    conditions.length > 0
      ? await db
          .select()
          .from(exercises)
          .where(or(...conditions))
          .limit(CANDIDATE_POOL_LIMIT)
      : [];

  const pool = rows.map(mapToExercise);
  const present = new Set(pool.map((e) => e.id));

  // Candidate-presence top-up: a permanent substitute may not overlap any
  // planned exercise's movement/muscle profile, so fetch any missing targets.
  const missingSubIds = (permanentSubs ?? [])
    .map((sub) => sub.substituteExerciseId)
    .filter((id) => !present.has(id));

  if (missingSubIds.length > 0) {
    const extraRows = await db
      .select()
      .from(exercises)
      .where(inArray(exercises.id, missingSubIds));
    for (const row of extraRows) {
      if (!present.has(row.id)) {
        pool.push(mapToExercise(row));
        present.add(row.id);
      }
    }
  }

  return pool;
}

/**
 * Calculate weekly metrics for deload and recovery decisions
 */
async function calculateWeeklyMetrics(
  userId: string,
  trainingBlockId: string
): Promise<{
  recentWeeklyRpe: number[];
  missedSessions: number;
  consecutiveHardWeeks: number;
}> {
  // Get recent workout logs for RPE data
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const recentLogs = await db
    .select()
    .from(workoutLogs)
    .where(
      and(eq(workoutLogs.userId, userId), gte(workoutLogs.startedAt, fourWeeksAgo))
    )
    .orderBy(desc(workoutLogs.startedAt));

  // Calculate weekly average RPE
  const weeklyRpe: number[] = [];
  const weekBuckets = new Map<number, number[]>();

  for (const log of recentLogs) {
    if (log.overallRpe === null) continue;

    const weekNum = Math.floor(
      (Date.now() - log.startedAt.getTime()) / MS_PER_WEEK
    );
    const bucket = weekBuckets.get(weekNum) ?? [];
    bucket.push(log.overallRpe);
    weekBuckets.set(weekNum, bucket);
  }

  // Average RPE per week (most recent first)
  for (let w = 0; w < 4; w++) {
    const bucket = weekBuckets.get(w);
    if (bucket && bucket.length > 0) {
      const avg = bucket.reduce((sum, v) => sum + v, 0) / bucket.length;
      weeklyRpe.push(avg);
    }
  }

  // Count missed sessions (workouts with status "skipped" in current training block)
  const skippedWorkouts = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(
      and(
        eq(workouts.trainingBlockId, trainingBlockId),
        eq(workouts.status, "skipped")
      )
    );
  const missedSessions = skippedWorkouts.length;

  // Count consecutive hard weeks (RPE > 8)
  let consecutiveHard = 0;
  for (const rpe of weeklyRpe) {
    if (rpe >= 8) {
      consecutiveHard++;
    } else {
      break;
    }
  }

  return {
    recentWeeklyRpe: weeklyRpe.length > 0 ? weeklyRpe : [7], // Default to moderate
    missedSessions,
    consecutiveHardWeeks: consecutiveHard,
  };
}

/**
 * Check if all workouts for a given week are complete
 */
export async function isWeekComplete(
  trainingBlockId: string,
  weekNumber: number
): Promise<boolean> {
  const weekWorkouts = await db
    .select({ status: workouts.status })
    .from(workouts)
    .where(
      and(
        eq(workouts.trainingBlockId, trainingBlockId),
        eq(workouts.weekNumber, weekNumber)
      )
    );

  if (weekWorkouts.length === 0) {
    return false; // No workouts for this week
  }

  return weekWorkouts.every(
    (w) => w.status === "completed" || w.status === "skipped"
  );
}
