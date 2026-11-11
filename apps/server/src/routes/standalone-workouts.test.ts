import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { db } from "@gymapp/db";
import { users, standaloneWorkouts } from "@gymapp/db/schema";
import { eq, like } from "drizzle-orm";

// Mock Clerk's verifyToken before importing the app
// NOTE: vi.mock is hoisted, so we must use literal string in factory (not variable reference)
vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn().mockResolvedValue({ sub: "test_clerk_standalone_12345" }),
}));

const TEST_CLERK_ID = "test_clerk_standalone_12345";

import { Hono } from "hono";
import { openapi } from "../openapi";

const app = new Hono();
app.route("/api", openapi);

// The internal users.id deliberately differs from the Clerk id, as it does for
// real users (clients create them as `user-<clerk prefix>`).
const TEST_USER_ID = "test-user-standalone-001";

const testUser = {
  id: TEST_USER_ID,
  clerkId: TEST_CLERK_ID,
  email: "teststandalone@example.com",
  trainingLevel: "intermediate" as const,
  primaryGoal: "strength" as const,
  preferences: {},
};

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

interface StandaloneWorkoutData {
  id: string;
  userId: string;
  name: string;
}

async function cleanupTestData() {
  await db.delete(standaloneWorkouts).where(eq(standaloneWorkouts.userId, TEST_USER_ID));
  await db.delete(users).where(like(users.id, "test-user-standalone-%"));
}

describe("Standalone Workouts API", () => {
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
    await db.insert(users).values(testUser);
  });

  it("lists workouts owned by the internal user id, not the Clerk id", async () => {
    await db.insert(standaloneWorkouts).values({
      id: "test-standalone-001",
      userId: TEST_USER_ID,
      name: "Arms",
      scheduledDate: "2026-01-05",
      plannedExercises: [],
      focusMuscles: ["biceps"],
    });

    const res = await app.request("/api/standalone-workouts", { headers: authHeaders() });
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiResponse<StandaloneWorkoutData[]>;
    expect(body.data!.map((w) => w.id)).toEqual(["test-standalone-001"]);
  });

  it("creates workouts under the internal user id", async () => {
    const res = await app.request("/api/standalone-workouts", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name: "Extra Arms",
        scheduledDate: "2026-01-06",
        focusMuscles: ["biceps"],
        exercises: [{ exerciseId: "dumbbell-curl", sets: 3, repRange: [10, 12], restSeconds: 60 }],
      }),
    });
    expect(res.status).toBe(201);

    const body = (await res.json()) as ApiResponse<StandaloneWorkoutData>;
    expect(body.data!.userId).toBe(TEST_USER_ID);
  });

  it("returns 404 when the authenticated user has not onboarded", async () => {
    const { verifyToken } = await import("@clerk/backend");
    vi.mocked(verifyToken).mockResolvedValue({ sub: "test_clerk_not_onboarded" } as never);

    const res = await app.request("/api/standalone-workouts", { headers: authHeaders() });
    expect(res.status).toBe(404);
  });
});
