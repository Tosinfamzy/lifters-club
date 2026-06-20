/**
 * Decision accuracy service
 *
 * Reads a user's decision outcomes from the database and aggregates them into
 * a `DecisionAccuracyStats` summary. This is the one place that turns persisted
 * outcomes into the shape the engine's `getProgressionModifier` consumes, so
 * both the `/accuracy` route and the self-tuning decision paths share it.
 *
 * The DB read lives here; the engine never touches the database.
 */

import { db } from "@gymapp/db";
import { decisions, decisionOutcomes } from "@gymapp/db/schema";
import { eq } from "drizzle-orm";
import type { DecisionAccuracyStats, OverrideReason, DecisionType } from "@gymapp/types";

/**
 * Aggregate a user's decision outcomes into accuracy statistics.
 *
 * @param userId - The internal user id (matches `decisionOutcomes.userId`)
 * @returns Per-user and per-type accuracy stats
 */
export async function getDecisionAccuracyStats(
  userId: string
): Promise<DecisionAccuracyStats> {
  // Get all outcomes for this user
  const outcomes = await db
    .select({
      outcome: decisionOutcomes.outcome,
      success: decisionOutcomes.success,
      overrideReason: decisionOutcomes.overrideReason,
      decisionType: decisions.type,
    })
    .from(decisionOutcomes)
    .innerJoin(decisions, eq(decisionOutcomes.decisionId, decisions.id))
    .where(eq(decisionOutcomes.userId, userId));

  // Calculate stats
  const totalDecisions = outcomes.length;
  const followed = outcomes.filter((o) => o.outcome === "followed").length;
  const overridden = outcomes.filter((o) => o.outcome === "overridden").length;
  const ignored = outcomes.filter((o) => o.outcome === "ignored").length;

  // Success rate of followed decisions that have been evaluated
  const evaluatedFollowed = outcomes.filter(
    (o) => o.outcome === "followed" && o.success !== null
  );
  const successfulFollowed = evaluatedFollowed.filter((o) => o.success === true).length;
  const successRate =
    evaluatedFollowed.length > 0 ? successfulFollowed / evaluatedFollowed.length : 0;

  // Count override reasons
  const overrideReasons: Partial<Record<OverrideReason, number>> = {};
  for (const o of outcomes) {
    if (o.overrideReason) {
      const reason = o.overrideReason as OverrideReason;
      overrideReasons[reason] = (overrideReasons[reason] || 0) + 1;
    }
  }

  // Stats by decision type
  const byType: DecisionAccuracyStats["byType"] = {};
  const typeGroups = new Map<string, typeof outcomes>();
  for (const o of outcomes) {
    const existing = typeGroups.get(o.decisionType) || [];
    existing.push(o);
    typeGroups.set(o.decisionType, existing);
  }

  for (const [type, typeOutcomes] of typeGroups) {
    const typeFollowed = typeOutcomes.filter((o) => o.outcome === "followed");
    const typeEvaluated = typeFollowed.filter((o) => o.success !== null);
    const typeSuccessful = typeEvaluated.filter((o) => o.success === true).length;

    byType[type as DecisionType] = {
      total: typeOutcomes.length,
      followed: typeFollowed.length,
      successRate: typeEvaluated.length > 0 ? typeSuccessful / typeEvaluated.length : 0,
    };
  }

  return {
    userId,
    totalDecisions,
    followed,
    overridden,
    ignored,
    successRate,
    overrideReasons,
    byType,
  };
}
