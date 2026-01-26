# @gymapp/types - Development Standards

> Shared TypeScript type definitions for the Lifters Club monorepo.

## Purpose

This package is the **single source of truth** for all domain types. It has zero runtime dependencies and exports only TypeScript types/interfaces.

## Guidelines

### Type vs Interface

```typescript
// Use `type` for:
// - Union types
// - Mapped types
// - Utility type compositions
type MovementPattern = "squat" | "hinge" | "lunge";
type Difficulty = "beginner" | "intermediate" | "advanced";
type DecisionAction = LoadDecision["action"];

// Use `interface` for:
// - Object shapes that may be extended
// - Public API contracts
interface Exercise {
  id: string;
  name: string;
  difficulty: Difficulty;
}

interface SubstitutionResult {
  exercise: Exercise;
  matchScore: number;
  reason: string;
}
```

### Naming Conventions

```typescript
// Types: PascalCase, singular nouns
type MuscleGroup = "quads" | "hamstrings" | ...;
type EquipmentType = "barbell" | "dumbbell" | ...;

// Interfaces: PascalCase, noun phrases
interface Exercise { }
interface WorkoutLog { }
interface LoadDecision { }

// Input types: suffix with "Input"
interface CreateUserInput { }
interface ProgressionInput { }

// Output types: suffix with "Result" or "Decision"
interface SubstitutionResult { }
interface LoadDecision { }
```

### Organization

```
src/
├── index.ts          # Re-exports all types
├── exercise.ts       # Exercise domain types
├── training.ts       # Training domain types (programs, workouts, decisions)
└── user.ts           # User and preferences types
```

### Export Pattern

```typescript
// index.ts - barrel export
export * from "./exercise";
export * from "./training";
export * from "./user";

// Each file exports its types directly
// exercise.ts
export type MovementPattern = ...;
export interface Exercise { }
```

### Documentation

Use JSDoc for complex types:

```typescript
/**
 * Movement Pattern Taxonomy (12 patterns)
 * Categorizes exercises by their primary movement mechanics
 */
export type MovementPattern =
  | "squat"           // knee-dominant lower
  | "hinge"           // hip-dominant lower
  | "lunge"           // single-leg, split stance
  ...;

/**
 * Core Exercise entity
 * Represents a single exercise in the Exercise Library
 */
export interface Exercise {
  /** Unique identifier (kebab-case, e.g., "barbell-back-squat") */
  id: string;
  /** Display name */
  name: string;
  /** Alternative names for search */
  aliases: string[];
  ...
}
```

### Avoid These

```typescript
// ❌ Don't use `any`
interface BadType {
  data: any;
}

// ❌ Don't use `object`
interface BadType {
  config: object;
}

// ❌ Don't export implementation details
export interface _InternalType { } // Underscore prefix doesn't hide it

// ❌ Don't couple to database/framework types
import { SomeDbType } from "drizzle-orm"; // Keep types pure
```

### Best Practices

```typescript
// ✅ Use discriminated unions for type-safe handling
type Decision =
  | { type: "load"; action: "increase" | "maintain" | "decrease"; newWeight: number }
  | { type: "volume"; action: "add_set" | "maintain" | "reduce_set"; newSetCount: number };

// ✅ Use readonly for immutable data
interface Exercise {
  readonly id: string;
  readonly createdAt: Date;
}

// ✅ Use tuple types for fixed-length arrays
interface PlannedExercise {
  repRange: [number, number]; // [min, max]
}

// ✅ Use template literal types for constrained strings
type ExerciseId = `${string}-${string}`; // Enforces kebab-case pattern
```

### Type Safety Rules

1. **No `any`** - Use `unknown` and narrow with type guards
2. **No optional chaining abuse** - If a value should exist, don't make it optional
3. **Explicit return types** - Always type function returns in this package
4. **No type assertions** - Use type guards instead of `as`

### Testing

This package has no runtime code, so no tests are needed. TypeScript compilation is the test.

```bash
yarn typecheck  # Verifies all types compile
yarn build      # Generates .d.ts files
```

## Adding New Types

1. Identify which domain file the type belongs to
2. Add the type with JSDoc documentation
3. Export from `index.ts` if not already re-exported
4. Run `yarn typecheck` to verify
5. Update consuming packages as needed
