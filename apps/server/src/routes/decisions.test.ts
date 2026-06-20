import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import { db } from "@gymapp/db";
import { users, decisions, decisionOutcomes } from "@gymapp/db/schema";
import { eq, like } from "drizzle-orm";

// Mock Clerk's verifyToken before importing the app.
// NOTE: vi.mock is hoisted, so the factory must use a literal string.
vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn().mockResolvedValue({ sub: "test-user-decisions-001" }),
}));

// We seed users with id === clerkId so that the verified userId (which equals
// the Clerk `sub`) is also a valid `users.id` foreign key for persistence.
const TEST_USER_ID = "test-user-decisions-001";

const testUser = {
  id: TEST_USER_ID,
  clerkId: TEST_USER_ID,
  email: "testdecisions@example.com",
  trainingLevel: "intermediate" as const,
  primaryGoal: "strength" as const,
  preferences: {},
};

// Import app after mocking.
import { Hono } from "hono";
import { openapi } from "../openapi";

const app = new Hono();
app.route("/api", openapi);

function authHeaders(token = "test-token") {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

interface LoadDecisionResult {
  action: "increase" | "maintain" | "decrease";
  newWeight: number;
  reason: string;
}

interface AccuracyStats {
  userId: string;
  totalDecisions: number;
  followed: number;
  overridden: number;
  ignored: number;
  successRate: number;
  overrideReasons: Record<string, number>;
  byType: Record<string, { total: number; followed: number; successRate: number }>;
}

// A clean "ready to increase" input at a heavy weight (large increment path).
const increaseBody = {
  exerciseId: "barbell-bench-press",
  recentSets: [
    { reps: 10, rpe: 7, weight: 100 },
    { reps: 10, rpe: 7, weight: 100 },
  ],
  currentWeight: 100,
  targetRepRange: [8, 10] as [number, number],
  userId: TEST_USER_ID,
};

async function cleanup() {
  await db.delete(decisionOutcomes).where(like(decisionOutcomes.userId, "test-user-decisions-%"));
  await db.delete(decisions).where(like(decisions.userId, "test-user-decisions-%"));
  await db.delete(users).where(like(users.id, "test-user-decisions-%"));
}

/**
 * Seed `count` load_progression decisions, each with a 'followed' outcome whose
 * `success` is true/false to hit the requested success rate. Returns nothing;
 * callers read accuracy via the service through the route.
 */
async function seedLoadProgressionHistory(count: number, successRate: number) {
  const successfulCount = Math.round(count * successRate);
  for (let i = 0; i < count; i++) {
    const decisionId = `dec_seed_${i}_${Date.now()}`;
    await db.insert(decisions).values({
      id: decisionId,
      userId: TEST_USER_ID,
      type: "load_progression",
      input: { exerciseId: "barbell-bench-press" },
      output: { action: "increase", newWeight: 105 },
      reasoning: "seed",
      algorithmVersion: "1.0.0",
    });
    await db.insert(decisionOutcomes).values({
      id: `do_seed_${i}_${Date.now()}`,
      decisionId,
      userId: TEST_USER_ID,
      outcome: "followed",
      success: i < successfulCount,
    });
  }
}

describe("Decisions API - self-tuning", () => {
  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    delete process.env.SELF_TUNING_ENABLED;
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyToken } = await import("@clerk/backend");
    vi.mocked(verifyToken).mockResolvedValue({ sub: TEST_USER_ID } as never);

    await cleanup();
    await db.insert(users).values(testUser);
    delete process.env.SELF_TUNING_ENABLED;
  });

  afterEach(() => {
    delete process.env.SELF_TUNING_ENABLED;
  });

  describe("POST /api/decisions/load-progression", () => {
    it("is a no-op for a new user with no outcome history (cold start)", async () => {
      const res = await app.request("/api/decisions/load-progression", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(increaseBody),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<LoadDecisionResult>;
      expect(body.data!.action).toBe("increase");
      // Default large increment: 100 -> 105.
      expect(body.data!.newWeight).toBe(105);

      // Persisted with the self-tuning engine version and no appliedModifier.
      const [row] = await db
        .select()
        .from(decisions)
        .where(eq(decisions.userId, TEST_USER_ID))
        .orderBy(decisions.createdAt);
      expect(row!.algorithmVersion).toBe("1.1.0");
      expect((row!.input as Record<string, unknown>).appliedModifier).toBeUndefined();
    });

    it("tunes conservatively when the user has a low success rate", async () => {
      await seedLoadProgressionHistory(10, 0.4); // < 0.6 -> modifier 0.8

      const res = await app.request("/api/decisions/load-progression", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(increaseBody),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<LoadDecisionResult>;
      expect(body.data!.action).toBe("increase");
      // Conservative: large increment 5 * 0.8 = 4 -> 100 + 4 = 104.
      expect(body.data!.newWeight).toBe(104);

      // The freshly-created decision records the applied modifier for audit.
      const rows = await db
        .select()
        .from(decisions)
        .where(eq(decisions.userId, TEST_USER_ID));
      const tuned = rows.find(
        (r) => (r.input as Record<string, unknown>).appliedModifier === 0.8
      );
      expect(tuned).toBeDefined();
      expect(tuned!.algorithmVersion).toBe("1.1.0");
    });

    it("tunes aggressively when the user has a high success rate", async () => {
      await seedLoadProgressionHistory(10, 0.9); // > 0.85 -> modifier 1.1

      const res = await app.request("/api/decisions/load-progression", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(increaseBody),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<LoadDecisionResult>;
      expect(body.data!.action).toBe("increase");
      // Aggressive: large increment 5 * 1.1 = 5.5 -> 100 + 5.5 = 105.5.
      expect(body.data!.newWeight).toBe(105.5);
    });

    it("does not tune when SELF_TUNING_ENABLED=false (kill switch)", async () => {
      await seedLoadProgressionHistory(10, 0.4); // would otherwise be conservative
      process.env.SELF_TUNING_ENABLED = "false";

      const res = await app.request("/api/decisions/load-progression", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(increaseBody),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<LoadDecisionResult>;
      // Untuned default increment.
      expect(body.data!.newWeight).toBe(105);
    });
  });

  describe("POST /api/decisions/load-progression — cycle phase", () => {
    it("persists the resolved cyclePhase in the decision input", async () => {
      const res = await app.request("/api/decisions/load-progression", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...increaseBody,
          cyclePhase: { phase: "luteal" },
        }),
      });
      expect(res.status).toBe(200);

      const rows = await db
        .select()
        .from(decisions)
        .where(eq(decisions.userId, TEST_USER_ID));
      const persisted = rows.find(
        (r) => (r.input as Record<string, unknown>).cyclePhase !== undefined
      );
      expect(persisted).toBeDefined();
      const cyclePhase = (persisted!.input as Record<string, unknown>).cyclePhase as Record<
        string,
        unknown
      >;
      // Engine defaults for luteal: 0.95 modifier, tests allowed.
      expect(cyclePhase.phase).toBe("luteal");
      expect(cyclePhase.loadModifier).toBe(0.95);
      expect(cyclePhase.allowNewWeightTests).toBe(true);
    });

    it("holds an otherwise-increase decision during the menstrual phase end-to-end", async () => {
      const res = await app.request("/api/decisions/load-progression", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...increaseBody,
          cyclePhase: { phase: "menstrual" },
        }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<LoadDecisionResult>;
      // Would be an increase to 105; menstrual holds (no new weight tests) and
      // scales the held current weight by the 0.90 default.
      expect(body.data!.action).toBe("maintain");
      expect(body.data!.newWeight).toBe(90); // 100 (held) * 0.90
      expect(body.data!.reason).toContain("menstrual");
    });
  });

  describe("GET /api/decisions/accuracy", () => {
    it("returns the expected stats shape after the service extraction", async () => {
      await seedLoadProgressionHistory(5, 0.6);

      const res = await app.request("/api/decisions/accuracy", {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<AccuracyStats>;
      const stats = body.data!;
      expect(stats.userId).toBe(TEST_USER_ID);
      expect(stats.totalDecisions).toBe(5);
      expect(stats.followed).toBe(5);
      expect(stats.overridden).toBe(0);
      expect(stats.ignored).toBe(0);
      expect(typeof stats.successRate).toBe("number");
      expect(stats.overrideReasons).toEqual({});
      expect(stats.byType.load_progression).toBeDefined();
      expect(stats.byType.load_progression!.total).toBe(5);
    });
  });

  describe("POST /api/decisions/load-progression — equipment snap (Issue 5)", () => {
    it("snaps the prescribed weight down to the machine increment end-to-end", async () => {
      const res = await app.request("/api/decisions/load-progression", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...increaseBody,
          // Core would increase 100 → 105; a 4kg-step machine can't make 105.
          equipment: { incrementConstraint: 4 },
        }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<LoadDecisionResult>;
      // Achievable = k*4 → 104 is the largest ≤ 105.
      expect(body.data!.newWeight).toBe(104);
      expect(body.data!.reason).toMatch(/snapped/);
    });

    it("rejects a non-positive increment at the boundary", async () => {
      const res = await app.request("/api/decisions/load-progression", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...increaseBody,
          equipment: { incrementConstraint: 0 },
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/decisions/within-session (Issue 4)", () => {
    const baseBody = {
      exerciseId: "seated-leg-curl",
      completedSet: { weight: 25, reps: 12, rpe: 6 },
      targetRepRange: [8, 12] as [number, number],
      plannedWeight: 25,
      remainingSets: 2,
      userId: TEST_USER_ID,
    };

    it("prescribes a heavier next set when the set was easy and reps maxed out", async () => {
      const res = await app.request("/api/decisions/within-session", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(baseBody),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<{
        action: string;
        nextSetWeight: number;
        newBaselineIfConfirmed?: { weight: number; reps: number };
      }>;
      expect(body.data!.action).toBe("increase");
      expect(body.data!.nextSetWeight).toBe(27.5); // 25 < 50 → +2.5
    });

    it("persists the decision as type within_session", async () => {
      await app.request("/api/decisions/within-session", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(baseBody),
      });

      const rows = await db
        .select()
        .from(decisions)
        .where(eq(decisions.userId, TEST_USER_ID));
      const persisted = rows.find((r) => r.type === "within_session");
      expect(persisted).toBeDefined();
      expect((persisted!.input as Record<string, unknown>).exerciseId).toBe("seated-leg-curl");
    });

    it("flags a new baseline when an over-plan set is sustained at RPE <= 8", async () => {
      const res = await app.request("/api/decisions/within-session", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...baseBody,
          completedSet: { weight: 30, reps: 10, rpe: 8 },
          plannedWeight: 25,
        }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<{
        newBaselineIfConfirmed?: { weight: number; reps: number };
      }>;
      expect(body.data!.newBaselineIfConfirmed).toEqual({ weight: 30, reps: 10 });
    });

    it("rejects an out-of-range RPE at the boundary", async () => {
      const res = await app.request("/api/decisions/within-session", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...baseBody,
          completedSet: { weight: 25, reps: 12, rpe: 11 },
        }),
      });
      expect(res.status).toBe(400);
    });
  });
});
