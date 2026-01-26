# ADR-0007: Testing Strategy

## Status

Accepted

## Date

2025-01-21

## Context

We need a testing strategy that:
- Gives confidence in the decision engine (core business logic)
- Catches API contract breakages
- Enables safe refactoring
- Doesn't slow down development
- Works well in a monorepo

The decision engine is pure functions making it ideal for unit testing. The API layer needs integration tests against a real database.

## Decision

Use **Vitest** for all testing with a testing pyramid approach.

### Testing Pyramid

```
           /\
          /  \        E2E (Playwright)
         /    \       - Critical user flows only
        /      \      - Login → Log workout → View history
       /--------\
      /          \    Integration
     /            \   - API routes against test DB
    /              \  - PowerSync sync flows
   /----------------\
  /                  \   Unit
 /                    \  - Decision engine (90%+ coverage)
/                      \ - Validation schemas
/------------------------\ - Utility functions
```

### Package-Specific Strategy

| Package | Test Type | Coverage Target | Notes |
|---------|-----------|-----------------|-------|
| `@gymapp/engine` | Unit | 90%+ | Pure functions, exhaustive edge cases |
| `@gymapp/validation` | Unit | 80%+ | Schema validation tests |
| `@gymapp/types` | None | N/A | Types only, no runtime code |
| `@gymapp/db` | Integration | 70%+ | Against test database |
| `apps/server` | Integration | 80%+ | API contract tests |
| `apps/web` | Unit + E2E | 60%+ | Components + critical flows |

### Configuration

```typescript
// vitest.workspace.ts (root)
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/*/vitest.config.ts",
  "apps/*/vitest.config.ts",
]);

// packages/engine/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
```

### Example: Engine Unit Tests

```typescript
// packages/engine/src/progression.test.ts
import { describe, it, expect } from "vitest";
import { calculateLoadProgression } from "./progression";

describe("calculateLoadProgression", () => {
  it("increases weight when hitting top of rep range with low RPE", () => {
    const result = calculateLoadProgression({
      exerciseId: "bench-press",
      recentSets: [
        { reps: 10, rpe: 7, weight: 100 },
        { reps: 10, rpe: 7, weight: 100 },
        { reps: 9, rpe: 7, weight: 100 },
      ],
      currentWeight: 100,
      targetRepRange: [8, 10],
    });

    expect(result.action).toBe("increase");
    expect(result.newWeight).toBe(105);
    expect(result.reason).toContain("ready to progress");
  });

  it("decreases weight when below rep range", () => {
    const result = calculateLoadProgression({
      exerciseId: "bench-press",
      recentSets: [
        { reps: 5, rpe: 9, weight: 100 },
        { reps: 4, rpe: 10, weight: 100 },
      ],
      currentWeight: 100,
      targetRepRange: [8, 10],
    });

    expect(result.action).toBe("decrease");
    expect(result.newWeight).toBe(95);
  });

  it("maintains weight when in target range", () => {
    const result = calculateLoadProgression({
      exerciseId: "bench-press",
      recentSets: [
        { reps: 9, rpe: 8, weight: 100 },
        { reps: 8, rpe: 8, weight: 100 },
      ],
      currentWeight: 100,
      targetRepRange: [8, 10],
    });

    expect(result.action).toBe("maintain");
    expect(result.newWeight).toBe(100);
  });

  it("handles empty sets gracefully", () => {
    const result = calculateLoadProgression({
      exerciseId: "bench-press",
      recentSets: [],
      currentWeight: 100,
      targetRepRange: [8, 10],
    });

    expect(result.action).toBe("maintain");
    expect(result.reason).toContain("No recent data");
  });
});
```

### Example: API Integration Tests

```typescript
// apps/server/src/routes/exercises.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testClient } from "hono/testing";
import { app } from "../index";
import { db } from "@gymapp/db";
import { exercises } from "@gymapp/db/schema";

describe("GET /api/exercises", () => {
  beforeAll(async () => {
    // Seed test data
    await db.insert(exercises).values([
      { id: "test-1", name: "Bench Press", /* ... */ },
      { id: "test-2", name: "Squat", /* ... */ },
    ]);
  });

  afterAll(async () => {
    await db.delete(exercises);
  });

  it("returns all exercises", async () => {
    const res = await testClient(app).api.exercises.$get();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it("filters by movement pattern", async () => {
    const res = await testClient(app).api.exercises.$get({
      query: { pattern: "squat" },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.every(e => e.movementPatterns.includes("squat"))).toBe(true);
  });
});
```

## Consequences

### Positive

- Vitest is fast, ESM-native, and TypeScript-first
- Jest-compatible API reduces learning curve
- Monorepo workspace support built-in
- Engine tests provide high confidence in core logic
- Integration tests catch API contract issues
- Coverage thresholds enforce standards

### Negative

- Need to maintain test database for integration tests
- E2E tests are slower and more brittle
- Initial setup time for test infrastructure

### Neutral

- Test data management needs attention
- CI needs to run tests with database available

## Alternatives Considered

| Alternative | Pros | Cons | Why Not Chosen |
|-------------|------|------|----------------|
| Jest | Very mature, huge ecosystem | Slower, CJS-focused, config heavy | Vitest is faster and simpler |
| Node test runner | Built-in, no deps | Less mature, fewer features | Missing coverage, watch mode issues |
| Playwright only | Full coverage with E2E | Slow, brittle, expensive to run | Unit tests are faster for logic |

## References

- [Vitest Documentation](https://vitest.dev)
- [Vitest Workspaces](https://vitest.dev/guide/workspace.html)
- [Testing Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- [Hono Testing](https://hono.dev/docs/guides/testing)
