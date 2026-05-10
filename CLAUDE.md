# Lifters Club - Development Standards

> This document defines coding standards, clean code principles, and best practices for the Lifters Club monorepo.

## Project Overview

Lifters Club is a **training decision engine** that transforms workout history into intelligent, justified training decisions. It consists of:

- **Exercise Library API** - Standalone canonical movement database
- **Training App** - Decision engine, programs, user management
- **Shared Packages** - Types, validation, database, engine logic

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + pnpm Workspaces |
| Backend | Hono (TypeScript) |
| Frontend | Next.js 15 (App Router) |
| Database | PostgreSQL 16 + Drizzle ORM |
| Validation | Zod |
| Auth | Clerk |
| Styling | Tailwind + shadcn/ui |
| Testing | Vitest |
| Offline Sync | MMKV + offline queue |

---

## SOLID Principles

Apply SOLID pragmatically — not dogmatically. Over-engineering is worse than under-engineering.

### Single Responsibility (SRP)

Each module/function should have one reason to change.

```typescript
// ✅ Good - single responsibility
export function calculateLoadProgression(input: ProgressionInput): LoadDecision
export function calculateVolumeAdjustment(input: VolumeInput): VolumeDecision

// ❌ Bad - multiple responsibilities
export function makeAllDecisions(input: AllInput): AllDecisions
```

### Open/Closed (OCP)

Open for extension, closed for modification. Use configuration over code changes.

```typescript
// ✅ Good - configurable behavior
export function calculateLoadProgression(
  input: ProgressionInput,
  config: ProgressionConfig = defaultConfig
): LoadDecision

// ❌ Bad - hardcoded values requiring code changes
export function calculateLoadProgression(input: ProgressionInput): LoadDecision {
  const INCREMENT = 2.5; // Hardcoded, requires code change
}
```

### Liskov Substitution (LSP)

Subtypes must be substitutable for their base types. All decision outputs follow consistent interfaces.

```typescript
// ✅ Good - consistent interface
interface BaseDecision {
  reason: string;
}

interface LoadDecision extends BaseDecision {
  action: "increase" | "maintain" | "decrease";
  newWeight: number;
}
```

### Interface Segregation (ISP)

Prefer small, focused interfaces over large ones.

```typescript
// ✅ Good - focused interfaces
interface ExerciseQuery { id: string; }
interface ExerciseCreate { name: string; equipment: string[]; }

// ❌ Bad - bloated interface
interface ExerciseOperations {
  id?: string;
  name?: string;
  // ...20 more optional fields
}
```

### Dependency Inversion (DIP)

Depend on abstractions, not concretions. The engine takes data, doesn't fetch it.

```typescript
// ✅ Good - engine depends on data passed in
export function calculateLoadProgression(input: ProgressionInput): LoadDecision

// ❌ Bad - engine fetches its own data
export async function calculateLoadProgression(exerciseId: string): LoadDecision {
  const data = await db.query(...); // Direct DB dependency
}
```

---

## Clean Code Principles

### Naming Conventions

```typescript
// Variables and functions: camelCase
const currentWeight = 100;
function calculateProgression() {}

// Types and interfaces: PascalCase
interface LoadDecision {}
type MovementPattern = "squat" | "hinge";

// Constants: SCREAMING_SNAKE_CASE (only for true constants)
const MAX_SETS_PER_EXERCISE = 6;

// Database columns: snake_case
created_at, training_level, primary_muscles

// File names: kebab-case for multi-word, otherwise lowercase
exercise-lib.ts, progression.ts, types.ts
```

### Function Guidelines

```typescript
// ✅ Good - small, focused, descriptive
function calculateAverageRpe(sets: LoggedSet[]): number {
  const setsWithRpe = sets.filter(s => s.rpe !== undefined);
  if (setsWithRpe.length === 0) return 7; // sensible default
  return setsWithRpe.reduce((sum, s) => sum + s.rpe!, 0) / setsWithRpe.length;
}

// ❌ Bad - too long, multiple responsibilities, unclear name
function process(data: any) {
  // 100+ lines doing multiple things
}
```

