import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { db } from "@gymapp/db";
import {
  users,
  workoutLogs,
  loggedSets,
  decisions,
  decisionOutcomes,
  readinessChecks,
} from "@gymapp/db/schema";
import { eq, like } from "drizzle-orm";
import { evaluatePendingDecisions } from "../decision-eval";

const TEST_USER_ID = "test-user-deval-001";
const PREFIX = "deval_";

const testUser = {
  id: TEST_USER_ID,
  clerkId: "test_clerk_deval_12345",
  email: "deval@example.com",
  trainingLevel: "intermediate" as const,
  primaryGoal: "strength" as const,
  preferences: {},
};

interface ActualValue {
  sessionOverallRpe?: number | null;
  completedSetCount?: number;
  readinessScore?: number;
  evaluationReason?: string;
  setsCompleted?: number;
  avgWeight?: number;
  avgReps?: number;
}

async function cleanup() {
  await db.delete(decisionOutcomes).where(like(decisionOutcomes.id, `${PREFIX}%`));
  await db.delete(decisions).where(like(decisions.id, `${PREFIX}%`));
  await db.delete(loggedSets).where(like(loggedSets.id, `${PREFIX}%`));
  await db.delete(readinessChecks).where(like(readinessChecks.id, `${PREFIX}%`));
  await db.delete(workoutLogs).where(like(workoutLogs.id, `${PREFIX}%`));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
}

/** Seed a completed workout log with the given sets and overall RPE. */
async function seedCompletedLog(
  logId: string,
  sets: { exerciseId: string; rpe: number; weight?: number; reps?: number }[],
  overallRpe: number,
  createdAt: Date
) {
  await db.insert(workoutLogs).values({
    id: logId,
    userId: TEST_USER_ID,
    startedAt: createdAt,
    completedAt: createdAt,
    overallRpe,
    createdAt,
  });
  if (sets.length > 0) {
    await db.insert(loggedSets).values(
      sets.map((s, i) => ({
        id: `${logId}_set_${i}`,
        workoutLogId: logId,
        exerciseId: s.exerciseId,
        setNumber: i + 1,
        weight: s.weight ?? 100,
        reps: s.reps ?? 8,
        rpe: s.rpe,
      }))
    );
  }
}

/** Seed a decision + a followed/unevaluated outcome. */
async function seedDecisionWithOutcome(
  idSuffix: string,
  type: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>
): Promise<string> {
  const decisionId = `${PREFIX}dec_${idSuffix}`;
  const outcomeId = `${PREFIX}out_${idSuffix}`;
  await db.insert(decisions).values({
    id: decisionId,
    userId: TEST_USER_ID,
    type,
    input,
    output,
    reasoning: "test",
    algorithmVersion: "1.1.0",
  });
  await db.insert(decisionOutcomes).values({
    id: outcomeId,
    decisionId,
    userId: TEST_USER_ID,
    outcome: "followed",
    success: null,
  });
  return outcomeId;
}

async function getOutcome(outcomeId: string) {
  const [row] = await db
    .select()
    .from(decisionOutcomes)
    .where(eq(decisionOutcomes.id, outcomeId))
    .limit(1);
  return row;
}

