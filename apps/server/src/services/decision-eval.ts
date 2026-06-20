/**
 * Decision Evaluation Service
 *
 * Automatically evaluates pending decisions after workout completion
 * by comparing what was recommended to what actually happened.
 */

import { db } from "@gymapp/db";
import {
  decisions,
  decisionOutcomes,
  loggedSets,
  workoutLogs,
  readinessChecks,
} from "@gymapp/db/schema";
import { eq, and, isNull, isNotNull, desc, lt } from "drizzle-orm";
import { evaluateDecision } from "@gymapp/engine";
import type { EvaluationContext } from "@gymapp/engine";
import type { Decision, DecisionType, LoggedSet } from "@gymapp/types";
import { logger as globalLogger } from "../lib/logger";

/**
 * Decision types whose success is judged against the exercise's logged sets.
 * Everything else (deload, recovery) is judged against session-level context.
 */
const EXERCISE_SCOPED_TYPES = new Set<DecisionType>([
  "load_progression",
  "volume_adjustment",
  "exercise_rotation",
]);

const NON_EXERCISE_SCOPED_TYPES = new Set<DecisionType>([
  "deload_recommendation",
  "session_recovery",
]);

/** Number of prior completed sessions used as the deload RPE baseline. */
const DELOAD_BASELINE_WINDOW = 5;

/**
 * Evaluate all pending decisions for a user after workout completion
 *
 * Called automatically when POST /api/logs/:id/complete is hit.
 * Finds decisions with 'followed' outcome but no success evaluation,
 * then uses the logged sets to determine if the decision was successful.
 *
 * @param userId - The user whose decisions to evaluate
 * @param completedWorkoutLogId - The workout log that was just completed
 */
export async function evaluatePendingDecisions(
  userId: string,
  completedWorkoutLogId: string
): Promise<void> {
  globalLogger.debug({ userId, workoutLogId: completedWorkoutLogId }, "Starting decision evaluation");

  // 1. Get decisions with 'followed' outcome but no success evaluation
  const pendingOutcomes = await db
    .select({
      outcome: decisionOutcomes,
      decision: decisions,
    })
    .from(decisionOutcomes)
    .innerJoin(decisions, eq(decisionOutcomes.decisionId, decisions.id))
    .where(
      and(
        eq(decisionOutcomes.userId, userId),
        eq(decisionOutcomes.outcome, "followed"),
        isNull(decisionOutcomes.success)
      )
    );

  if (pendingOutcomes.length === 0) {
    return; // No pending evaluations
  }

  // 2. Get the sets logged in the completed workout
  const completedSets = await db
    .select()
    .from(loggedSets)
    .where(eq(loggedSets.workoutLogId, completedWorkoutLogId));

  if (completedSets.length === 0) {
    return; // No sets to evaluate against
  }

  // Convert DB sets to LoggedSet type
  const setsForEval: LoggedSet[] = completedSets.map((s) => ({
    id: s.id,
    workoutLogId: s.workoutLogId,
    exerciseId: s.exerciseId,
    setNumber: s.setNumber,
    weight: s.weight,
    reps: s.reps,
    rpe: s.rpe ?? undefined,
    notes: s.notes ?? undefined,
    createdAt: s.createdAt,
  }));

  // 3. Build session-level evaluation context once. Only the non-exercise
  //    decision types read it, so we build it lazily on first need to avoid
  //    extra queries when the batch is entirely exercise-scoped.
  let sessionContext: EvaluationContext | undefined;
  const getSessionContext = async (): Promise<EvaluationContext> => {
    if (sessionContext) return sessionContext;
    sessionContext = await buildSessionContext(
      userId,
      completedWorkoutLogId,
      setsForEval
    );
    return sessionContext;
  };

  // 4. For each pending decision, evaluate by type.
  for (const { outcome, decision } of pendingOutcomes) {
    const decisionType = decision.type as DecisionType;

    const decisionForEval: Decision = {
      id: decision.id,
      userId: decision.userId,
      workoutId: decision.workoutId ?? undefined,
      type: decisionType,
      input: decision.input,
      output: decision.output,
      reasoning: decision.reasoning,
      algorithmVersion: decision.algorithmVersion,
      createdAt: decision.createdAt,
    };

    if (EXERCISE_SCOPED_TYPES.has(decisionType)) {
      // For rotation swaps the relevant exercise is the new one; otherwise it
      // is the decision's input exercise.
      const targetExerciseId = exerciseIdForDecision(decisionForEval);
      if (!targetExerciseId) {
        globalLogger.warn(
          { decisionId: decision.id, userId, type: decisionType },
          "Skipping decision evaluation: missing exerciseId in decision input"
        );
        continue;
      }

      const relevantSets = setsForEval.filter(
        (s) => s.exerciseId === targetExerciseId
      );
      if (relevantSets.length === 0) {
        continue; // Exercise not done in this workout
      }

      const evaluation = evaluateDecision(decisionForEval, relevantSets);
      if (!evaluation) continue;

      // Exercise-scoped: relevantSets is guaranteed non-empty here, so the
      // averages below cannot divide by zero.
      await db
        .update(decisionOutcomes)
        .set({
          success: evaluation.success,
          actualValue: {
            setsCompleted: relevantSets.length,
            avgWeight:
              relevantSets.reduce((sum, s) => sum + s.weight, 0) /
              relevantSets.length,
            avgReps:
              relevantSets.reduce((sum, s) => sum + s.reps, 0) /
              relevantSets.length,
            evaluationReason: evaluation.reason,
          },
          evaluatedAt: new Date(),
        })
        .where(eq(decisionOutcomes.id, outcome.id));

      globalLogger.info(
        { decisionId: decision.id, success: evaluation.success, userId, type: decisionType },
        "Decision evaluated"
      );
    } else if (NON_EXERCISE_SCOPED_TYPES.has(decisionType)) {
      const context = await getSessionContext();
      const evaluation = evaluateDecision(decisionForEval, setsForEval, context);
      if (!evaluation) continue;

      // Type-aware actualValue: session aggregates, never per-exercise averages
      // over a possibly-empty filtered set list (the old divide-by-zero bug).
      await db
        .update(decisionOutcomes)
        .set({
          success: evaluation.success,
          actualValue: {
            sessionOverallRpe: context.sessionOverallRpe ?? null,
            completedSetCount: context.completedSetCount,
            ...(context.readiness
              ? { readinessScore: context.readiness.score }
              : {}),
            evaluationReason: evaluation.reason,
          },
          evaluatedAt: new Date(),
        })
        .where(eq(decisionOutcomes.id, outcome.id));

      globalLogger.info(
        { decisionId: decision.id, success: evaluation.success, userId, type: decisionType },
        "Decision evaluated"
      );
    }
    // Other types (missed_session, weekly_plan_update) remain manual-only.
  }
}