**Rules:**
- Functions should do one thing
- Keep under 20-30 lines when possible
- Use descriptive names (verb + noun)
- Limit parameters to 3-4 (use objects for more)
- Pure functions preferred (no side effects)

### Error Handling

```typescript
// ✅ Good - explicit error handling at boundaries
function parseExerciseId(id: unknown): string {
  const result = z.string().min(1).safeParse(id);
  if (!result.success) {
    throw new ValidationError("Invalid exercise ID");
  }
  return result.data;
}

// ❌ Bad - swallowing errors
function parseExerciseId(id: unknown): string | null {
  try {
    return String(id);
  } catch {
    return null; // Error silently swallowed
  }
}
```

**Rules:**
- Validate at system boundaries (API inputs, external data)
- Trust internal code — don't over-validate
- Use typed errors, not generic `Error`
- Never swallow errors silently
- Log errors with context

### Comments

```typescript
// ✅ Good - explains WHY, not WHAT
// Using 7 as default RPE because it's the midpoint of the "effective" range (6-8)
const defaultRpe = 7;

// ✅ Good - documents non-obvious business logic
// Progression requires RPE < 8 because we want "reps in reserve" before adding weight
if (avgRpe < config.rpeThresholdForIncrease) {

// ❌ Bad - states the obvious
// Increment the counter
counter++;

// ❌ Bad - outdated comment
// Returns user by email (actually returns by ID now)
function getUser(id: string) {}
```

**Rules:**
- Code should be self-documenting
- Comment WHY, not WHAT
- Keep comments up to date or delete them
- Use JSDoc for public APIs
- TODO comments must have context

---

## TypeScript Standards

### Strict Mode

Always use strict TypeScript. The `tsconfig.base.json` enables:

```json
{
  "strict": true,
  "strictNullChecks": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noUncheckedIndexedAccess": true
}
```

### Type Definitions

```typescript
// ✅ Good - explicit types, union types for finite sets
type Difficulty = "beginner" | "intermediate" | "advanced";

interface Exercise {
  id: string;
  name: string;
  difficulty: Difficulty;
}

// ✅ Good - use `type` for unions/aliases, `interface` for objects
type DecisionAction = "increase" | "maintain" | "decrease";
interface LoadDecision {
  action: DecisionAction;
  newWeight: number;
}

// ❌ Bad - using `any`
function processData(data: any) {}

// ❌ Bad - using `object` type
function processData(data: object) {}
```

### Avoid These

```typescript
// ❌ Never use `any` - use `unknown` and narrow
function parse(data: any) {} // Bad
function parse(data: unknown) {} // Better

// ❌ Never use `!` non-null assertion without good reason
const value = maybeNull!; // Bad - crashes if null

// ❌ Avoid type assertions unless necessary
const user = data as User; // Prefer type guards
```

### Prefer These

```typescript
// ✅ Use const assertions for literal types
const ACTIONS = ["increase", "maintain", "decrease"] as const;
type Action = typeof ACTIONS[number];

// ✅ Use satisfies for type checking without widening
const config = {
  minSets: 2,
  maxSets: 6,
} satisfies ProgressionConfig;

// ✅ Use discriminated unions
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

---

## DRY (Don't Repeat Yourself)

### Where to Apply DRY

| Duplication | Solution |
|-------------|----------|
| Types across packages | `@gymapp/types` |
| Validation schemas | `@gymapp/validation` |
| Database queries | `@gymapp/db` |
| Business logic | `@gymapp/engine` |

### When NOT to Apply DRY

```typescript
// ✅ Acceptable duplication - similar but different contexts
const userWorkouts = await db.query.workouts.findMany({
  where: eq(workouts.userId, userId)
});

const blockWorkouts = await db.query.workouts.findMany({
  where: eq(workouts.trainingBlockId, blockId)
});

// ❌ Over-abstraction - premature generalization
const findWorkouts = (field: keyof Workout, value: string) =>
  db.query.workouts.findMany({ where: eq(workouts[field], value) });
