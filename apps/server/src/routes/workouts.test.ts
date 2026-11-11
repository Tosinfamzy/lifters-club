import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { db } from "@gymapp/db";
import { users, programs, trainingBlocks, workouts, workoutLogs, loggedSets, standaloneWorkouts } from "@gymapp/db/schema";
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

function blockFixture(id: string) {
  return {
    id,
    userId: TEST_USER_ID,
    programId: TEST_PROGRAM_ID,
    startDate: "2026-01-01",
    currentWeek: 1,
  };
}

// Cleanup helper
async function cleanupTestData() {
  await db.delete(loggedSets).where(like(loggedSets.workoutLogId, "test-log-%"));
  await db.delete(workoutLogs).where(like(workoutLogs.userId, "test-user-workouts-%"));
  await db.delete(standaloneWorkouts).where(like(standaloneWorkouts.userId, "test-user-workouts-%"));
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

      it("returns 409 when resuming while another block is active", async () => {
        await db.insert(trainingBlocks).values([
          { ...blockFixture(TEST_BLOCK_ID), status: "active" },
          { ...blockFixture("test-block-paused"), status: "paused" },
        ]);

        const res = await app.request("/api/workouts/training-blocks/test-block-paused", {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ status: "active" }),
        });
        expect(res.status).toBe(409);

        const body = (await res.json()) as ApiResponse & { activeBlockId?: string };
        expect(body.error).toBe("Another training block is already active");
        expect(body.activeBlockId).toBe(TEST_BLOCK_ID);

        const [unchanged] = await db.select().from(trainingBlocks).where(eq(trainingBlocks.id, "test-block-paused"));
        expect(unchanged!.status).toBe("paused");
      });

      it("resumes a paused block when no other block is active", async () => {
        await db.insert(trainingBlocks).values([
          { ...blockFixture("test-block-paused"), status: "paused" },
          { ...blockFixture("test-block-completed"), status: "completed" },
        ]);

        const res = await app.request("/api/workouts/training-blocks/test-block-paused", {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ status: "active" }),
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<TrainingBlockData>;
        expect(body.data!.status).toBe("active");
      });

      it("ignores other users' active blocks when resuming", async () => {
        await db.insert(users).values(otherUser);
        await db.insert(trainingBlocks).values([
          { ...blockFixture(OTHER_BLOCK_ID), userId: OTHER_USER_ID, status: "active" },
          { ...blockFixture("test-block-paused"), status: "paused" },
        ]);

        const res = await app.request("/api/workouts/training-blocks/test-block-paused", {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ status: "active" }),
        });
        expect(res.status).toBe(200);
      });

      it("allows setting an already-active block to active", async () => {
        await db.insert(trainingBlocks).values({ ...blockFixture(TEST_BLOCK_ID), status: "active" });

        const res = await app.request(`/api/workouts/training-blocks/${TEST_BLOCK_ID}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ status: "active" }),
        });
        expect(res.status).toBe(200);
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

        const body = (await res.json()) as ApiResponse<{ programWorkout: WorkoutData; standaloneWorkouts: unknown[]; decisions: unknown[] }>;
        expect(body.data).toBeDefined();
        expect(body.data!.programWorkout).toBeDefined();
        expect(body.data!.programWorkout.scheduledDate).toBe(today);
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
        expect(body.message).toBe("No workout scheduled for today");
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

  describe("GET /api/workouts/calendar", () => {
    interface CalendarDayData {
      date: string;
      scheduled: Array<{
        kind: "program" | "standalone";
        id: string;
        name: string;
        status: string;
        weekNumber?: number;
        dayNumber?: number;
      }>;
      completedCount: number;
      durationSeconds: number;
      volume: number;
    }

    async function getCalendarDays(query: string) {
      const res = await app.request(`/api/workouts/calendar?${query}`, { headers: authHeaders() });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<{ days: CalendarDayData[] }>;
      return body.data!.days;
    }

    function dayOf(days: CalendarDayData[], date: string): CalendarDayData {
      const day = days.find((d) => d.date === date);
      expect(day).toBeDefined();
      return day!;
    }

    function programWorkout(id: string, blockId: string, scheduledDate: string, dayNumber: number) {
      return {
        id,
        trainingBlockId: blockId,
        scheduledDate,
        weekNumber: 1,
        dayNumber,
        status: "pending",
        plannedExercises: [],
      };
    }

    function standaloneWorkout(id: string, userId: string, name: string, scheduledDate: string) {
      return { id, userId, name, scheduledDate, plannedExercises: [], focusMuscles: [] };
    }

    function completedLog(id: string, userId: string, startedAt: string, completedAt: string | null) {
      return {
        id,
        userId,
        startedAt: new Date(startedAt),
        completedAt: completedAt ? new Date(completedAt) : null,
      };
    }

    function loggedSet(id: string, workoutLogId: string, setNumber: number, weight: number, reps: number) {
      return { id, workoutLogId, exerciseId: "barbell-bench-press", setNumber, weight, reps };
    }

    it("returns one zero-filled entry per day in the range", async () => {
      const days = await getCalendarDays("from=2026-01-30&to=2026-02-02&tz=UTC");

      expect(days.map((d) => d.date)).toEqual(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
      for (const day of days) {
        expect(day).toEqual({ date: day.date, scheduled: [], completedCount: 0, durationSeconds: 0, volume: 0 });
      }
    });

    it("names program workouts from the template and includes paused blocks", async () => {
      await db.insert(trainingBlocks).values([
        { ...blockFixture(TEST_BLOCK_ID), status: "active" },
        { ...blockFixture("test-block-paused"), status: "paused" },
        { ...blockFixture("test-block-completed"), status: "completed" },
      ]);
      await db.insert(workouts).values([
        programWorkout("test-workout-cal-d3", TEST_BLOCK_ID, "2026-01-05", 3),
        programWorkout("test-workout-cal-d5", TEST_BLOCK_ID, "2026-01-07", 5),
        programWorkout("test-workout-cal-paused", "test-block-paused", "2026-01-06", 1),
        programWorkout("test-workout-cal-completed", "test-block-completed", "2026-01-06", 1),
        programWorkout("test-workout-cal-outside", TEST_BLOCK_ID, "2026-01-08", 1),
      ]);

      const days = await getCalendarDays("from=2026-01-05&to=2026-01-07&tz=UTC");

      expect(dayOf(days, "2026-01-05").scheduled).toEqual([
        { kind: "program", id: "test-workout-cal-d3", name: "Day 2", status: "pending", weekNumber: 1, dayNumber: 3 },
      ]);
      expect(dayOf(days, "2026-01-06").scheduled.map((w) => w.id)).toEqual(["test-workout-cal-paused"]);
      expect(dayOf(days, "2026-01-06").scheduled[0]!.name).toBe("Day 1");
      // dayNumber 5 has no template session, so the name falls back
      expect(dayOf(days, "2026-01-07").scheduled[0]!.name).toBe("Day 5");
    });

    it("includes standalone workouts by scheduled date", async () => {
      await db.insert(standaloneWorkouts).values([
        standaloneWorkout("test-sw-cal-1", TEST_USER_ID, "Arms Pump", "2026-01-05"),
        standaloneWorkout("test-sw-cal-2", TEST_USER_ID, "Out of range", "2026-01-09"),
      ]);

      const days = await getCalendarDays("from=2026-01-05&to=2026-01-07&tz=UTC");

      expect(dayOf(days, "2026-01-05").scheduled).toEqual([
        { kind: "standalone", id: "test-sw-cal-1", name: "Arms Pump", status: "pending" },
      ]);
      expect(days.flatMap((d) => d.scheduled)).toHaveLength(1);
    });

    it("aggregates duration and volume across multiple logs and sets without double counting", async () => {
      await db.insert(workoutLogs).values([
        completedLog("test-log-cal-1", TEST_USER_ID, "2026-01-05T10:00:00Z", "2026-01-05T11:00:00Z"),
        completedLog("test-log-cal-2", TEST_USER_ID, "2026-01-05T18:00:00Z", "2026-01-05T18:30:00Z"),
        completedLog("test-log-cal-open", TEST_USER_ID, "2026-01-05T20:00:00Z", null),
        completedLog("test-log-cal-3", TEST_USER_ID, "2026-01-06T09:00:00Z", "2026-01-06T09:45:00Z"),
      ]);
      await db.insert(loggedSets).values([
        loggedSet("test-set-cal-1", "test-log-cal-1", 1, 100, 5),
        loggedSet("test-set-cal-2", "test-log-cal-1", 2, 100, 5),
        loggedSet("test-set-cal-3", "test-log-cal-1", 3, 80, 8),
        loggedSet("test-set-cal-4", "test-log-cal-2", 1, 50, 10),
        loggedSet("test-set-cal-5", "test-log-cal-2", 2, 50, 10),
        loggedSet("test-set-cal-6", "test-log-cal-open", 1, 200, 10),
      ]);

      const days = await getCalendarDays("from=2026-01-05&to=2026-01-07&tz=UTC");

      // 3600s + 1800s; volume 500 + 500 + 640 + 500 + 500. The open log is excluded.
      expect(dayOf(days, "2026-01-05")).toMatchObject({ completedCount: 2, durationSeconds: 5400, volume: 2640 });
      // A completed log with no sets still counts towards duration
      expect(dayOf(days, "2026-01-06")).toMatchObject({ completedCount: 1, durationSeconds: 2700, volume: 0 });
      expect(dayOf(days, "2026-01-07")).toMatchObject({ completedCount: 0, durationSeconds: 0, volume: 0 });
    });

    it("buckets completed logs by the local date in the requested time zone", async () => {
      await db.insert(workoutLogs).values(
        completedLog("test-log-cal-late", TEST_USER_ID, "2026-01-05T23:00:00Z", "2026-01-05T23:30:00Z")
      );
      await db.insert(loggedSets).values(loggedSet("test-set-cal-late", "test-log-cal-late", 1, 100, 10));

      const utcDays = await getCalendarDays("from=2026-01-05&to=2026-01-06&tz=UTC");
      expect(dayOf(utcDays, "2026-01-05")).toMatchObject({ completedCount: 1, durationSeconds: 1800, volume: 1000 });
      expect(dayOf(utcDays, "2026-01-06").completedCount).toBe(0);

      const berlinDays = await getCalendarDays("from=2026-01-05&to=2026-01-06&tz=Europe/Berlin");
      expect(dayOf(berlinDays, "2026-01-05").completedCount).toBe(0);
      expect(dayOf(berlinDays, "2026-01-06")).toMatchObject({ completedCount: 1, durationSeconds: 1800, volume: 1000 });

      // The log falls outside a Berlin range that ends on 2026-01-05
      const berlinEdge = await getCalendarDays("from=2026-01-05&to=2026-01-05&tz=Europe/Berlin");
      expect(dayOf(berlinEdge, "2026-01-05").completedCount).toBe(0);
    });

    it("never returns another user's workouts or logs", async () => {
      await db.insert(users).values(otherUser);
      await db.insert(trainingBlocks).values({ ...blockFixture(OTHER_BLOCK_ID), userId: OTHER_USER_ID, status: "active" });
      await db.insert(workouts).values(programWorkout("test-workout-cal-other", OTHER_BLOCK_ID, "2026-01-05", 1));
      await db.insert(standaloneWorkouts).values(
        standaloneWorkout("test-sw-cal-other", OTHER_USER_ID, "Not mine", "2026-01-05")
      );
      await db.insert(workoutLogs).values(
        completedLog("test-log-cal-other", OTHER_USER_ID, "2026-01-05T10:00:00Z", "2026-01-05T11:00:00Z")
      );
      await db.insert(loggedSets).values(loggedSet("test-set-cal-other", "test-log-cal-other", 1, 100, 5));

      const days = await getCalendarDays("from=2026-01-05&to=2026-01-05&tz=UTC");

      expect(days).toEqual([{ date: "2026-01-05", scheduled: [], completedCount: 0, durationSeconds: 0, volume: 0 }]);
    });

    it("accepts device-reported zone aliases and the maximum 62-day range", async () => {
      const kolkata = await getCalendarDays("from=2026-01-01&to=2026-01-01&tz=Asia/Kolkata");
      expect(kolkata).toHaveLength(1);

      const maxRange = await getCalendarDays("from=2026-01-01&to=2026-03-03&tz=UTC");
      expect(maxRange).toHaveLength(62);
    });

    it.each([
      ["an unknown time zone", "from=2026-01-01&to=2026-01-07&tz=Mars/Olympus"],
      ["a UTC offset instead of a zone name", "from=2026-01-01&to=2026-01-07&tz=%2B05:00"],
      ["a missing time zone", "from=2026-01-01&to=2026-01-07"],
      ["from after to", "from=2026-01-08&to=2026-01-07&tz=UTC"],
      ["a range over 62 days", "from=2026-01-01&to=2026-03-04&tz=UTC"],
      ["a malformed date", "from=2026-1-01&to=2026-01-07&tz=UTC"],
      ["an impossible date", "from=2026-02-30&to=2026-03-02&tz=UTC"],
    ])("returns 400 for %s", async (_label, query) => {
      const res = await app.request(`/api/workouts/calendar?${query}`, { headers: authHeaders() });
      expect(res.status).toBe(400);
    });

    it("returns 401 without authentication", async () => {
      const res = await app.request("/api/workouts/calendar?from=2026-01-01&to=2026-01-07&tz=UTC");
      expect(res.status).toBe(401);
    });
  });
});
