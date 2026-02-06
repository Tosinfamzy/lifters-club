import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { db } from "@gymapp/db";
import { users, programs, trainingBlocks, workouts } from "@gymapp/db/schema";
import { eq, like } from "drizzle-orm";

// Mock Clerk's verifyToken before importing the app
// NOTE: vi.mock is hoisted, so we must use literal string in factory (not variable reference)
vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn().mockResolvedValue({ sub: "test_clerk_workouts_12345" }),
}));

const TEST_CLERK_ID = "test_clerk_workouts_12345";
const OTHER_CLERK_ID = "other_clerk_workouts_67890";

// Import app after mocking
import { Hono } from "hono";
import { openapi } from "../openapi";

const app = new Hono();
app.route("/api", openapi);

// Test data
const TEST_USER_ID = "test-user-workouts-001";
const OTHER_USER_ID = "test-user-workouts-002";
const TEST_PROGRAM_ID = "test-program-workouts";
const TEST_BLOCK_ID = "test-block-workouts-001";
const OTHER_BLOCK_ID = "test-block-workouts-002";
const TEST_WORKOUT_ID = "test-workout-001";
const OTHER_WORKOUT_ID = "test-workout-002";

const testUser = {
  id: TEST_USER_ID,
  clerkId: TEST_CLERK_ID,
  email: "testworkouts@example.com",
  trainingLevel: "intermediate" as const,
  primaryGoal: "strength" as const,
  preferences: {},
};

const otherUser = {
  id: OTHER_USER_ID,
  clerkId: OTHER_CLERK_ID,
  email: "otherworkouts@example.com",
  trainingLevel: "beginner" as const,
  primaryGoal: "hypertrophy" as const,
  preferences: {},
};

