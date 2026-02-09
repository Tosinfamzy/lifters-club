import { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
import { exerciseRoutes } from "./routes/exercises";
import { programRoutes } from "./routes/programs";
import { workoutRoutes } from "./routes/workouts";
import { logRoutes } from "./routes/logs";
import { decisionRoutes } from "./routes/decisions";
import { userRoutes } from "./routes/users";
import { analyticsRoutes } from "./routes/analytics";
import { notificationRoutes } from "./routes/notifications";
import { templateRoutes } from "./routes/templates";
import { standaloneWorkoutRoutes } from "./routes/standalone-workouts";
import { weeklyPlanRoutes } from "./routes/weekly-plans";
import { authMiddleware } from "./middleware/auth";
import { publicRateLimiter } from "./middleware/rate-limit";

// Create main API router
const openapi = new Hono();

// Public routes (no auth required) - use more permissive rate limiter (200/min vs 100/min)
openapi.use("/exercises/*", publicRateLimiter);
openapi.use("/programs/*", publicRateLimiter);
openapi.route("/exercises", exerciseRoutes);
openapi.route("/programs", programRoutes); // Programs are public to browse

// Protected routes (require Clerk JWT)
// Apply auth middleware before mounting protected routers
openapi.use("/users/*", authMiddleware);
openapi.use("/workouts/*", authMiddleware);
openapi.use("/logs/*", authMiddleware);
openapi.use("/decisions/*", authMiddleware);
openapi.use("/analytics/*", authMiddleware);
openapi.use("/notifications/*", authMiddleware);
openapi.use("/templates/*", authMiddleware);
openapi.use("/standalone-workouts/*", authMiddleware);
openapi.use("/weekly-plans/*", authMiddleware);

// Mount protected routes
openapi.route("/workouts", workoutRoutes);
openapi.route("/logs", logRoutes);
openapi.route("/decisions", decisionRoutes);
openapi.route("/users", userRoutes);
openapi.route("/analytics", analyticsRoutes);
openapi.route("/notifications", notificationRoutes);
openapi.route("/templates", templateRoutes);
openapi.route("/standalone-workouts", standaloneWorkoutRoutes);
openapi.route("/weekly-plans", weeklyPlanRoutes);

// OpenAPI spec (manually maintained for documentation)
const openAPISpec = {
  openapi: "3.1.0",
  info: {
    title: "Lifters Club API",
    version: "0.1.0",
    description: "Exercise Library and Training Decision Engine API",
  },
  tags: [
    { name: "Exercises", description: "Exercise library management and querying" },
    { name: "Programs", description: "Training program templates" },
    { name: "Training Blocks", description: "User's active program instances" },
    { name: "Workouts", description: "Scheduled workout sessions" },
    { name: "Workout Templates", description: "Reusable workout blueprints (e.g., 'Back Day', 'Push Day')" },
    { name: "Standalone Workouts", description: "Single workouts not tied to programs" },
    { name: "Weekly Plans", description: "Standalone week of workouts" },
    { name: "Logs", description: "Workout logging and set tracking" },
    { name: "Decisions", description: "Training decision engine - intelligent adjustments based on performance" },
    { name: "Users", description: "User profile and readiness check-ins" },
  ],
  paths: {
    "/api/exercises": {
      get: {
        tags: ["Exercises"],
        summary: "List all exercises",
        description: "Get a paginated list of exercises with optional filtering",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 50, minimum: 1, maximum: 100 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0, minimum: 0 } },
          { name: "search", in: "query", schema: { type: "string" }, description: "Search by name or alias" },
          { name: "difficulty", in: "query", schema: { type: "string", enum: ["beginner", "intermediate", "advanced"] } },
          { name: "equipment", in: "query", schema: { type: "string" }, description: "Filter by equipment type" },
          { name: "movementPattern", in: "query", schema: { type: "string" }, description: "Filter by movement pattern" },
          { name: "muscleGroup", in: "query", schema: { type: "string" }, description: "Filter by target muscle" },
          { name: "isCompound", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          200: {
            description: "List of exercises with pagination",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Exercise" } },
                    pagination: { $ref: "#/components/schemas/Pagination" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Exercises"],
        summary: "Create a new exercise",
        description: "Add a new exercise to the library",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateExercise" },
            },
          },
        },
        responses: {
          201: {
            description: "Exercise created",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Exercise" } } } } },
          },
          409: {
            description: "Exercise ID already exists",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/api/exercises/{id}": {
      get: {
        tags: ["Exercises"],
        summary: "Get exercise by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            description: "Exercise found",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Exercise" } } } } },
          },
          404: {
            description: "Exercise not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
      put: {
        tags: ["Exercises"],
        summary: "Replace an exercise",
        description: "Fully replace an existing exercise",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateExercise" } } },
        },
        responses: {
          200: {
            description: "Exercise updated",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Exercise" } } } } },
          },
          404: { description: "Exercise not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      patch: {
        tags: ["Exercises"],
        summary: "Update an exercise",
        description: "Partially update an existing exercise",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateExercise" } } },
        },
        responses: {
          200: {
            description: "Exercise updated",
            content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Exercise" } } } } },
          },
          404: { description: "Exercise not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Exercises"],
        summary: "Delete an exercise",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            description: "Exercise deleted",
            content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" } } } } },
          },
          404: { description: "Exercise not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/exercises/{id}/substitutes": {
      get: {
        tags: ["Exercises"],
        summary: "Find exercise substitutes",
        description: "Find suitable substitute exercises based on movement pattern, target muscles, and available equipment",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 5, minimum: 1, maximum: 20 } },
          { name: "equipment", in: "query", schema: { type: "string" }, description: "Comma-separated list of available equipment" },
          { name: "maxDifficulty", in: "query", schema: { type: "string", enum: ["beginner", "intermediate", "advanced"] } },
          { name: "exclude", in: "query", schema: { type: "string" }, description: "Comma-separated exercise IDs to exclude" },
        ],
        responses: {
          200: {
            description: "Substitutes found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        sourceExercise: { $ref: "#/components/schemas/Exercise" },
                        substitutes: { type: "array", items: { $ref: "#/components/schemas/Substitute" } },
                      },
                    },
                  },
                },
              },
            },
          },
          404: { description: "Exercise not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/exercises/by-pattern/{pattern}": {
      get: {
        tags: ["Exercises"],
        summary: "Get exercises by movement pattern",
        parameters: [{ name: "pattern", in: "path", required: true, schema: { type: "string" }, description: "Movement pattern (e.g., squat, hinge, push_horizontal)" }],
        responses: {
          200: {
            description: "Exercises found",
            content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Exercise" } } } } } },
          },
        },
      },
    },
    "/api/exercises/by-muscle/{muscle}": {
      get: {
        tags: ["Exercises"],
        summary: "Get exercises by target muscle",
        parameters: [{ name: "muscle", in: "path", required: true, schema: { type: "string" }, description: "Target muscle (e.g., chest, quads, glutes)" }],
        responses: {
          200: {
            description: "Exercises found",
            content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Exercise" } } } } } },
          },
        },
      },
    },
    "/api/exercises/by-equipment/{equipment}": {
      get: {
        tags: ["Exercises"],
        summary: "Get exercises by equipment",
        parameters: [{ name: "equipment", in: "path", required: true, schema: { type: "string" }, description: "Equipment type (e.g., barbell, dumbbell, bodyweight)" }],
        responses: {
          200: {
            description: "Exercises found",
            content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Exercise" } } } } } },
          },
        },
      },
    },
    "/api/exercises/search/{term}": {
      get: {
        tags: ["Exercises"],
        summary: "Search exercises by name",
        parameters: [{ name: "term", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            description: "Search results",
            content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Exercise" } } } } } },
          },
        },
      },
    },
    // Programs
    "/api/programs": {
      get: {
        tags: ["Programs"],
        summary: "List training programs",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          { name: "goal", in: "query", schema: { type: "string", enum: ["strength", "hypertrophy", "conditioning"] } },
          { name: "level", in: "query", schema: { type: "string", enum: ["beginner", "intermediate", "advanced"] } },
          { name: "daysPerWeek", in: "query", schema: { type: "integer", minimum: 1, maximum: 7 } },
        ],
        responses: { 200: { description: "List of programs" } },
      },
      post: {
        tags: ["Programs"],
        summary: "Create a new program",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateProgram" } } } },
        responses: { 201: { description: "Program created" }, 409: { description: "Program ID exists" } },
      },
    },
    "/api/programs/{id}": {
      get: { tags: ["Programs"], summary: "Get program by ID", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Program found" }, 404: { description: "Not found" } } },
      patch: { tags: ["Programs"], summary: "Update program", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Updated" }, 404: { description: "Not found" } } },
      delete: { tags: ["Programs"], summary: "Delete program", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Deleted" }, 404: { description: "Not found" } } },
    },
    // Training Blocks
    "/api/workouts/training-blocks": {
      get: {
        tags: ["Training Blocks"],
        summary: "List user's training blocks",
        parameters: [
          { name: "userId", in: "query", required: true, schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["active", "completed", "paused"] } },
        ],
        responses: { 200: { description: "List of training blocks" } },
      },
      post: {
        tags: ["Training Blocks"],
        summary: "Start a new training block",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateTrainingBlock" } } } },
        responses: { 201: { description: "Training block created" }, 404: { description: "Program not found" }, 409: { description: "Active block exists" } },
      },
    },
    "/api/workouts/training-blocks/{id}": {
      get: { tags: ["Training Blocks"], summary: "Get training block with program", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Found" }, 404: { description: "Not found" } } },
      patch: { tags: ["Training Blocks"], summary: "Update training block", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Updated" }, 404: { description: "Not found" } } },
    },
    // Workouts
    "/api/workouts/today": { get: { tags: ["Workouts"], summary: "Get today's workout", description: "Get the workout scheduled for today for a user", parameters: [{ name: "userId", in: "query", required: true, schema: { type: "string" } }], responses: { 200: { description: "Today's workout or null" } } } },
    "/api/workouts/recent": { get: { tags: ["Workouts"], summary: "Get recent workouts", description: "Get recently completed workouts for a user", parameters: [{ name: "userId", in: "query", required: true, schema: { type: "string" } }, { name: "limit", in: "query", schema: { type: "integer", default: 10 } }], responses: { 200: { description: "Recent workouts" } } } },
    "/api/workouts": {
      get: {
        tags: ["Workouts"],
        summary: "List workouts",
        parameters: [
          { name: "trainingBlockId", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["pending", "in_progress", "completed", "skipped"] } },
          { name: "fromDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "toDate", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { 200: { description: "List of workouts" } },
      },
    },
    "/api/workouts/{id}": {
      get: { tags: ["Workouts"], summary: "Get workout", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Found" }, 404: { description: "Not found" } } },
      patch: { tags: ["Workouts"], summary: "Update workout", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Updated" }, 404: { description: "Not found" } } },
    },
    "/api/workouts/{id}/start": { post: { tags: ["Workouts"], summary: "Start workout session", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Started" }, 400: { description: "Already started" } } } },
    "/api/workouts/{id}/complete": { post: { tags: ["Workouts"], summary: "Complete workout", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Completed" } } } },
    "/api/workouts/{id}/skip": { post: { tags: ["Workouts"], summary: "Skip workout", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Skipped" } } } },
    // Logs
    "/api/logs": {
      get: {
        tags: ["Logs"],
        summary: "List workout logs",
        parameters: [
          { name: "userId", in: "query", schema: { type: "string" } },
          { name: "workoutId", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: { 200: { description: "List of logs" } },
      },
      post: {
        tags: ["Logs"],
        summary: "Start a workout log",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateWorkoutLog" } } } },
        responses: { 201: { description: "Log created" }, 409: { description: "Log exists for workout" } },
      },
    },
    "/api/logs/{id}": { get: { tags: ["Logs"], summary: "Get log with sets", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Found" }, 404: { description: "Not found" } } } },
    "/api/logs/{id}/complete": { patch: { tags: ["Logs"], summary: "Complete workout log", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Completed" } } } },
    "/api/logs/{logId}/sets": {
      get: { tags: ["Logs"], summary: "Get sets for a log", parameters: [{ name: "logId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Sets" } } },
      post: { tags: ["Logs"], summary: "Log a set", parameters: [{ name: "logId", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateSet" } } } }, responses: { 201: { description: "Set logged" } } },
    },
    "/api/logs/{logId}/sets/batch": { post: { tags: ["Logs"], summary: "Log multiple sets", parameters: [{ name: "logId", in: "path", required: true, schema: { type: "string" } }], responses: { 201: { description: "Sets logged" } } } },
    "/api/logs/exercise/{exerciseId}/history": { get: { tags: ["Logs"], summary: "Get exercise history", parameters: [{ name: "exerciseId", in: "path", required: true, schema: { type: "string" } }, { name: "userId", in: "query", required: true, schema: { type: "string" } }], responses: { 200: { description: "History" } } } },
    // Decisions
    "/api/decisions/history": { get: { tags: ["Decisions"], summary: "Get decision history", description: "Query historical decisions for a user", parameters: [{ name: "userId", in: "query", required: true, schema: { type: "string" } }, { name: "type", in: "query", schema: { type: "string" }, description: "Filter by decision type" }, { name: "limit", in: "query", schema: { type: "integer", default: 20 } }, { name: "offset", in: "query", schema: { type: "integer", default: 0 } }], responses: { 200: { description: "Decision history" } } } },
    "/api/decisions/{id}": { get: { tags: ["Decisions"], summary: "Get decision by ID", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Decision found" }, 404: { description: "Not found" } } } },
    "/api/decisions/load-progression": { post: { tags: ["Decisions"], summary: "Calculate load progression", description: "Determine whether to increase, maintain, or decrease weight based on recent performance. Pass userId to persist the decision.", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoadProgressionInput" } } } }, responses: { 200: { description: "Load decision", content: { "application/json": { schema: { $ref: "#/components/schemas/LoadDecision" } } } } } } },
    "/api/decisions/volume": { post: { tags: ["Decisions"], summary: "Calculate volume adjustment", description: "Determine whether to add, maintain, or reduce sets", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/VolumeInput" } } } }, responses: { 200: { description: "Volume decision" } } } },
    "/api/decisions/deload": { post: { tags: ["Decisions"], summary: "Check if deload needed", description: "Evaluate if a deload week is recommended based on training stress", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/DeloadInput" } } } }, responses: { 200: { description: "Deload recommendation" } } } },
    "/api/decisions/rotation": { post: { tags: ["Decisions"], summary: "Check exercise rotation", description: "Determine if an exercise should be swapped for a substitute", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RotationInput" } } } }, responses: { 200: { description: "Rotation decision" } } } },
    "/api/decisions/recovery": { post: { tags: ["Decisions"], summary: "Calculate session recovery", description: "Adjust workout based on recovery indicators (sleep, soreness, stress, energy)", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RecoveryInput" } } } }, responses: { 200: { description: "Recovery adjustments" } } } },
    "/api/decisions/missed-session": { post: { tags: ["Decisions"], summary: "Handle missed session", description: "Determine how to proceed after missing a workout", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/MissedSessionInput" } } } }, responses: { 200: { description: "Missed session handling" } } } },
    "/api/decisions/weekly-plan": { post: { tags: ["Decisions"], summary: "Generate weekly plan", description: "Create next week's training plan with all adjustments aggregated", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/WeeklyPlanInput" } } } }, responses: { 200: { description: "Weekly plan with all decisions" } } } },
    "/api/decisions/performance-trend": { post: { tags: ["Decisions"], summary: "Calculate performance trend", description: "Analyze recent performance to determine if improving, stagnant, or declining", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { recentWeights: { type: "array", items: { type: "number" } }, recentReps: { type: "array", items: { type: "integer" } } } } } } }, responses: { 200: { description: "Performance trend" } } } },
    // Users
    "/api/users/me": { get: { tags: ["Users"], summary: "Get current user", description: "Get user profile by Clerk ID", parameters: [{ name: "clerkId", in: "query", required: true, schema: { type: "string" } }], responses: { 200: { description: "User profile with active training block" }, 404: { description: "User not found" } } } },
    "/api/users/{id}": { get: { tags: ["Users"], summary: "Get user by ID", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "User found" }, 404: { description: "Not found" } } } },
    "/api/users": { post: { tags: ["Users"], summary: "Create user", description: "Create user after Clerk sign-up", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateUser" } } } }, responses: { 201: { description: "User created" }, 409: { description: "User already exists" } } } },
    "/api/users/readiness": { post: { tags: ["Users"], summary: "Submit readiness check-in", description: "Submit pre-workout readiness and get recovery adjustments", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ReadinessInput" } } } }, responses: { 200: { description: "Recovery adjustments" } } } },
  },
  components: {
    schemas: {
      Exercise: {
        type: "object",
        properties: {
          id: { type: "string", example: "barbell-back-squat" },
          name: { type: "string", example: "Barbell Back Squat" },
          aliases: { type: "array", items: { type: "string" }, example: ["Back Squat", "High Bar Squat"] },
          equipment: { type: "array", items: { type: "string" }, example: ["barbell", "squat_rack"] },
          movementPatterns: { type: "array", items: { type: "string" }, example: ["squat"] },
          primaryMuscles: { type: "array", items: { type: "string" }, example: ["quads", "glutes"] },
          secondaryMuscles: { type: "array", items: { type: "string" }, example: ["hamstrings", "core"] },
          isCompound: { type: "boolean", example: true },
          isUnilateral: { type: "boolean", example: false },
          difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"], example: "intermediate" },
          constraints: { type: "array", items: { type: "string" }, example: [] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateExercise: {
        type: "object",
        required: ["id", "name", "equipment", "movementPatterns", "primaryMuscles", "isCompound", "difficulty"],
        properties: {
          id: { type: "string", pattern: "^[a-z0-9-]+$", example: "my-new-exercise" },
          name: { type: "string", example: "My New Exercise" },
          aliases: { type: "array", items: { type: "string" }, default: [] },
          equipment: { type: "array", items: { type: "string" }, minItems: 1, example: ["dumbbell"] },
          movementPatterns: { type: "array", items: { type: "string" }, minItems: 1, example: ["push_horizontal"] },
          primaryMuscles: { type: "array", items: { type: "string" }, minItems: 1, example: ["chest"] },
          secondaryMuscles: { type: "array", items: { type: "string" }, default: [], example: ["triceps"] },
          isCompound: { type: "boolean", example: true },
          isUnilateral: { type: "boolean", default: false },
          difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"], example: "beginner" },
          constraints: { type: "array", items: { type: "string" }, default: [] },
        },
      },
      UpdateExercise: {
        type: "object",
        properties: {
          name: { type: "string" },
          aliases: { type: "array", items: { type: "string" } },
          equipment: { type: "array", items: { type: "string" }, minItems: 1 },
          movementPatterns: { type: "array", items: { type: "string" }, minItems: 1 },
          primaryMuscles: { type: "array", items: { type: "string" }, minItems: 1 },
          secondaryMuscles: { type: "array", items: { type: "string" } },
          isCompound: { type: "boolean" },
          isUnilateral: { type: "boolean" },
          difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
          constraints: { type: "array", items: { type: "string" } },
        },
      },
      Substitute: {
        type: "object",
        properties: {
          exercise: { $ref: "#/components/schemas/Exercise" },
          score: { type: "integer", minimum: 0, maximum: 100, description: "Match score (0-100)", example: 88 },
          matchReasons: { type: "array", items: { type: "string" }, example: ["Same movement pattern: push_horizontal"] },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          total: { type: "integer", example: 69 },
          limit: { type: "integer", example: 50 },
          offset: { type: "integer", example: 0 },
          hasMore: { type: "boolean", example: true },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "Exercise not found" },
        },
      },
      // Training schemas
      CreateProgram: {
        type: "object",
        required: ["id", "name", "daysPerWeek", "goal", "level", "template"],
        properties: {
          id: { type: "string", pattern: "^[a-z0-9-]+$", example: "ppl-hypertrophy" },
          name: { type: "string", example: "Push Pull Legs" },
          description: { type: "string" },
          daysPerWeek: { type: "integer", minimum: 1, maximum: 7, example: 6 },
          goal: { type: "string", enum: ["strength", "hypertrophy", "conditioning"] },
          level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
          template: { $ref: "#/components/schemas/ProgramTemplate" },
        },
      },
      ProgramTemplate: {
        type: "object",
        properties: {
          weeks: { type: "integer", minimum: 1, example: 4 },
          sessions: { type: "array", items: { $ref: "#/components/schemas/SessionTemplate" } },
        },
      },
      SessionTemplate: {
        type: "object",
        properties: {
          dayNumber: { type: "integer", minimum: 1, maximum: 7 },
          name: { type: "string", example: "Push Day" },
          focus: { type: "array", items: { type: "string" }, example: ["chest", "shoulders", "triceps"] },
          exercises: { type: "array", items: { $ref: "#/components/schemas/PlannedExercise" } },
        },
      },
      PlannedExercise: {
        type: "object",
        properties: {
          exerciseId: { type: "string", example: "barbell-bench-press" },
          sets: { type: "integer", example: 4 },
          repRange: { type: "array", items: { type: "integer" }, example: [8, 12] },
          restSeconds: { type: "integer", example: 90 },
          notes: { type: "string" },
        },
      },
      CreateTrainingBlock: {
        type: "object",
        required: ["id", "userId", "programId", "startDate"],
        properties: {
          id: { type: "string", example: "user1-ppl-jan2024" },
          userId: { type: "string", example: "user-123" },
          programId: { type: "string", example: "ppl-hypertrophy" },
          startDate: { type: "string", format: "date", example: "2024-01-15" },
        },
      },
      CreateWorkoutLog: {
        type: "object",
        required: ["id", "workoutId", "userId", "startedAt"],
        properties: {
          id: { type: "string", example: "log-abc123" },
          workoutId: { type: "string", example: "workout-xyz" },
          userId: { type: "string", example: "user-123" },
          startedAt: { type: "string", format: "date-time" },
        },
      },
      CreateSet: {
        type: "object",
        required: ["id", "exerciseId", "setNumber", "weight", "reps"],
        properties: {
          id: { type: "string", example: "set-abc123" },
          exerciseId: { type: "string", example: "barbell-bench-press" },
          setNumber: { type: "integer", minimum: 1, example: 1 },
          weight: { type: "number", example: 135 },
          reps: { type: "integer", example: 10 },
          rpe: { type: "number", minimum: 1, maximum: 10, example: 8 },
          notes: { type: "string" },
        },
      },
      // Decision Engine schemas
      LoadProgressionInput: {
        type: "object",
        required: ["exerciseId", "recentSets", "currentWeight", "targetRepRange"],
        properties: {
          exerciseId: { type: "string", example: "barbell-bench-press" },
          recentSets: { type: "array", items: { type: "object", properties: { reps: { type: "integer" }, rpe: { type: "number" }, weight: { type: "number" } } } },
          currentWeight: { type: "number", example: 100 },
          targetRepRange: { type: "array", items: { type: "integer" }, example: [8, 10] },
        },
      },
      LoadDecision: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["increase", "maintain", "decrease"], example: "increase" },
          newWeight: { type: "number", example: 102.5 },
          reason: { type: "string", example: "Hit top of rep range with controlled RPE — time to progress" },
        },
      },
      VolumeInput: {
        type: "object",
        required: ["exerciseId", "currentSetCount", "recentPerformance"],
        properties: {
          exerciseId: { type: "string" },
          currentSetCount: { type: "integer", example: 4 },
          recentPerformance: { type: "array", items: { type: "object", properties: { completedSets: { type: "integer" }, targetSets: { type: "integer" }, avgRpe: { type: "number" } } } },
        },
      },
      DeloadInput: {
        type: "object",
        required: ["weekNumber", "recentWeeklyRpe", "missedSessions", "consecutiveHardWeeks"],
        properties: {
          weekNumber: { type: "integer", example: 7 },
          recentWeeklyRpe: { type: "array", items: { type: "number" }, example: [8.5, 8.5, 9] },
          missedSessions: { type: "integer", example: 0 },
          consecutiveHardWeeks: { type: "integer", example: 3 },
        },
      },
      RotationInput: {
        type: "object",
        required: ["exerciseId", "weeksOnExercise", "performanceTrend", "availableSubstitutes"],
        properties: {
          exerciseId: { type: "string", example: "barbell-bench-press" },
          weeksOnExercise: { type: "integer", example: 6 },
          performanceTrend: { type: "string", enum: ["improving", "stagnant", "declining"] },
          availableSubstitutes: { type: "array", items: { type: "string" }, example: ["incline-bench-press", "dumbbell-bench-press"] },
        },
      },
      RecoveryInput: {
        type: "object",
        required: ["sleepQuality", "muscleSoreness", "stressLevel", "energyLevel", "hoursSinceLastWorkout"],
        properties: {
          sleepQuality: { type: "number", minimum: 1, maximum: 10, example: 7 },
          muscleSoreness: { type: "number", minimum: 1, maximum: 10, example: 4 },
          stressLevel: { type: "number", minimum: 1, maximum: 10, example: 5 },
          energyLevel: { type: "number", minimum: 1, maximum: 10, example: 7 },
          hoursSinceLastWorkout: { type: "number", example: 48 },
          lastWorkoutRpe: { type: "number", minimum: 1, maximum: 10, example: 8 },
        },
      },
      MissedSessionInput: {
        type: "object",
        required: ["daysSinceMissed", "reason", "missedThisWeek", "consecutiveMissed", "weekNumber", "totalWeeks", "wasKeySession"],
        properties: {
          daysSinceMissed: { type: "integer", example: 2 },
          reason: { type: "string", enum: ["illness", "injury", "travel", "schedule_conflict", "fatigue", "motivation", "unknown"] },
          missedThisWeek: { type: "integer", example: 1 },
          consecutiveMissed: { type: "integer", example: 1 },
          weekNumber: { type: "integer", example: 5 },
          totalWeeks: { type: "integer", example: 12 },
          wasKeySession: { type: "boolean", example: false },
        },
      },
      WeeklyPlanInput: {
        type: "object",
        required: ["userId", "weekNumber", "totalWeeks", "exercises", "recentWeeklyRpe", "missedSessions", "consecutiveHardWeeks"],
        properties: {
          userId: { type: "string", example: "user-123" },
          weekNumber: { type: "integer", example: 5 },
          totalWeeks: { type: "integer", example: 12 },
          exercises: { type: "array", items: { $ref: "#/components/schemas/ExercisePerformance" } },
          recentWeeklyRpe: { type: "array", items: { type: "number" } },
          missedSessions: { type: "integer" },
          consecutiveHardWeeks: { type: "integer" },
          userRequestedDeload: { type: "boolean" },
        },
      },
      ExercisePerformance: {
        type: "object",
        properties: {
          exerciseId: { type: "string" },
          currentWeight: { type: "number" },
          currentSets: { type: "integer" },
          targetRepRange: { type: "array", items: { type: "integer" } },
          weeksOnExercise: { type: "integer" },
          recentSets: { type: "array", items: { type: "object" } },
          recentPerformance: { type: "array", items: { type: "object" } },
          performanceTrend: { type: "string", enum: ["improving", "stagnant", "declining"] },
          availableSubstitutes: { type: "array", items: { type: "string" } },
        },
      },
      // User schemas
      CreateUser: {
        type: "object",
        required: ["id", "clerkId", "email", "trainingLevel", "primaryGoal"],
        properties: {
          id: { type: "string", example: "user-123" },
          clerkId: { type: "string", example: "clerk_abc123" },
          email: { type: "string", format: "email", example: "user@example.com" },
          trainingLevel: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
          primaryGoal: { type: "string", enum: ["strength", "hypertrophy", "conditioning"] },
          preferences: { type: "object", default: {} },
        },
      },
      ReadinessInput: {
        type: "object",
        required: ["userId", "sleepQuality", "muscleSoreness", "stressLevel", "energyLevel"],
        properties: {
          userId: { type: "string", example: "user-123" },
          workoutId: { type: "string", example: "workout-xyz" },
          sleepQuality: { type: "number", minimum: 1, maximum: 10, example: 7 },
          muscleSoreness: { type: "number", minimum: 1, maximum: 10, example: 4 },
          stressLevel: { type: "number", minimum: 1, maximum: 10, example: 5 },
          energyLevel: { type: "number", minimum: 1, maximum: 10, example: 7 },
          hoursSinceLastWorkout: { type: "number", default: 48, example: 48 },
          lastWorkoutRpe: { type: "number", minimum: 1, maximum: 10, example: 8 },
        },
      },
    },
  },
};

// Serve OpenAPI spec
openapi.get("/openapi.json", (c) => c.json(openAPISpec));

// Swagger UI
openapi.get("/docs", swaggerUI({ url: "/api/openapi.json" }));

export { openapi };
