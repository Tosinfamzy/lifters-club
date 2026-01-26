# @gymapp/server - Development Standards

> Hono REST API for the Lifters Club application.

## Purpose

This app provides:
- Exercise Library API (public)
- Training API (authenticated)
- Clerk webhook receivers

## Architecture

```
src/
├── index.ts              # App entry point, middleware setup
├── routes/
│   ├── exercises.ts      # GET /api/exercises/*
│   ├── users.ts          # User CRUD
│   ├── programs.ts       # Program management
│   ├── workouts.ts       # Workout management
│   └── workout-logs.ts   # Workout log management
├── middleware/
│   ├── auth.ts           # Clerk JWT verification
│   └── error.ts          # Error handling
└── services/
    ├── exercise-library/
    │   └── substitution.ts
    └── training-engine/
        └── weekly-plan.ts
```

## Hono Patterns

### Route Organization

```typescript
// ✅ Good - use app.route() for modular routes
// routes/exercises.ts
import { Hono } from "hono";

const exercisesRouter = new Hono();

exercisesRouter.get("/", async (c) => { ... });
exercisesRouter.get("/:id", async (c) => { ... });
exercisesRouter.post("/", async (c) => { ... });

export { exercisesRouter };

// index.ts
import { exercisesRouter } from "./routes/exercises";

app.route("/api/exercises", exercisesRouter);
```

### Request Validation with Zod

```typescript
import { zValidator } from "@hono/zod-validator";
import { createExerciseSchema } from "@gymapp/validation";

// ✅ Good - validation middleware
exercisesRouter.post("/",
  zValidator("json", createExerciseSchema),
  async (c) => {
    const data = c.req.valid("json"); // Fully typed!
    // data: CreateExerciseInput
  }
);

// Query parameter validation
exercisesRouter.get("/",
  zValidator("query", z.object({
    pattern: movementPatternSchema.optional(),
    difficulty: difficultySchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })),
  async (c) => {
    const { pattern, difficulty, limit } = c.req.valid("query");
  }
);
```

### Path Parameters

```typescript
exercisesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  const [exercise] = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, id))
    .limit(1);

  if (!exercise) {
    return c.json({ error: "Exercise not found" }, 404);
  }

  return c.json(exercise);
});
```

### Response Patterns

```typescript
// ✅ Good - consistent response shapes
// Success
return c.json(data);                    // 200
return c.json(data, 201);               // 201 Created
return c.json(null, 204);               // 204 No Content

// Errors
return c.json({ error: "Not found" }, 404);
return c.json({ error: "Validation failed", details: errors }, 400);
return c.json({ error: "Unauthorized" }, 401);
return c.json({ error: "Forbidden" }, 403);
return c.json({ error: "Internal server error" }, 500);
```

### Error Handling

```typescript
// middleware/error.ts
import { HTTPException } from "hono/http-exception";

export class NotFoundError extends HTTPException {
  constructor(message: string) {
    super(404, { message });
  }
}

export class ValidationError extends HTTPException {
  constructor(message: string, details?: unknown) {
    super(400, { message, cause: details });
  }
}

// Global error handler
app.onError((err, c) => {
  console.error(err);

  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  return c.json({ error: "Internal server error" }, 500);
});
```

### Authentication Middleware

```typescript
// middleware/auth.ts
import { verifyToken } from "@clerk/backend";

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing authorization header" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    c.set("userId", payload.sub);
    c.set("clerkId", payload.sub);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
}

// Usage
app.use("/api/users/*", authMiddleware);
app.use("/api/workouts/*", authMiddleware);
```

## Service Layer Pattern

Keep routes thin, put logic in services:

```typescript
// ✅ Good - thin route, logic in service
exercisesRouter.get("/:id/substitutes",
  zValidator("query", substitutionQuerySchema),
  async (c) => {
    const id = c.req.param("id");
    const query = c.req.valid("query");

    const result = await substitutionService.findSubstitutes(id, query);
    return c.json(result);
  }
);

// services/exercise-library/substitution.ts
export class SubstitutionService {
  async findSubstitutes(
    exerciseId: string,
    query: SubstitutionQueryInput
  ): Promise<SubstitutionResult[]> {
    const exercise = await this.getExercise(exerciseId);
    if (!exercise) throw new NotFoundError(`Exercise ${exerciseId} not found`);

    const candidates = await this.getCandidates(exercise, query);
    return this.rankCandidates(candidates, exercise);
  }
}
```

## Avoid These Patterns

```typescript
// ❌ Don't use RoR-style controllers (type inference issues)
class ExercisesController {
  async list(c: Context) { ... }
}
app.get("/exercises", controller.list);

// ❌ Don't inline complex logic in routes
app.post("/exercises", async (c) => {
  // 100 lines of business logic
});

// ❌ Don't skip validation
app.post("/exercises", async (c) => {
  const data = await c.req.json(); // Unvalidated!
});

// ❌ Don't leak internal errors
app.onError((err, c) => {
  return c.json({ error: err.message, stack: err.stack }, 500); // Exposes internals
});
```

## API Documentation

Use clear, consistent naming:

```typescript
// Exercise Library API (public)
GET    /api/exercises                    # List exercises
GET    /api/exercises/:id                # Get exercise
GET    /api/exercises/:id/substitutes    # Get substitutes
POST   /api/exercises                    # Create exercise (admin)
PATCH  /api/exercises/:id                # Update exercise (admin)
DELETE /api/exercises/:id                # Delete exercise (admin)

// Training API (authenticated)
GET    /api/users/me                     # Get current user
PATCH  /api/users/me                     # Update current user

GET    /api/programs                     # List programs
GET    /api/programs/:id                 # Get program
POST   /api/programs/:id/start           # Start program

GET    /api/workouts                     # List user's workouts
GET    /api/workouts/:id                 # Get workout
POST   /api/workouts/:id/start           # Start workout
POST   /api/workouts/:id/complete        # Complete workout
POST   /api/workouts/:id/sets            # Log a set

// Workout Logs
POST   /api/workout-logs                 # Create workout log
PATCH  /api/workout-logs/:id             # Update workout log (complete)
POST   /api/workout-logs/:id/sets        # Log a set
```

## Testing

### Unit Tests (Services)

```typescript
describe("SubstitutionService", () => {
  it("returns substitutes sorted by match score", async () => {
    const service = new SubstitutionService(mockDb);
    const result = await service.findSubstitutes("bench-press", {});

    expect(result[0].matchScore).toBeGreaterThanOrEqual(result[1].matchScore);
  });
});
```

### Integration Tests (Routes)

```typescript
import { testClient } from "hono/testing";
import { app } from "../index";

describe("GET /api/exercises", () => {
  it("returns exercises list", async () => {
    const res = await testClient(app).api.exercises.$get();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("filters by movement pattern", async () => {
    const res = await testClient(app).api.exercises.$get({
      query: { pattern: "squat" },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.every((e) => e.movementPatterns.includes("squat"))).toBe(true);
  });
});
```

## Environment Variables

```bash
# Required
DATABASE_URL=postgres://...
CLERK_SECRET_KEY=sk_...

# Optional
PORT=4000
NODE_ENV=development
```

## References

- [Hono Documentation](https://hono.dev/docs/)
- [Hono Best Practices](https://hono.dev/docs/guides/best-practices)
- [Hono + Zod Validator](https://hono.dev/examples/zod-openapi)
- [Building Production-Ready Hono APIs](https://medium.com/@yannick.burkard/building-production-ready-hono-apis-a-modern-architecture-guide-fed8a415ca96)