const testProgram = {
  id: TEST_PROGRAM_ID,
  name: "Test Workout Program",
  description: "A test program",
  daysPerWeek: 3,
  goal: "strength" as const,
  level: "intermediate" as const,
  template: {
    weeks: 4,
    sessions: [
      {
        dayNumber: 1,
        name: "Day 1",
        focus: ["chest"],
        exercises: [
          {
            exerciseId: "barbell-bench-press",
            sets: 4,
            repRange: [6, 8],
            restSeconds: 180,
          },
        ],
      },
      {
        dayNumber: 3,
        name: "Day 2",
        focus: ["back"],
        exercises: [
          {
            exerciseId: "barbell-row",
            sets: 4,
            repRange: [6, 8],
            restSeconds: 180,
          },
        ],
      },
    ],
  },
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

interface TrainingBlockData {
  id: string;
  userId: string;
  programId: string;
  startDate: string;
  currentWeek: number;
  status: string;
}

interface WorkoutData {
  id: string;
  trainingBlockId: string;
  scheduledDate: string;
  weekNumber: number;
  dayNumber: number;
  status: string;
  plannedExercises: unknown[];
}

// Cleanup helper
async function cleanupTestData() {
  await db.delete(workouts).where(like(workouts.id, "test-%"));
  await db.delete(trainingBlocks).where(like(trainingBlocks.id, "test-%"));
  await db.delete(users).where(like(users.id, "test-user-workouts-%"));
  await db.delete(programs).where(eq(programs.id, TEST_PROGRAM_ID));
}

describe("Workouts API", () => {
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
    await db.insert(programs).values(testProgram);
  });

  describe("Training Blocks", () => {
    describe("GET /api/workouts/training-blocks", () => {
      it("should return user's training blocks", async () => {
        // Create a training block
        await db.insert(trainingBlocks).values({
          id: TEST_BLOCK_ID,
          userId: TEST_USER_ID,
          programId: TEST_PROGRAM_ID,
          startDate: "2024-01-01",
          currentWeek: 1,
          status: "active",
        });

        const res = await app.request("/api/workouts/training-blocks", {
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<TrainingBlockData[]>;
        expect(body.data).toBeDefined();
        expect(body.data!.length).toBe(1);
        expect(body.data![0]!.id).toBe(TEST_BLOCK_ID);
      });

      it("should filter by status", async () => {
        // Create active and completed blocks
        await db.insert(trainingBlocks).values([
          {
            id: TEST_BLOCK_ID,
            userId: TEST_USER_ID,
            programId: TEST_PROGRAM_ID,
            startDate: "2024-01-01",
            currentWeek: 1,
            status: "active",
          },
          {
            id: "test-block-completed",
            userId: TEST_USER_ID,
            programId: TEST_PROGRAM_ID,
            startDate: "2023-01-01",
            currentWeek: 4,
            status: "completed",
          },
        ]);

        const res = await app.request("/api/workouts/training-blocks?status=active", {
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<TrainingBlockData[]>;
        expect(body.data!.length).toBe(1);
        expect(body.data![0]!.status).toBe("active");
      });

      it("should return 401 without authentication", async () => {
        const res = await app.request("/api/workouts/training-blocks");
        expect(res.status).toBe(401);
      });

      it("should not return other users' blocks", async () => {
        await db.insert(users).values(otherUser);
        await db.insert(trainingBlocks).values({
          id: OTHER_BLOCK_ID,
          userId: OTHER_USER_ID,
          programId: TEST_PROGRAM_ID,
          startDate: "2024-01-01",
          currentWeek: 1,
          status: "active",
        });

        const res = await app.request("/api/workouts/training-blocks", {
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<TrainingBlockData[]>;
        expect(body.data!.length).toBe(0);
      });
    });

    describe("POST /api/workouts/training-blocks", () => {
      it("should create a new training block", async () => {
        const res = await app.request("/api/workouts/training-blocks", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            id: TEST_BLOCK_ID,
            programId: TEST_PROGRAM_ID,
            startDate: "2024-01-01",
          }),
        });
        expect(res.status).toBe(201);

        const body = (await res.json()) as ApiResponse<TrainingBlockData>;
        expect(body.data).toBeDefined();
        expect(body.data!.id).toBe(TEST_BLOCK_ID);
        expect(body.data!.status).toBe("active");
        expect(body.data!.currentWeek).toBe(1);
      });

      it("should generate workouts for first week", async () => {
        await app.request("/api/workouts/training-blocks", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            id: TEST_BLOCK_ID,
            programId: TEST_PROGRAM_ID,
            startDate: "2024-01-01",
          }),
        });

        // Check workouts were created
        const createdWorkouts = await db
          .select()
          .from(workouts)
          .where(eq(workouts.trainingBlockId, TEST_BLOCK_ID));

        expect(createdWorkouts.length).toBe(2); // 2 sessions in template
      });

      it("should return 404 if program not found", async () => {
        const res = await app.request("/api/workouts/training-blocks", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            id: TEST_BLOCK_ID,
            programId: "non-existent-program",
            startDate: "2024-01-01",
          }),
        });
        expect(res.status).toBe(404);

        const body = (await res.json()) as ApiResponse;
        expect(body.error).toBe("Program not found");
      });

      it("should return 409 if user already has active block", async () => {
        // Create first block
        await db.insert(trainingBlocks).values({
          id: TEST_BLOCK_ID,
          userId: TEST_USER_ID,
          programId: TEST_PROGRAM_ID,
          startDate: "2024-01-01",
          currentWeek: 1,
          status: "active",
        });

        // Try to create another
        const res = await app.request("/api/workouts/training-blocks", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            id: "test-block-second",
            programId: TEST_PROGRAM_ID,
            startDate: "2024-02-01",
          }),
        });
        expect(res.status).toBe(409);

        const body = (await res.json()) as ApiResponse;
        expect(body.error).toContain("active training block");
      });
    });

    describe("GET /api/workouts/training-blocks/:id", () => {
      it("should return training block with program details", async () => {
        await db.insert(trainingBlocks).values({
          id: TEST_BLOCK_ID,
          userId: TEST_USER_ID,
          programId: TEST_PROGRAM_ID,
          startDate: "2024-01-01",
          currentWeek: 1,
          status: "active",
        });

        const res = await app.request(`/api/workouts/training-blocks/${TEST_BLOCK_ID}`, {
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<{
          trainingBlock: TrainingBlockData;
          program: { id: string; name: string };
        }>;
        expect(body.data).toBeDefined();
        expect(body.data!.trainingBlock.id).toBe(TEST_BLOCK_ID);
        expect(body.data!.program.id).toBe(TEST_PROGRAM_ID);
      });

      it("should return 403 for non-owner", async () => {
        await db.insert(users).values(otherUser);
        await db.insert(trainingBlocks).values({
          id: OTHER_BLOCK_ID,
          userId: OTHER_USER_ID,
          programId: TEST_PROGRAM_ID,
          startDate: "2024-01-01",
          currentWeek: 1,
          status: "active",
        });

        const res = await app.request(`/api/workouts/training-blocks/${OTHER_BLOCK_ID}`, {
          headers: authHeaders(),
        });
        expect(res.status).toBe(403);
      });

      it("should return 404 for non-existent block", async () => {
        const res = await app.request("/api/workouts/training-blocks/non-existent", {
          headers: authHeaders(),
        });
        expect(res.status).toBe(404);
      });
    });

    describe("PATCH /api/workouts/training-blocks/:id", () => {
      it("should update training block status", async () => {
        await db.insert(trainingBlocks).values({
          id: TEST_BLOCK_ID,
          userId: TEST_USER_ID,
          programId: TEST_PROGRAM_ID,
          startDate: "2024-01-01",
          currentWeek: 1,
          status: "active",
        });

        const res = await app.request(`/api/workouts/training-blocks/${TEST_BLOCK_ID}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ status: "paused" }),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<TrainingBlockData>;
        expect(body.data!.status).toBe("paused");
      });

      it("should update current week", async () => {
        await db.insert(trainingBlocks).values({
          id: TEST_BLOCK_ID,
          userId: TEST_USER_ID,
          programId: TEST_PROGRAM_ID,
          startDate: "2024-01-01",
          currentWeek: 1,
          status: "active",
        });

        const res = await app.request(`/api/workouts/training-blocks/${TEST_BLOCK_ID}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ currentWeek: 2 }),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<TrainingBlockData>;
        expect(body.data!.currentWeek).toBe(2);
      });

      it("should return 403 for non-owner", async () => {
        await db.insert(users).values(otherUser);
        await db.insert(trainingBlocks).values({
          id: OTHER_BLOCK_ID,
          userId: OTHER_USER_ID,
          programId: TEST_PROGRAM_ID,
          startDate: "2024-01-01",
          currentWeek: 1,
          status: "active",
        });

        const res = await app.request(`/api/workouts/training-blocks/${OTHER_BLOCK_ID}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ status: "paused" }),
        });
        expect(res.status).toBe(403);
      });
    });
  });

  describe("Workouts", () => {
    beforeEach(async () => {
      // Create training block and workout for tests
      await db.insert(trainingBlocks).values({
        id: TEST_BLOCK_ID,
        userId: TEST_USER_ID,
        programId: TEST_PROGRAM_ID,
        startDate: "2024-01-01",
        currentWeek: 1,
        status: "active",
      });

      await db.insert(workouts).values({
        id: TEST_WORKOUT_ID,
        trainingBlockId: TEST_BLOCK_ID,
        scheduledDate: new Date().toISOString().split("T")[0]!,
        weekNumber: 1,
        dayNumber: 1,
        status: "pending",
        plannedExercises: [
          {
            exerciseId: "barbell-bench-press",
            sets: 4,
            repRange: [6, 8],
            restSeconds: 180,
          },
        ],
      });
    });

    describe("GET /api/workouts", () => {
      it("should return user's workouts", async () => {
        const res = await app.request("/api/workouts", {
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<WorkoutData[]>;
        expect(body.data).toBeDefined();
        expect(body.data!.length).toBeGreaterThan(0);
      });

      it("should filter by training block", async () => {
        const res = await app.request(
          `/api/workouts?trainingBlockId=${TEST_BLOCK_ID}`,
          { headers: authHeaders() }
        );
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<WorkoutData[]>;
        expect(body.data!.every((w) => w.trainingBlockId === TEST_BLOCK_ID)).toBe(true);
      });

      it("should filter by status", async () => {
        const res = await app.request("/api/workouts?status=pending", {
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<WorkoutData[]>;
        expect(body.data!.every((w) => w.status === "pending")).toBe(true);
      });

      it("should not return other users' workouts", async () => {
        await db.insert(users).values(otherUser);
        await db.insert(trainingBlocks).values({
          id: OTHER_BLOCK_ID,
          userId: OTHER_USER_ID,
          programId: TEST_PROGRAM_ID,
          startDate: "2024-01-01",
          currentWeek: 1,
          status: "active",
        });
        await db.insert(workouts).values({
          id: OTHER_WORKOUT_ID,
          trainingBlockId: OTHER_BLOCK_ID,
          scheduledDate: "2024-01-01",
          weekNumber: 1,
          dayNumber: 1,
          status: "pending",
          plannedExercises: [],
        });

        const res = await app.request("/api/workouts", {
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<WorkoutData[]>;
        expect(body.data!.every((w) => w.id !== OTHER_WORKOUT_ID)).toBe(true);
      });

      it("should return 403 for accessing other user's training block", async () => {
        await db.insert(users).values(otherUser);
        await db.insert(trainingBlocks).values({
          id: OTHER_BLOCK_ID,
          userId: OTHER_USER_ID,
          programId: TEST_PROGRAM_ID,
          startDate: "2024-01-01",
          currentWeek: 1,
          status: "active",
        });

        const res = await app.request(
          `/api/workouts?trainingBlockId=${OTHER_BLOCK_ID}`,
          { headers: authHeaders() }
        );
        expect(res.status).toBe(403);
      });
    });

    describe("GET /api/workouts/:id", () => {
      it("should return workout by ID", async () => {
        const res = await app.request(`/api/workouts/${TEST_WORKOUT_ID}`, {
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<WorkoutData>;
        expect(body.data).toBeDefined();
        expect(body.data!.id).toBe(TEST_WORKOUT_ID);
      });

      it("should return 403 for non-owner", async () => {
        await db.insert(users).values(otherUser);
        await db.insert(trainingBlocks).values({
          id: OTHER_BLOCK_ID,
          userId: OTHER_USER_ID,
          programId: TEST_PROGRAM_ID,
          startDate: "2024-01-01",
          currentWeek: 1,
          status: "active",
        });
        await db.insert(workouts).values({
          id: OTHER_WORKOUT_ID,
          trainingBlockId: OTHER_BLOCK_ID,
          scheduledDate: "2024-01-01",
          weekNumber: 1,
          dayNumber: 1,
          status: "pending",
          plannedExercises: [],
        });

        const res = await app.request(`/api/workouts/${OTHER_WORKOUT_ID}`, {
          headers: authHeaders(),
        });
        expect(res.status).toBe(403);
      });

      it("should return 404 for non-existent workout", async () => {
        const res = await app.request("/api/workouts/non-existent", {
          headers: authHeaders(),
        });
        expect(res.status).toBe(404);
      });
    });

    describe("PATCH /api/workouts/:id", () => {
      it("should update workout status", async () => {
        const res = await app.request(`/api/workouts/${TEST_WORKOUT_ID}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ status: "in_progress" }),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<WorkoutData>;
        expect(body.data!.status).toBe("in_progress");
      });

      it("should update planned exercises", async () => {
        const newExercises = [
          {
            exerciseId: "dumbbell-bench-press",
            sets: 3,
            repRange: [8, 12],
            restSeconds: 90,
          },
        ];

        const res = await app.request(`/api/workouts/${TEST_WORKOUT_ID}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ plannedExercises: newExercises }),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<WorkoutData>;
        expect(body.data!.plannedExercises).toEqual(newExercises);
      });

      it("should return 403 for non-owner", async () => {
        await db.insert(users).values(otherUser);
        await db.insert(trainingBlocks).values({
          id: OTHER_BLOCK_ID,
          userId: OTHER_USER_ID,
          programId: TEST_PROGRAM_ID,
          startDate: "2024-01-01",
          currentWeek: 1,
          status: "active",
        });
        await db.insert(workouts).values({
          id: OTHER_WORKOUT_ID,
          trainingBlockId: OTHER_BLOCK_ID,
          scheduledDate: "2024-01-01",
          weekNumber: 1,
          dayNumber: 1,
          status: "pending",
          plannedExercises: [],
        });

        const res = await app.request(`/api/workouts/${OTHER_WORKOUT_ID}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ status: "in_progress" }),
        });
        expect(res.status).toBe(403);
      });
    });

    describe("POST /api/workouts/:id/start", () => {
      it("should start a pending workout", async () => {
        const res = await app.request(`/api/workouts/${TEST_WORKOUT_ID}/start`, {
          method: "POST",
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<WorkoutData>;
        expect(body.data!.status).toBe("in_progress");
      });

      it("should return 400 if already started", async () => {
        // Start it first
        await app.request(`/api/workouts/${TEST_WORKOUT_ID}/start`, {
          method: "POST",
          headers: authHeaders(),
        });

        // Try to start again
        const res = await app.request(`/api/workouts/${TEST_WORKOUT_ID}/start`, {
          method: "POST",
          headers: authHeaders(),
        });
        expect(res.status).toBe(400);
      });

      it("should return 403 for non-owner", async () => {
        await db.insert(users).values(otherUser);
        await db.insert(trainingBlocks).values({
          id: OTHER_BLOCK_ID,
          userId: OTHER_USER_ID,
          programId: TEST_PROGRAM_ID,
          startDate: "2024-01-01",
          currentWeek: 1,
          status: "active",
        });
        await db.insert(workouts).values({
          id: OTHER_WORKOUT_ID,
          trainingBlockId: OTHER_BLOCK_ID,
          scheduledDate: "2024-01-01",
          weekNumber: 1,
          dayNumber: 1,
          status: "pending",
          plannedExercises: [],
        });

        const res = await app.request(`/api/workouts/${OTHER_WORKOUT_ID}/start`, {
          method: "POST",
          headers: authHeaders(),
        });
        expect(res.status).toBe(403);
      });
    });

    describe("POST /api/workouts/:id/complete", () => {
      it("should complete a workout", async () => {
        // Start it first
        await app.request(`/api/workouts/${TEST_WORKOUT_ID}/start`, {
          method: "POST",
          headers: authHeaders(),
        });

        const res = await app.request(`/api/workouts/${TEST_WORKOUT_ID}/complete`, {
          method: "POST",
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<WorkoutData>;
        expect(body.data!.status).toBe("completed");
      });

      it("should return 400 if already completed", async () => {
        // Start and complete
        await app.request(`/api/workouts/${TEST_WORKOUT_ID}/start`, {
          method: "POST",
          headers: authHeaders(),
        });
        await app.request(`/api/workouts/${TEST_WORKOUT_ID}/complete`, {
          method: "POST",
          headers: authHeaders(),
        });

        // Try to complete again
        const res = await app.request(`/api/workouts/${TEST_WORKOUT_ID}/complete`, {
          method: "POST",
          headers: authHeaders(),
        });
        expect(res.status).toBe(400);
      });
    });

    describe("POST /api/workouts/:id/skip", () => {
      it("should skip a pending workout", async () => {
        const res = await app.request(`/api/workouts/${TEST_WORKOUT_ID}/skip`, {
          method: "POST",
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<WorkoutData>;
        expect(body.data!.status).toBe("skipped");
      });

      it("should return 400 if already completed", async () => {
        // Start and complete
        await app.request(`/api/workouts/${TEST_WORKOUT_ID}/start`, {
          method: "POST",
          headers: authHeaders(),
        });
        await app.request(`/api/workouts/${TEST_WORKOUT_ID}/complete`, {
          method: "POST",
          headers: authHeaders(),
        });

        // Try to skip
        const res = await app.request(`/api/workouts/${TEST_WORKOUT_ID}/skip`, {
          method: "POST",
          headers: authHeaders(),
        });
        expect(res.status).toBe(400);
      });
    });
  });

  describe("Convenience Endpoints", () => {
    beforeEach(async () => {
      await db.insert(trainingBlocks).values({
        id: TEST_BLOCK_ID,
        userId: TEST_USER_ID,
        programId: TEST_PROGRAM_ID,
        startDate: "2024-01-01",
        currentWeek: 1,
        status: "active",
      });
    });

    describe("GET /api/workouts/today", () => {
      it("should return today's workout", async () => {
        const today = new Date().toISOString().split("T")[0]!;
        await db.insert(workouts).values({
          id: TEST_WORKOUT_ID,
          trainingBlockId: TEST_BLOCK_ID,
          scheduledDate: today,
          weekNumber: 1,
          dayNumber: 1,
          status: "pending",
          plannedExercises: [
            {
              exerciseId: "barbell-bench-press",
              sets: 4,
              repRange: [6, 8],
              restSeconds: 180,
            },
          ],
        });

        const res = await app.request("/api/workouts/today", {
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<{ workout: WorkoutData }>;
        expect(body.data).toBeDefined();
        expect(body.data!.workout).toBeDefined();
        expect(body.data!.workout.scheduledDate).toBe(today);
      });

      it("should return null if no workout today", async () => {
        // Don't create a workout for today
        const res = await app.request("/api/workouts/today", {
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<null>;
        expect(body.data).toBeNull();
        expect(body.message).toBe("No workout scheduled for today");
      });

      it("should return null if no active training block", async () => {
        // Delete the active block
        await db.delete(trainingBlocks).where(eq(trainingBlocks.id, TEST_BLOCK_ID));

        const res = await app.request("/api/workouts/today", {
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<null>;
        expect(body.data).toBeNull();
        expect(body.message).toBe("No active training block");
      });
    });

    describe("GET /api/workouts/recent", () => {
      it("should return recent completed workouts", async () => {
        // Create completed workouts
        await db.insert(workouts).values([
          {
            id: TEST_WORKOUT_ID,
            trainingBlockId: TEST_BLOCK_ID,
            scheduledDate: "2024-01-01",
            weekNumber: 1,
            dayNumber: 1,
            status: "completed",
            plannedExercises: [],
          },
          {
            id: "test-workout-002",
            trainingBlockId: TEST_BLOCK_ID,
            scheduledDate: "2024-01-03",
            weekNumber: 1,
            dayNumber: 2,
            status: "completed",
            plannedExercises: [],
          },
        ]);

        const res = await app.request("/api/workouts/recent", {
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<WorkoutData[]>;
        expect(body.data).toBeDefined();
        expect(body.data!.length).toBe(2);
        expect(body.data!.every((w) => w.status === "completed")).toBe(true);
      });

      it("should respect limit parameter", async () => {
        // Create multiple completed workouts
        await db.insert(workouts).values([
          {
            id: TEST_WORKOUT_ID,
            trainingBlockId: TEST_BLOCK_ID,
            scheduledDate: "2024-01-01",
            weekNumber: 1,
            dayNumber: 1,
            status: "completed",
            plannedExercises: [],
          },
          {
            id: "test-workout-002",
            trainingBlockId: TEST_BLOCK_ID,
            scheduledDate: "2024-01-03",
            weekNumber: 1,
            dayNumber: 2,
            status: "completed",
            plannedExercises: [],
          },
          {
            id: "test-workout-003",
            trainingBlockId: TEST_BLOCK_ID,
            scheduledDate: "2024-01-05",
            weekNumber: 1,
            dayNumber: 3,
            status: "completed",
            plannedExercises: [],
          },
        ]);

        const res = await app.request("/api/workouts/recent?limit=2", {
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<WorkoutData[]>;
        expect(body.data!.length).toBe(2);
      });

      it("should return empty array if no completed workouts", async () => {
        const res = await app.request("/api/workouts/recent", {
          headers: authHeaders(),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<WorkoutData[]>;
        expect(body.data).toEqual([]);
      });
    });
  });
});
