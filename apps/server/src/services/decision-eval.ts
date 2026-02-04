/**
 * Decision Evaluation Service
 *
 * Automatically evaluates pending decisions after workout completion
 * by comparing what was recommended to what actually happened.
 */

import { db } from "@gymapp/db";
import { decisions, decisionOutcomes, loggedSets } from "@gymapp/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { evaluateDecision } from "@gymapp/engine";
import type { Decision, LoggedSet } from "@gymapp/types";

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

  // 3. For each pending decision, check if it can be evaluated
  for (const { outcome, decision } of pendingOutcomes) {
    // Check if any of the logged sets are for the exercise in this decision
    const decisionInput = decision.input as { exerciseId?: string };
    if (!decisionInput.exerciseId) {
      continue;
    }

    const relevantSets = setsForEval.filter(
      (s) => s.exerciseId === decisionInput.exerciseId
    );

    if (relevantSets.length === 0) {
      continue; // Exercise not done in this workout
    }

    // Convert decision to type expected by evaluateDecision
    const decisionForEval: Decision = {
      id: decision.id,
      userId: decision.userId,
      workoutId: decision.workoutId ?? undefined,
      type: decision.type as Decision["type"],
      input: decision.input,
      output: decision.output,
      reasoning: decision.reasoning,
      algorithmVersion: decision.algorithmVersion,
      createdAt: decision.createdAt,
    };

    // 4. Determine outcome and success
    const evaluation = evaluateDecision(decisionForEval, relevantSets);

    if (evaluation) {
      // Update the outcome with evaluation results
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
    }
  }
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