/**
 * Resolve which exercise's logged sets prove out an exercise-scoped decision.
 * Rotation swaps point at the recommended new exercise; everything else uses
 * the decision's input exercise.
 */
function exerciseIdForDecision(decision: Decision): string | undefined {
  const input = decision.input as { exerciseId?: string };
  if (decision.type === "exercise_rotation") {
    const output = decision.output as {
      action?: "keep" | "swap";
      newExerciseId?: string;
    };
    if (output.action === "swap") {
      return output.newExerciseId;
    }
  }
  return input.exerciseId;
}

/**
 * Gather session-level facts the engine needs for non-exercise-scoped
 * decisions. Keeps all DB access here so the engine stays pure.
 *
 * - completedSetCount: sets logged in this session.
 * - sessionOverallRpe: the log's reported overall RPE, falling back to the
 *   average of the session's set RPEs.
 * - recentOverallRpe: overall RPE of the user's recent prior completed sessions
 *   (the deload baseline).
 * - readiness: the readiness check linked to this session, if any.
 */
async function buildSessionContext(
  userId: string,
  workoutLogId: string,
  sets: LoggedSet[]
): Promise<EvaluationContext> {
  const [thisLog] = await db
    .select({ overallRpe: workoutLogs.overallRpe, createdAt: workoutLogs.createdAt })
    .from(workoutLogs)
    .where(eq(workoutLogs.id, workoutLogId))
    .limit(1);

  const setRpes = sets
    .map((s) => s.rpe)
    .filter((r): r is number => r !== undefined);
  const fallbackRpe =
    setRpes.length > 0
      ? setRpes.reduce((sum, r) => sum + r, 0) / setRpes.length
      : undefined;
  const sessionOverallRpe = thisLog?.overallRpe ?? fallbackRpe;

  // Recent prior completed sessions, newest first, for the deload baseline.
  const priorLogs = await db
    .select({ overallRpe: workoutLogs.overallRpe })
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        isNotNull(workoutLogs.completedAt),
        isNotNull(workoutLogs.overallRpe),
        thisLog?.createdAt ? lt(workoutLogs.createdAt, thisLog.createdAt) : undefined
      )
    )
    .orderBy(desc(workoutLogs.createdAt))
    .limit(DELOAD_BASELINE_WINDOW);

  const recentOverallRpe = priorLogs
    .map((l) => l.overallRpe)
    .filter((r): r is number => r !== null);

  const [readiness] = await db
    .select({
      score: readinessChecks.score,
      recommendation: readinessChecks.recommendation,
    })
    .from(readinessChecks)
    .where(eq(readinessChecks.workoutLogId, workoutLogId))
    .limit(1);

  return {
    completedSetCount: sets.length,
    sessionOverallRpe: sessionOverallRpe ?? undefined,
    recentOverallRpe,
    readiness: readiness
      ? { score: readiness.score, recommendation: readiness.recommendation }
      : undefined,
  };
}

/**
 * Get recent evaluation results for a user
 */
export async function getRecentEvaluations(
  userId: string,
  limit: number = 10
): Promise<
  {
    decision: typeof decisions.$inferSelect;
    outcome: typeof decisionOutcomes.$inferSelect;
  }[]
> {
  const results = await db
    .select({
      decision: decisions,
      outcome: decisionOutcomes,
    })
    .from(decisionOutcomes)
    .innerJoin(decisions, eq(decisionOutcomes.decisionId, decisions.id))
    .where(
      and(
        eq(decisionOutcomes.userId, userId),
        eq(decisionOutcomes.outcome, "followed")
      )
    )
    .orderBy(decisionOutcomes.createdAt)
    .limit(limit);

  return results;
}