```

**Rule:** Three similar instances before abstracting. Wrong abstraction is worse than duplication.

---

## Testing Standards

### Test Pyramid

```
         /\
        /  \        E2E - Critical flows only
       /----\
      /      \      Integration - API routes, DB operations
     /--------\
    /          \    Unit - Engine, utilities, validation
   /--------------\
```

### Naming Convention

```typescript
describe("calculateLoadProgression", () => {
  it("increases weight when hitting top of rep range with low RPE", () => {});
  it("decreases weight when below rep range", () => {});
  it("maintains weight when in target range", () => {});
  it("handles empty sets gracefully", () => {});
});
```

### Test Structure (AAA Pattern)

```typescript
it("increases weight when ready to progress", () => {
  // Arrange
  const input: ProgressionInput = {
    exerciseId: "bench-press",
    recentSets: [{ reps: 10, rpe: 7, weight: 100 }],
    currentWeight: 100,
    targetRepRange: [8, 10],
  };

  // Act
  const result = calculateLoadProgression(input);

  // Assert
  expect(result.action).toBe("increase");
  expect(result.newWeight).toBe(105);
});
```

### Coverage Targets

| Package | Target |
|---------|--------|
| `@gymapp/engine` | 90%+ |
| `@gymapp/validation` | 80%+ |
| `@gymapp/db` | 70%+ |
| `apps/server` | 80%+ |
| `apps/web` | 60%+ |

---

## Code Review Checklist

Before submitting a PR, verify:

- [ ] **Functionality**: Does it work as expected?
- [ ] **Types**: Are types explicit and correct? No `any`?
- [ ] **Tests**: Are there tests for new logic? Do they pass?
- [ ] **SRP**: Does each function do one thing?
- [ ] **Naming**: Are names descriptive and consistent?
- [ ] **Errors**: Are errors handled appropriately?
- [ ] **No magic numbers**: Are constants named and explained?
- [ ] **No dead code**: Is all code used?
- [ ] **No commented code**: Remove, don't comment out
- [ ] **Documentation**: Are complex parts explained?

---

## Git Conventions

### Branch Naming

```
feature/add-exercise-rotation
fix/progression-calculation-bug
refactor/extract-validation-utils
docs/update-architecture
```

### Commit Messages

```
feat(engine): add volume adjustment calculation

- Implement calculateVolumeAdjustment function
- Add configuration for min/max sets
- Include unit tests with 95% coverage

Closes #123
```

Format: `type(scope): description`

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

---

## Performance Guidelines

### Database

- Use indexes for frequently queried columns
- Avoid N+1 queries — use joins or batch loading
- Use pagination for list endpoints
- Consider read replicas for heavy read workloads

### API

- Return only necessary fields
- Use compression (gzip/brotli)
- Implement caching headers
- Rate limit public endpoints

### Frontend

- Use React Server Components for data fetching
- Lazy load heavy components
- Optimize images with `next/image`
- Minimize client-side JavaScript

---

## Security Checklist

- [ ] Validate all inputs at API boundaries (Zod)
- [ ] Use parameterized queries (Drizzle handles this)
- [ ] Implement rate limiting on public endpoints
- [ ] Never log sensitive data (passwords, tokens)
- [ ] Use HTTPS in production
- [ ] Keep dependencies updated
- [ ] Validate Clerk JWTs on protected routes

---

## References

- [Clean Code TypeScript](https://github.com/labs42io/clean-code-typescript)
- [SOLID Principles in TypeScript](https://blog.logrocket.com/applying-solid-principles-typescript/)
- [Effective TypeScript 2025](https://www.dennisokeeffe.com/blog/2025-03-16-effective-typescript-principles-in-2025)
- [Hono Best Practices](https://hono.dev/docs/guides/best-practices)
- [Next.js 15 Best Practices](https://dev.to/bajrayejoon/best-practices-for-organizing-your-nextjs-15-2025-53ji)
- [Drizzle ORM Best Practices 2025](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717)