describe("evaluatePendingDecisions — non-exercise + rotation types", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  beforeEach(async () => {
    await cleanup();
    await db.insert(users).values(testUser);
  });

  it("evaluates an exercise_rotation swap against the new exercise's sets", async () => {
    const outcomeId = await seedDecisionWithOutcome(
      "rot",
      "exercise_rotation",
      { exerciseId: "barbell-back-squat" },
      { action: "swap", newExerciseId: "front-squat", reason: "variety" }
    );

    const logId = `${PREFIX}log_rot`;
    await seedCompletedLog(
      logId,
      [
        { exerciseId: "front-squat", rpe: 7 },
        { exerciseId: "front-squat", rpe: 8 },
      ],
      7.5,
      new Date()
    );

    await evaluatePendingDecisions(TEST_USER_ID, logId);

    const outcome = await getOutcome(outcomeId);
    expect(outcome!.success).toBe(true);
    expect(outcome!.evaluatedAt).not.toBeNull();
    const actual = outcome!.actualValue as ActualValue;
    expect(actual.setsCompleted).toBe(2);
    expect(actual.evaluationReason).toMatch(/Adopted swap/);
  });

  it("evaluates a deload_recommendation (previously skipped for missing exerciseId, no divide-by-zero)", async () => {
    const outcomeId = await seedDecisionWithOutcome(
      "deload",
      "deload_recommendation",
      {}, // no exerciseId — would have been skipped before
      { recommended: true, reason: "fatigue accumulating" }
    );

    // A prior high-RPE session as the baseline.
    await seedCompletedLog(
      `${PREFIX}log_prior`,
      [{ exerciseId: "bench-press", rpe: 9 }],
      9,
      new Date(Date.now() - 86_400_000)
    );

    // This session: backed off (lower RPE).
    const logId = `${PREFIX}log_deload`;
    await seedCompletedLog(
      logId,
      [{ exerciseId: "bench-press", rpe: 6 }],
      6,
      new Date()
    );

    await evaluatePendingDecisions(TEST_USER_ID, logId);

    const outcome = await getOutcome(outcomeId);
    // Was evaluated (not skipped) and succeeded.
    expect(outcome!.success).toBe(true);
    expect(outcome!.evaluatedAt).not.toBeNull();

    // Type-aware actualValue: session aggregates, not weight/rep averages.
    const actual = outcome!.actualValue as ActualValue;
    expect(actual.completedSetCount).toBe(1);
    expect(actual.sessionOverallRpe).toBe(6);
    expect(actual.evaluationReason).toMatch(/heeded/);
    // No divide-by-zero leakage from the old exercise-averaging path.
    expect(actual.avgWeight).toBeUndefined();
    expect(actual.avgReps).toBeUndefined();
  });

  it("evaluates a session_recovery decision using the linked readiness check", async () => {
    const outcomeId = await seedDecisionWithOutcome(
      "recovery",
      "session_recovery",
      {}, // no exerciseId
      { recommendation: "rest_day", volumeModifier: 0, intensityModifier: 0 }
    );

    const logId = `${PREFIX}log_recovery`;
    // Light session — user heeded the rest recommendation.
    await seedCompletedLog(
      logId,
      [{ exerciseId: "walking", rpe: 3 }],
      3,
      new Date()
    );

    await db.insert(readinessChecks).values({
      id: `${PREFIX}rc_recovery`,
      userId: TEST_USER_ID,
      workoutLogId: logId,
      sleepQuality: 2,
      muscleSoreness: 4,
      stressLevel: 4,
      energyLevel: 2,
      score: 2,
      recommendation: "rest",
    });

    await evaluatePendingDecisions(TEST_USER_ID, logId);

    const outcome = await getOutcome(outcomeId);
    expect(outcome!.success).toBe(true);
    expect(outcome!.evaluatedAt).not.toBeNull();

    const actual = outcome!.actualValue as ActualValue;
    expect(actual.completedSetCount).toBe(1);
    expect(actual.sessionOverallRpe).toBe(3);
    expect(actual.readinessScore).toBe(2);
    expect(actual.evaluationReason).toMatch(/heeded/);
  });

  it("does not re-evaluate an already-scored outcome (success IS NULL idempotency)", async () => {
    const outcomeId = await seedDecisionWithOutcome(
      "deload2",
      "deload_recommendation",
      {},
      { recommended: false, reason: "ok" }
    );
    // Pre-mark as evaluated.
    await db
      .update(decisionOutcomes)
      .set({ success: false, evaluatedAt: new Date(0) })
      .where(eq(decisionOutcomes.id, outcomeId));

    const logId = `${PREFIX}log_idem`;
    await seedCompletedLog(logId, [{ exerciseId: "bench-press", rpe: 7 }], 7, new Date());

    await evaluatePendingDecisions(TEST_USER_ID, logId);

    const outcome = await getOutcome(outcomeId);
    // Untouched: still the pre-set value.
    expect(outcome!.success).toBe(false);
    expect(outcome!.evaluatedAt!.getTime()).toBe(new Date(0).getTime());
  });
});
