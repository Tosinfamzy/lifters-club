import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { Hono } from "hono";
import { openapi } from "../openapi";
import { db } from "@gymapp/db";
import { programs, trainingBlocks, workouts } from "@gymapp/db/schema";
import { like } from "drizzle-orm";

// Create a test app with the OpenAPI routes
const app = new Hono();
app.route("/api", openapi);

// Type for API responses
interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

interface ProgramTemplate {
  weeks: number;
  sessions: Array<{
    dayNumber: number;
    name: string;
    focus: string[];
    exercises: Array<{
      exerciseId: string;
      sets: number;
      repRange: [number, number];
      restSeconds: number;
      notes?: string;
    }>;
  }>;
}

interface ProgramData {
  id: string;
  name: string;
  description: string | null;
  daysPerWeek: number;
  goal: "strength" | "hypertrophy" | "conditioning";
  level: "beginner" | "intermediate" | "advanced";
  template: ProgramTemplate;
  createdAt: string;
  updatedAt: string;
}

// Test program data
const testProgram = {
  id: "test-program-001",
  name: "Test Strength Program",
  description: "A test program for API testing",
  daysPerWeek: 3,
  goal: "strength" as const,
  level: "beginner" as const,
  template: {
    weeks: 4,
    sessions: [
      {
        dayNumber: 1,
        name: "Push Day",
        focus: ["chest", "shoulders", "triceps"],
        exercises: [
          {
            exerciseId: "barbell-bench-press",
            sets: 4,
            repRange: [6, 8] as [number, number],
            restSeconds: 180,
            notes: "Focus on form",
          },
        ],
      },
      {
        dayNumber: 3,
        name: "Pull Day",
        focus: ["back", "biceps"],
        exercises: [
          {
            exerciseId: "barbell-row",
            sets: 4,
            repRange: [6, 8] as [number, number],
            restSeconds: 180,
          },
        ],
      },
      {
        dayNumber: 5,
        name: "Legs Day",
        focus: ["quadriceps", "hamstrings", "glutes"],
        exercises: [
          {
            exerciseId: "barbell-back-squat",
            sets: 4,
            repRange: [6, 8] as [number, number],
            restSeconds: 180,
          },
        ],
      },
    ],
  },
};

// Second test program for filtering tests
const testProgram2 = {
  id: "test-program-002",
  name: "Test Hypertrophy Program",
  description: "A hypertrophy focused test program",
  daysPerWeek: 4,
  goal: "hypertrophy" as const,
  level: "intermediate" as const,
  template: {
    weeks: 6,
    sessions: [
      {
        dayNumber: 1,
        name: "Upper Body",
        focus: ["chest", "back", "shoulders"],
        exercises: [
          {
            exerciseId: "barbell-bench-press",
            sets: 4,
            repRange: [8, 12] as [number, number],
            restSeconds: 90,
          },
        ],
      },
    ],
  },
};

// Helper to clean up test programs (FK-safe order: workouts -> training_blocks -> programs)
// Use specific patterns to only match this file's IDs and avoid deleting
// programs from other test files (e.g., workouts.test.ts uses "test-program-workouts")
async function cleanupTestPrograms() {
  await db.delete(workouts).where(like(workouts.trainingBlockId, "test-block-programs-%"));
  await db.delete(trainingBlocks).where(like(trainingBlocks.programId, "test-program-0%"));
  await db.delete(programs).where(like(programs.id, "test-program-0%"));
  await db.delete(programs).where(like(programs.id, "test-minimal-%"));
}

