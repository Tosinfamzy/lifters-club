import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { db } from "@gymapp/db";
import { users, readinessChecks, userBaselines } from "@gymapp/db/schema";
import { eq, like } from "drizzle-orm";

// Mock Clerk's verifyToken before importing the app
// NOTE: vi.mock is hoisted, so we must use literal string in factory (not variable reference)
vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn().mockResolvedValue({ sub: "test_clerk_users_12345" }),
}));

const TEST_CLERK_ID = "test_clerk_users_12345";
const OTHER_CLERK_ID = "other_clerk_users_67890";

// Import app after mocking
import { Hono } from "hono";
import { openapi } from "../openapi";

const app = new Hono();
app.route("/api", openapi);

// Test data
const TEST_USER_ID = "test-user-users-001";
const OTHER_USER_ID = "test-user-users-002";

const testUser = {
  id: TEST_USER_ID,
  clerkId: TEST_CLERK_ID,
  email: "testuser@example.com",
  trainingLevel: "intermediate" as const,
  primaryGoal: "strength" as const,
  preferences: {},
};

const otherUser = {
  id: OTHER_USER_ID,
  clerkId: OTHER_CLERK_ID,
  email: "otheruser@example.com",
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

interface UserData {
  id: string;
  clerkId: string;
  email: string;
  trainingLevel: string;
  primaryGoal: string;
  preferences: Record<string, unknown>;
  onboardingComplete: boolean;
  baselineComplete: boolean;
}

interface ReadinessData {
  id: string;
  score: number;
  recommendation: string;
  volumeModifier: number;
  intensityModifier: number;
  adjustments: string[];
  reason: string;
}

describe("Users API", () => {
  beforeAll(async () => {
    // Clean up test data
    await db.delete(userBaselines).where(like(userBaselines.userId, "test-user-users-%"));
    await db.delete(readinessChecks).where(like(readinessChecks.userId, "test-user-users-%"));
    await db.delete(users).where(like(users.id, "test-user-users-%"));
  });

  afterAll(async () => {
    // Final cleanup
    await db.delete(userBaselines).where(like(userBaselines.userId, "test-user-users-%"));
    await db.delete(readinessChecks).where(like(readinessChecks.userId, "test-user-users-%"));
    await db.delete(users).where(like(users.id, "test-user-users-%"));
  });

  beforeEach(async () => {
    // Reset mocks and clean up before each test
    vi.clearAllMocks();

    // Re-set the default mock behavior
    const { verifyToken } = await import("@clerk/backend");
    vi.mocked(verifyToken).mockResolvedValue({ sub: TEST_CLERK_ID } as never);

    // Clean up test users
    await db.delete(userBaselines).where(like(userBaselines.userId, "test-user-users-%"));
    await db.delete(readinessChecks).where(like(readinessChecks.userId, "test-user-users-%"));
    await db.delete(users).where(like(users.id, "test-user-users-%"));
  });

  describe("POST /api/users", () => {
    it("should create a new user", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(testUser),
      });
      expect(res.status).toBe(201);

      const body = (await res.json()) as ApiResponse<UserData>;
      expect(body.data).toBeDefined();
      expect(body.data!.id).toBe(testUser.id);
      expect(body.data!.email).toBe(testUser.email);
      expect(body.data!.trainingLevel).toBe(testUser.trainingLevel);
      expect(body.data!.primaryGoal).toBe(testUser.primaryGoal);
    });

    it("should return 409 if user already exists", async () => {
      // Create user first
      await db.insert(users).values(testUser);

      // Try to create again
      const res = await app.request("/api/users", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(testUser),
      });
      expect(res.status).toBe(409);

      const body = (await res.json()) as ApiResponse;
      expect(body.error).toBe("User already exists");
    });

    it("should validate required fields", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id: "invalid" }),
      });
      expect(res.status).toBe(400);
    });

    it("should validate email format", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...testUser,
          id: "test-invalid-email",
          email: "not-an-email",
        }),
      });
      expect(res.status).toBe(400);
    });

    it("should validate trainingLevel enum", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...testUser,
          id: "test-invalid-level",
          trainingLevel: "expert",
        }),
      });
      expect(res.status).toBe(400);
    });

    it("should validate primaryGoal enum", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...testUser,
          id: "test-invalid-goal",
          primaryGoal: "powerlifting",
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/users/me", () => {
    it("should return current user by clerk ID", async () => {
      // Create user first
      await db.insert(users).values(testUser);

      const res = await app.request("/api/users/me", {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<UserData & { activeTrainingBlock: unknown }>;
      expect(body.data).toBeDefined();
      expect(body.data!.id).toBe(testUser.id);
      expect(body.data!.clerkId).toBe(TEST_CLERK_ID);
      expect(body.data!.activeTrainingBlock).toBeNull();
    });

    it("should return 401 without authentication", async () => {
      const res = await app.request("/api/users/me");
      expect(res.status).toBe(401);
    });

    it("should return 404 if user not found", async () => {
      // User doesn't exist in DB
      const res = await app.request("/api/users/me", {
        headers: authHeaders(),
      });
      expect(res.status).toBe(404);

      const body = (await res.json()) as ApiResponse;
      expect(body.error).toBe("User not found");
    });
  });

  describe("GET /api/users/:id", () => {
    it("should return user by ID for owner", async () => {
      // Create user
      await db.insert(users).values(testUser);

      const res = await app.request(`/api/users/${TEST_USER_ID}`, {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<UserData>;
      expect(body.data).toBeDefined();
      expect(body.data!.id).toBe(testUser.id);
    });

    it("should return 403 for non-owner", async () => {
      // Create both users
      await db.insert(users).values(testUser);
      await db.insert(users).values(otherUser);

      // Try to access other user's data
      const res = await app.request(`/api/users/${OTHER_USER_ID}`, {
        headers: authHeaders(),
      });
      expect(res.status).toBe(403);

      const body = (await res.json()) as ApiResponse;
      expect(body.error).toContain("Forbidden");
    });

    it("should return 401 without authentication", async () => {
      const res = await app.request(`/api/users/${TEST_USER_ID}`);
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /api/users/:id", () => {
    it("should update user training level", async () => {
      await db.insert(users).values(testUser);

      const res = await app.request(`/api/users/${TEST_USER_ID}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ trainingLevel: "advanced" }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<UserData>;
      expect(body.data!.trainingLevel).toBe("advanced");
    });

    it("should update user primary goal", async () => {
      await db.insert(users).values(testUser);

      const res = await app.request(`/api/users/${TEST_USER_ID}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ primaryGoal: "hypertrophy" }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<UserData>;
      expect(body.data!.primaryGoal).toBe("hypertrophy");
    });

    it("should update user preferences", async () => {
      await db.insert(users).values(testUser);

      const res = await app.request(`/api/users/${TEST_USER_ID}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ preferences: { theme: "dark" } }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<UserData>;
      expect(body.data!.preferences).toEqual({ theme: "dark" });
    });

    it("should return 403 for non-owner", async () => {
      await db.insert(users).values(testUser);
      await db.insert(users).values(otherUser);

      const res = await app.request(`/api/users/${OTHER_USER_ID}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ trainingLevel: "advanced" }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/users/readiness", () => {
    it("should calculate readiness and return adjustments", async () => {
      await db.insert(users).values(testUser);

      const res = await app.request("/api/users/readiness", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          userId: TEST_USER_ID,
          sleepQuality: 4,
          muscleSoreness: 3,
          stressLevel: 3,
          energyLevel: 4,
        }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<ReadinessData>;
      expect(body.data).toBeDefined();
      expect(body.data!.score).toBeGreaterThan(0);
      expect(body.data!.recommendation).toBeDefined();
      expect(body.data!.volumeModifier).toBeDefined();
      expect(body.data!.intensityModifier).toBeDefined();
      expect(body.data!.adjustments).toBeDefined();
      expect(Array.isArray(body.data!.adjustments)).toBe(true);
    });

    it("should persist readiness check", async () => {
      await db.insert(users).values(testUser);

      await app.request("/api/users/readiness", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          userId: TEST_USER_ID,
          sleepQuality: 4,
          muscleSoreness: 3,
          stressLevel: 3,
          energyLevel: 4,
        }),
      });

      // Verify it was saved
      const checks = await db
        .select()
        .from(readinessChecks)
        .where(eq(readinessChecks.userId, TEST_USER_ID));

      expect(checks.length).toBe(1);
      expect(checks[0]!.sleepQuality).toBe(4);
    });

    it("should return 403 for non-owner", async () => {
      await db.insert(users).values(testUser);
      await db.insert(users).values(otherUser);

      const res = await app.request("/api/users/readiness", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          userId: OTHER_USER_ID,
          sleepQuality: 4,
          muscleSoreness: 3,
          stressLevel: 3,
          energyLevel: 4,
        }),
      });
      expect(res.status).toBe(403);
    });

    it("should validate input ranges", async () => {
      await db.insert(users).values(testUser);

      const res = await app.request("/api/users/readiness", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          userId: TEST_USER_ID,
          sleepQuality: 10, // Invalid - max is 5
          muscleSoreness: 3,
          stressLevel: 3,
          energyLevel: 4,
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/users/readiness/extended", () => {
    it("should calculate extended readiness with recovery analysis", async () => {
      await db.insert(users).values(testUser);

      const res = await app.request("/api/users/readiness/extended", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          userId: TEST_USER_ID,
          sleepQuality: 7,
          muscleSoreness: 4,
          stressLevel: 5,
          energyLevel: 7,
          hoursSinceLastWorkout: 48,
          lastWorkoutRpe: 8,
        }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<ReadinessData>;
      expect(body.data).toBeDefined();
      expect(body.data!.score).toBeGreaterThan(0);
      expect(body.data!.recommendation).toBeDefined();
      expect(["full_session", "reduced_volume", "reduced_intensity", "light_session", "rest_day"]).toContain(
        body.data!.recommendation
      );
    });

    it("should return 403 for non-owner", async () => {
      await db.insert(users).values(testUser);
      await db.insert(users).values(otherUser);

      const res = await app.request("/api/users/readiness/extended", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          userId: OTHER_USER_ID,
          sleepQuality: 7,
          muscleSoreness: 4,
          stressLevel: 5,
          energyLevel: 7,
          hoursSinceLastWorkout: 48,
        }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/users/:id/baselines", () => {
    it("should save user baselines", async () => {
      await db.insert(users).values(testUser);

      const res = await app.request(`/api/users/${TEST_USER_ID}/baselines`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          baselines: [
            {
              exerciseId: "barbell-bench-press",
              weight: 100,
              reps: 5,
              source: "user_input",
            },
            {
              exerciseId: "barbell-back-squat",
              weight: 140,
              reps: 5,
              source: "user_input",
            },
          ],
        }),
      });
      expect(res.status).toBe(201);

      const body = (await res.json()) as ApiResponse<Array<{ exerciseId: string; baselineWeight: number }>>;
      expect(body.data).toBeDefined();
      expect(body.data!.length).toBe(2);
    });

    it("should update baselineComplete flag", async () => {
      await db.insert(users).values(testUser);

      await app.request(`/api/users/${TEST_USER_ID}/baselines`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          baselines: [
            {
              exerciseId: "barbell-bench-press",
              weight: 100,
              reps: 5,
              source: "user_input",
            },
          ],
        }),
      });

      // Verify user's baselineComplete flag was updated
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, TEST_USER_ID))
        .limit(1);

      expect(user[0]!.baselineComplete).toBe(true);
    });

    it("should return 403 for non-owner", async () => {
      await db.insert(users).values(testUser);
      await db.insert(users).values(otherUser);

      const res = await app.request(`/api/users/${OTHER_USER_ID}/baselines`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          baselines: [
            {
              exerciseId: "barbell-bench-press",
              weight: 100,
              reps: 5,
              source: "user_input",
            },
          ],
        }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/users/:id/baselines", () => {
    it("should return user baselines", async () => {
      await db.insert(users).values(testUser);

      // First create baselines
      await app.request(`/api/users/${TEST_USER_ID}/baselines`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          baselines: [
            {
              exerciseId: "barbell-bench-press",
              weight: 100,
              reps: 5,
              source: "user_input",
            },
          ],
        }),
      });

      // Then get them
      const res = await app.request(`/api/users/${TEST_USER_ID}/baselines`, {
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<Array<{ exerciseId: string }>>;
      expect(body.data).toBeDefined();
      expect(body.data!.length).toBe(1);
      expect(body.data![0]!.exerciseId).toBe("barbell-bench-press");
    });

    it("should return 403 for non-owner", async () => {
      await db.insert(users).values(testUser);
      await db.insert(users).values(otherUser);

      const res = await app.request(`/api/users/${OTHER_USER_ID}/baselines`, {
        headers: authHeaders(),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/users/:id/calibration-plan", () => {
    it("should return calibration plan", async () => {
      await db.insert(users).values(testUser);

      const res = await app.request(
        `/api/users/${TEST_USER_ID}/calibration-plan?equipment=barbell,dumbbell`,
        { headers: authHeaders() }
      );
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<{
        path: string;
        plan: unknown;
        needsCalibration: boolean;
      }>;
      expect(body.data).toBeDefined();
      expect(body.data!.path).toBeDefined();
      expect(body.data!.plan).toBeDefined();
    });

    it("should return 403 for non-owner", async () => {
      await db.insert(users).values(testUser);
      await db.insert(users).values(otherUser);

      const res = await app.request(`/api/users/${OTHER_USER_ID}/calibration-plan`, {
        headers: authHeaders(),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/users/:id/onboarding", () => {
    it("should update onboarding status", async () => {
      await db.insert(users).values(testUser);

      const res = await app.request(`/api/users/${TEST_USER_ID}/onboarding`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ onboardingComplete: true }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<UserData>;
      expect(body.data!.onboardingComplete).toBe(true);
    });

    it("should update baseline status", async () => {
      await db.insert(users).values(testUser);

      const res = await app.request(`/api/users/${TEST_USER_ID}/onboarding`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ baselineComplete: true }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<UserData>;
      expect(body.data!.baselineComplete).toBe(true);
    });

    it("should return 403 for non-owner", async () => {
      await db.insert(users).values(testUser);
      await db.insert(users).values(otherUser);

      const res = await app.request(`/api/users/${OTHER_USER_ID}/onboarding`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ onboardingComplete: true }),
      });
      expect(res.status).toBe(403);
    });
  });
});
