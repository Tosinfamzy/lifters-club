import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Hono } from "hono";
import { openapi } from "../openapi";
import { db } from "@gymapp/db";
import { exercises } from "@gymapp/db/schema";
import { eq } from "drizzle-orm";

// Create a test app with the OpenAPI routes
const app = new Hono();
app.route("/api", openapi);

// Type for API responses
interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface ExerciseData {
  id: string;
  name: string;
  difficulty: string;
  equipment: string[];
  movementPatterns: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  isCompound: boolean;
}

interface SubstituteData {
  exercise: ExerciseData;
  score: number;
  matchReasons: string[];
}

interface SubstitutesResponse {
  sourceExercise: ExerciseData;
  substitutes: SubstituteData[];
}

// Test exercise data
const testExercise = {
  id: "test-curl",
  name: "Test Bicep Curl",
  aliases: ["Test Curl"],
  equipment: ["dumbbell"],
  movementPatterns: ["isolation_upper"],
  primaryMuscles: ["biceps"],
  secondaryMuscles: ["forearms"],
  isCompound: false,
  isUnilateral: false,
  difficulty: "beginner" as const,
  constraints: [],
};

describe("Exercise API", () => {
  beforeAll(async () => {
    // Ensure we have some seed data
    const count = await db.select().from(exercises).limit(1);
    if (count.length === 0) {
      throw new Error("Database needs to be seeded before running tests");
    }
  });

  afterAll(async () => {
    // Clean up test exercise if it exists
    await db.delete(exercises).where(eq(exercises.id, testExercise.id));
  });

  beforeEach(async () => {
    // Clean up test exercise before each test
    await db.delete(exercises).where(eq(exercises.id, testExercise.id));
  });

  describe("GET /api/exercises", () => {
    it("should return a paginated list of exercises", async () => {
      const res = await app.request("/api/exercises?limit=10");
      expect(res.status).toBe(200);

      const body = await res.json() as ApiResponse<ExerciseData[]>;
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data!.length).toBeLessThanOrEqual(10);
      expect(body.pagination).toBeDefined();
      expect(body.pagination!.total).toBeGreaterThan(0);
    });

    it("should filter exercises by difficulty", async () => {
      const res = await app.request("/api/exercises?difficulty=beginner");
      expect(res.status).toBe(200);

      const body = await res.json() as ApiResponse<ExerciseData[]>;
      expect(body.data!.every(e => e.difficulty === "beginner")).toBe(true);
    });

    it("should filter exercises by equipment", async () => {
      const res = await app.request("/api/exercises?equipment=barbell");
      expect(res.status).toBe(200);

      const body = await res.json() as ApiResponse<ExerciseData[]>;
      expect(body.data!.every(e => e.equipment.includes("barbell"))).toBe(true);
    });

    it("should search exercises by name", async () => {
      const res = await app.request("/api/exercises?search=squat");
      expect(res.status).toBe(200);

      const body = await res.json() as ApiResponse<ExerciseData[]>;
      expect(body.data!.length).toBeGreaterThan(0);
      expect(body.data!.some(e => e.name.toLowerCase().includes("squat"))).toBe(true);
    });
  });

  describe("GET /api/exercises/:id", () => {
    it("should return a single exercise by ID", async () => {
      const res = await app.request("/api/exercises/barbell-back-squat");
      expect(res.status).toBe(200);

      const body = await res.json() as ApiResponse<ExerciseData>;
      expect(body.data).toBeDefined();
      expect(body.data!.id).toBe("barbell-back-squat");
      expect(body.data!.name).toBe("Barbell Back Squat");
    });

    it("should return 404 for non-existent exercise", async () => {
      const res = await app.request("/api/exercises/non-existent-exercise");
      expect(res.status).toBe(404);

      const body = await res.json() as ApiResponse;
      expect(body.error).toBe("Exercise not found");
    });
  });

  describe("GET /api/exercises/by-pattern/:pattern", () => {
    it("should return exercises by movement pattern", async () => {
      const res = await app.request("/api/exercises/by-pattern/squat");
      expect(res.status).toBe(200);

      const body = await res.json() as ApiResponse<ExerciseData[]>;
      expect(body.data!.length).toBeGreaterThan(0);
      expect(body.data!.every(e => e.movementPatterns.includes("squat"))).toBe(true);
    });
  });

  describe("GET /api/exercises/by-muscle/:muscle", () => {
    it("should return exercises targeting a muscle", async () => {
      const res = await app.request("/api/exercises/by-muscle/chest");
      expect(res.status).toBe(200);

      const body = await res.json() as ApiResponse<ExerciseData[]>;
      expect(body.data!.length).toBeGreaterThan(0);
      expect(body.data!.every(e =>
        e.primaryMuscles.includes("chest") || e.secondaryMuscles.includes("chest")
      )).toBe(true);
    });
  });

  describe("GET /api/exercises/:id/substitutes", () => {
    it("should return substitutes for an exercise", async () => {
      const res = await app.request("/api/exercises/barbell-bench-press/substitutes");
      expect(res.status).toBe(200);

      const body = await res.json() as ApiResponse<SubstitutesResponse>;
      expect(body.data!.sourceExercise).toBeDefined();
      expect(body.data!.sourceExercise.id).toBe("barbell-bench-press");
      expect(body.data!.substitutes).toBeDefined();
      expect(Array.isArray(body.data!.substitutes)).toBe(true);
      expect(body.data!.substitutes.length).toBeGreaterThan(0);
    });

    it("should filter substitutes by equipment", async () => {
      const res = await app.request("/api/exercises/barbell-bench-press/substitutes?equipment=dumbbell,bodyweight");
      expect(res.status).toBe(200);

      const body = await res.json() as ApiResponse<SubstitutesResponse>;
      expect(body.data!.substitutes.every(s =>
        s.exercise.equipment.some(e => ["dumbbell", "bodyweight"].includes(e))
      )).toBe(true);
    });

    it("should return 404 for non-existent exercise", async () => {
      const res = await app.request("/api/exercises/non-existent/substitutes");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/exercises", () => {
    it("should create a new exercise", async () => {
      const res = await app.request("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testExercise),
      });
      expect(res.status).toBe(201);

      const body = await res.json() as ApiResponse<ExerciseData>;
      expect(body.data!.id).toBe(testExercise.id);
      expect(body.data!.name).toBe(testExercise.name);
    });

    it("should return 409 if exercise ID already exists", async () => {
      // First create
      await app.request("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testExercise),
      });

      // Try to create again
      const res = await app.request("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testExercise),
      });
      expect(res.status).toBe(409);
    });

    it("should validate required fields", async () => {
      const res = await app.request("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "invalid" }), // Missing required fields
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/exercises/:id", () => {
    it("should partially update an exercise", async () => {
      // Create test exercise first
      await app.request("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testExercise),
      });

      // Update it
      const res = await app.request(`/api/exercises/${testExercise.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name", difficulty: "intermediate" }),
      });
      expect(res.status).toBe(200);

      const body = await res.json() as ApiResponse<ExerciseData>;
      expect(body.data!.name).toBe("Updated Name");
      expect(body.data!.difficulty).toBe("intermediate");
      // Original fields should be unchanged
      expect(body.data!.isCompound).toBe(testExercise.isCompound);
    });

    it("should return 404 for non-existent exercise", async () => {
      const res = await app.request("/api/exercises/non-existent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/exercises/:id", () => {
    it("should delete an exercise", async () => {
      // Create test exercise first
      await app.request("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testExercise),
      });

      // Delete it
      const res = await app.request(`/api/exercises/${testExercise.id}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);

      // Verify it's deleted
      const getRes = await app.request(`/api/exercises/${testExercise.id}`);
      expect(getRes.status).toBe(404);
    });

    it("should return 404 for non-existent exercise", async () => {
      const res = await app.request("/api/exercises/non-existent", {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });
  });
});