describe("Programs API", () => {
  beforeEach(async () => {
    // Clean up test programs before each test
    await cleanupTestPrograms();
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestPrograms();
  });

  describe("GET /api/programs", () => {
    it("should return a list of programs", async () => {
      // Create test programs first
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram),
      });

      const res = await app.request("/api/programs");
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<ProgramData[]>;
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("should respect limit and offset parameters", async () => {
      // Create two test programs
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram),
      });
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram2),
      });

      const res = await app.request("/api/programs?limit=1&offset=0");
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<ProgramData[]>;
      expect(body.data!.length).toBeLessThanOrEqual(1);
    });

    it("should filter programs by goal", async () => {
      // Create test programs with different goals
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram), // strength
      });
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram2), // hypertrophy
      });

      const res = await app.request("/api/programs?goal=strength");
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<ProgramData[]>;
      expect(body.data!.every((p) => p.goal === "strength")).toBe(true);
    });

    it("should filter programs by level", async () => {
      // Create test programs with different levels
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram), // beginner
      });
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram2), // intermediate
      });

      const res = await app.request("/api/programs?level=beginner");
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<ProgramData[]>;
      expect(body.data!.every((p) => p.level === "beginner")).toBe(true);
    });

    it("should filter programs by daysPerWeek", async () => {
      // Create test programs
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram), // 3 days
      });
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram2), // 4 days
      });

      const res = await app.request("/api/programs?daysPerWeek=3");
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<ProgramData[]>;
      expect(body.data!.every((p) => p.daysPerWeek === 3)).toBe(true);
    });

    it("should combine multiple filters", async () => {
      // Create test programs
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram),
      });
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram2),
      });

      const res = await app.request(
        "/api/programs?goal=strength&level=beginner&daysPerWeek=3"
      );
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<ProgramData[]>;
      expect(
        body.data!.every(
          (p) =>
            p.goal === "strength" && p.level === "beginner" && p.daysPerWeek === 3
        )
      ).toBe(true);
    });
  });

  describe("GET /api/programs/:id", () => {
    it("should return a single program by ID", async () => {
      // Create test program first
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram),
      });

      const res = await app.request(`/api/programs/${testProgram.id}`);
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<ProgramData>;
      expect(body.data).toBeDefined();
      expect(body.data!.id).toBe(testProgram.id);
      expect(body.data!.name).toBe(testProgram.name);
      expect(body.data!.description).toBe(testProgram.description);
      expect(body.data!.daysPerWeek).toBe(testProgram.daysPerWeek);
      expect(body.data!.goal).toBe(testProgram.goal);
      expect(body.data!.level).toBe(testProgram.level);
    });

    it("should return 404 for non-existent program", async () => {
      const res = await app.request("/api/programs/non-existent-program");
      expect(res.status).toBe(404);

      const body = (await res.json()) as ApiResponse;
      expect(body.error).toBe("Program not found");
    });
  });

  describe("POST /api/programs", () => {
    it("should create a new program", async () => {
      const res = await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram),
      });
      expect(res.status).toBe(201);

      const body = (await res.json()) as ApiResponse<ProgramData>;
      expect(body.data!.id).toBe(testProgram.id);
      expect(body.data!.name).toBe(testProgram.name);
      expect(body.data!.description).toBe(testProgram.description);
      expect(body.data!.daysPerWeek).toBe(testProgram.daysPerWeek);
      expect(body.data!.goal).toBe(testProgram.goal);
      expect(body.data!.level).toBe(testProgram.level);
      expect(body.data!.template).toBeDefined();
    });

    it("should return 409 if program ID already exists", async () => {
      // First create
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram),
      });

      // Try to create again with same ID
      const res = await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram),
      });
      expect(res.status).toBe(409);

      const body = (await res.json()) as ApiResponse;
      expect(body.error).toContain("already exists");
    });

    it("should validate required fields", async () => {
      const res = await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "invalid" }), // Missing required fields
      });
      expect(res.status).toBe(400);
    });

    it("should validate program ID format", async () => {
      const invalidProgram = {
        ...testProgram,
        id: "INVALID ID WITH SPACES", // Invalid format
      };

      const res = await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidProgram),
      });
      expect(res.status).toBe(400);
    });

    it("should validate daysPerWeek range", async () => {
      const invalidProgram = {
        ...testProgram,
        id: "test-invalid-days",
        daysPerWeek: 10, // Invalid: max is 7
      };

      const res = await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidProgram),
      });
      expect(res.status).toBe(400);
    });

    it("should validate goal enum", async () => {
      const invalidProgram = {
        ...testProgram,
        id: "test-invalid-goal",
        goal: "invalid-goal", // Invalid enum value
      };

      const res = await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidProgram),
      });
      expect(res.status).toBe(400);
    });

    it("should validate level enum", async () => {
      const invalidProgram = {
        ...testProgram,
        id: "test-invalid-level",
        level: "expert", // Invalid enum value
      };

      const res = await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidProgram),
      });
      expect(res.status).toBe(400);
    });

    it("should create program with minimal template", async () => {
      const minimalProgram = {
        id: "test-minimal-program",
        name: "Minimal Program",
        daysPerWeek: 2,
        goal: "conditioning" as const,
        level: "beginner" as const,
        template: {
          weeks: 1,
          sessions: [
            {
              dayNumber: 1,
              name: "Day 1",
              focus: ["full_body"],
              exercises: [
                {
                  exerciseId: "barbell-back-squat",
                  sets: 3,
                  repRange: [5, 5] as [number, number],
                  restSeconds: 120,
                },
              ],
            },
          ],
        },
      };

      const res = await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(minimalProgram),
      });
      expect(res.status).toBe(201);

      const body = (await res.json()) as ApiResponse<ProgramData>;
      expect(body.data!.id).toBe(minimalProgram.id);
    });
  });

  describe("PATCH /api/programs/:id", () => {
    it("should partially update a program name", async () => {
      // Create test program first
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram),
      });

      // Update it
      const res = await app.request(`/api/programs/${testProgram.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Program Name" }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<ProgramData>;
      expect(body.data!.name).toBe("Updated Program Name");
      // Original fields should be unchanged
      expect(body.data!.goal).toBe(testProgram.goal);
      expect(body.data!.level).toBe(testProgram.level);
      expect(body.data!.daysPerWeek).toBe(testProgram.daysPerWeek);
    });

    it("should update program description", async () => {
      // Create test program first
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram),
      });

      // Update description
      const res = await app.request(`/api/programs/${testProgram.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "New description for the program" }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<ProgramData>;
      expect(body.data!.description).toBe("New description for the program");
    });

    it("should update program goal", async () => {
      // Create test program first
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram),
      });

      // Update goal
      const res = await app.request(`/api/programs/${testProgram.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "hypertrophy" }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<ProgramData>;
      expect(body.data!.goal).toBe("hypertrophy");
    });

    it("should update program level", async () => {
      // Create test program first
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram),
      });

      // Update level
      const res = await app.request(`/api/programs/${testProgram.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: "advanced" }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<ProgramData>;
      expect(body.data!.level).toBe("advanced");
    });

    it("should update multiple fields at once", async () => {
      // Create test program first
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram),
      });

      // Update multiple fields
      const res = await app.request(`/api/programs/${testProgram.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Completely Updated Program",
          daysPerWeek: 5,
          goal: "conditioning",
          level: "intermediate",
        }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<ProgramData>;
      expect(body.data!.name).toBe("Completely Updated Program");
      expect(body.data!.daysPerWeek).toBe(5);
      expect(body.data!.goal).toBe("conditioning");
      expect(body.data!.level).toBe("intermediate");
    });

    it("should return 404 for non-existent program", async () => {
      const res = await app.request("/api/programs/non-existent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });
      expect(res.status).toBe(404);

      const body = (await res.json()) as ApiResponse;
      expect(body.error).toBe("Program not found");
    });

    it("should validate updated goal enum", async () => {
      // Create test program first
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram),
      });

      // Try invalid update
      const res = await app.request(`/api/programs/${testProgram.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "invalid-goal" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/programs/:id", () => {
    it("should delete a program", async () => {
      // Create test program first
      await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProgram),
      });

      // Delete it
      const res = await app.request(`/api/programs/${testProgram.id}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse;
      expect(body.message).toBe("Program deleted successfully");

      // Verify it's deleted
      const getRes = await app.request(`/api/programs/${testProgram.id}`);
      expect(getRes.status).toBe(404);
    });

    it("should return 404 for non-existent program", async () => {
      const res = await app.request("/api/programs/non-existent", {
        method: "DELETE",
      });
      expect(res.status).toBe(404);

      const body = (await res.json()) as ApiResponse;
      expect(body.error).toBe("Program not found");
    });
  });

  describe("Template Validation", () => {
    it("should validate template weeks range", async () => {
      const invalidProgram = {
        ...testProgram,
        id: "test-invalid-weeks",
        template: {
          ...testProgram.template,
          weeks: 100, // Invalid: max is 52
        },
      };

      const res = await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidProgram),
      });
      expect(res.status).toBe(400);
    });

    it("should validate session dayNumber range", async () => {
      const invalidProgram = {
        ...testProgram,
        id: "test-invalid-day",
        template: {
          weeks: 4,
          sessions: [
            {
              dayNumber: 10, // Invalid: max is 7
              name: "Invalid Day",
              focus: ["chest"],
              exercises: [
                {
                  exerciseId: "barbell-bench-press",
                  sets: 3,
                  repRange: [8, 12] as [number, number],
                  restSeconds: 90,
                },
              ],
            },
          ],
        },
      };

      const res = await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidProgram),
      });
      expect(res.status).toBe(400);
    });

    it("should validate exercise sets range", async () => {
      const invalidProgram = {
        ...testProgram,
        id: "test-invalid-sets",
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
                  sets: 15, // Invalid: max is 10
                  repRange: [8, 12] as [number, number],
                  restSeconds: 90,
                },
              ],
            },
          ],
        },
      };

      const res = await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidProgram),
      });
      expect(res.status).toBe(400);
    });

    it("should validate rest seconds range", async () => {
      const invalidProgram = {
        ...testProgram,
        id: "test-invalid-rest",
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
                  sets: 3,
                  repRange: [8, 12] as [number, number],
                  restSeconds: 1000, // Invalid: max is 600
                },
              ],
            },
          ],
        },
      };

      const res = await app.request("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidProgram),
      });
      expect(res.status).toBe(400);
    });
  });
});
