import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { db } from "@gymapp/db";
import { users, workoutLogs, loggedSets } from "@gymapp/db/schema";
import { eq, like } from "drizzle-orm";

// Mock Clerk's verifyToken before importing the app
vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn().mockResolvedValue({ sub: "test_clerk_logs_12345" }),
}));

const TEST_CLERK_ID = "test_clerk_logs_12345";
const OTHER_CLERK_ID = "other_clerk_logs_67890";

// Import app after mocking
import { Hono } from "hono";
import { openapi } from "../openapi";

const app = new Hono();
app.route("/api", openapi);

// Test data
const TEST_USER_ID = "test-user-logs-001";
const OTHER_USER_ID = "test-user-logs-002";

const testUser = {
  id: TEST_USER_ID,
  clerkId: TEST_CLERK_ID,
  email: "testlogs@example.com",
  trainingLevel: "intermediate" as const,
  primaryGoal: "strength" as const,
  preferences: {},
};

const otherUser = {
  id: OTHER_USER_ID,
  clerkId: OTHER_CLERK_ID,
  email: "otherlogs@example.com",
  trainingLevel: "beginner" as const,
  primaryGoal: "hypertrophy" as const,
  preferences: {},
};

// Helper for auth headers
function authHeaders(token = "test-token") {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Type definitions
interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

interface RetrospectiveLogResponse {
  id: string;
  exercises: number;
  sets: number;
  date: string;
}

// Cleanup helper
async function cleanupTestData() {
  await db.delete(loggedSets).where(like(loggedSets.workoutLogId, "log_%"));
  await db.delete(workoutLogs).where(like(workoutLogs.id, "log_%"));
  await db.delete(users).where(like(users.id, "test-user-logs-%"));
}

describe("Logs API - Retrospective Logging", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const { verifyToken } = await import("@clerk/backend");
    vi.mocked(verifyToken).mockResolvedValue({ sub: TEST_CLERK_ID } as never);

    await cleanupTestData();

    // Set up base data
    await db.insert(users).values(testUser);
  });

  describe("POST /api/logs/retrospective", () => {
    it("should create a retrospective workout log with exercises and sets", async () => {
      const workoutDate = "2026-02-01T12:00:00.000Z";

      const res = await app.request("/api/logs/retrospective", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          date: workoutDate,
          overallRpe: 7,
          notes: "Great workout",
          exercises: [
            {
              exerciseId: "barbell-bench-press",
              sets: [
                { weight: 135, reps: 10, rpe: 6 },
                { weight: 155, reps: 8, rpe: 7 },
                { weight: 155, reps: 7, rpe: 8 },
              ],
            },
            {
              exerciseId: "incline-dumbbell-press",
              sets: [
                { weight: 50, reps: 12, rpe: 7 },
                { weight: 50, reps: 10, rpe: 8 },
              ],
            },
          ],
        }),
      });

      expect(res.status).toBe(201);

      const body = (await res.json()) as ApiResponse<RetrospectiveLogResponse>;
      expect(body.data).toBeDefined();
      expect(body.data!.id).toMatch(/^log_/);
      expect(body.data!.exercises).toBe(2);
      expect(body.data!.sets).toBe(5);
      expect(body.data!.date).toBe(workoutDate);
    });

    it("should create workout log without optional fields", async () => {
      const workoutDate = "2026-02-01T12:00:00.000Z";

      const res = await app.request("/api/logs/retrospective", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          date: workoutDate,
          exercises: [
            {
              exerciseId: "barbell-squat",
              sets: [{ weight: 225, reps: 5 }],
            },
          ],
        }),
      });

      expect(res.status).toBe(201);

      const body = (await res.json()) as ApiResponse<RetrospectiveLogResponse>;
      expect(body.data).toBeDefined();
      expect(body.data!.exercises).toBe(1);
      expect(body.data!.sets).toBe(1);
    });

    it("should store sets with correct data in database", async () => {
      const workoutDate = "2026-02-01T12:00:00.000Z";

      const res = await app.request("/api/logs/retrospective", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          date: workoutDate,
          exercises: [
            {
              exerciseId: "barbell-deadlift",
              sets: [
                { weight: 315, reps: 5, rpe: 8 },
                { weight: 315, reps: 5, rpe: 9 },
              ],
            },
          ],
        }),
      });

      expect(res.status).toBe(201);

      const body = (await res.json()) as ApiResponse<RetrospectiveLogResponse>;
      const logId = body.data!.id;

      // Verify the logged sets in DB
      const sets = await db
        .select()
        .from(loggedSets)
        .where(eq(loggedSets.workoutLogId, logId));

      expect(sets.length).toBe(2);
      expect(sets[0]!.exerciseId).toBe("barbell-deadlift");
      expect(sets[0]!.weight).toBe(315);
      expect(sets[0]!.reps).toBe(5);
      expect(sets[0]!.setNumber).toBe(1);
      expect(sets[1]!.setNumber).toBe(2);
    });

    it("should return 401 without authentication", async () => {
      const res = await app.request("/api/logs/retrospective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-02-01T12:00:00.000Z",
          exercises: [
            {
              exerciseId: "barbell-bench-press",
              sets: [{ weight: 135, reps: 10 }],
            },
          ],
        }),
      });

      expect(res.status).toBe(401);
    });

    it("should return 400 for invalid date format", async () => {
      const res = await app.request("/api/logs/retrospective", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          date: "not-a-valid-date",
          exercises: [
            {
              exerciseId: "barbell-bench-press",
              sets: [{ weight: 135, reps: 10 }],
            },
          ],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for empty exercises array", async () => {
      const res = await app.request("/api/logs/retrospective", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          date: "2026-02-01T12:00:00.000Z",
          exercises: [],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for empty sets array", async () => {
      const res = await app.request("/api/logs/retrospective", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          date: "2026-02-01T12:00:00.000Z",
          exercises: [
            {
              exerciseId: "barbell-bench-press",
              sets: [],
            },
          ],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid RPE value", async () => {
      const res = await app.request("/api/logs/retrospective", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          date: "2026-02-01T12:00:00.000Z",
          overallRpe: 11, // Invalid: max is 10
          exercises: [
            {
              exerciseId: "barbell-bench-press",
              sets: [{ weight: 135, reps: 10 }],
            },
          ],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for negative weight", async () => {
      const res = await app.request("/api/logs/retrospective", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          date: "2026-02-01T12:00:00.000Z",
          exercises: [
            {
              exerciseId: "barbell-bench-press",
              sets: [{ weight: -10, reps: 10 }],
            },
          ],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 400 for zero reps", async () => {
      const res = await app.request("/api/logs/retrospective", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          date: "2026-02-01T12:00:00.000Z",
          exercises: [
            {
              exerciseId: "barbell-bench-press",
              sets: [{ weight: 135, reps: 0 }],
            },
          ],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should create workout log for another user when authenticated as them", async () => {
      // Insert other user and mock their auth
      await db.insert(users).values(otherUser);

      const { verifyToken } = await import("@clerk/backend");
      vi.mocked(verifyToken).mockResolvedValue({ sub: OTHER_CLERK_ID } as never);

      const res = await app.request("/api/logs/retrospective", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          date: "2026-02-01T12:00:00.000Z",
          exercises: [
            {
              exerciseId: "barbell-bench-press",
              sets: [{ weight: 135, reps: 10 }],
            },
          ],
        }),
      });

      expect(res.status).toBe(201);

      // Verify the log was created for the other user
      const body = (await res.json()) as ApiResponse<RetrospectiveLogResponse>;
      const logId = body.data!.id;

      const [log] = await db
        .select()
        .from(workoutLogs)
        .where(eq(workoutLogs.id, logId));

      expect(log).toBeDefined();
      expect(log!.userId).toBe(OTHER_USER_ID);
    });
  });

  describe("POST /api/logs/:logId/sets - idempotent replay", () => {
    const LOG_ID = "log_test_idem";
    const SET_ID = "set-test-idem-1";
    const setBody = {
      id: SET_ID,
      exerciseId: "barbell-bench-press",
      setNumber: 1,
      weight: 100,
      reps: 8,
      rpe: 8,
    };

    async function seedLog() {
      await db.insert(workoutLogs).values({
        id: LOG_ID,
        userId: TEST_USER_ID,
        startedAt: new Date(),
      });
    }

    it("creates a set with a client-supplied id (201)", async () => {
      await seedLog();
      const res = await app.request(`/api/logs/${LOG_ID}/sets`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(setBody),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as ApiResponse<{ id: string }>;
      expect(body.data!.id).toBe(SET_ID);
    });

    it("re-sending the same set id is idempotent: 200 + a single row", async () => {
      await seedLog();
      const first = await app.request(`/api/logs/${LOG_ID}/sets`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(setBody),
      });
      expect(first.status).toBe(201);

      // Offline replay — same id re-sent.
      const replay = await app.request(`/api/logs/${LOG_ID}/sets`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(setBody),
      });
      expect(replay.status).toBe(200);
      const body = (await replay.json()) as ApiResponse<{ id: string }>;
      expect(body.data!.id).toBe(SET_ID);

      const rows = await db.select().from(loggedSets).where(eq(loggedSets.id, SET_ID));
      expect(rows.length).toBe(1);
    });
  });
});
