# @gymapp/engine - Development Standards

> Pure function decision engine for training progression logic.

## Purpose

This package contains the **core business logic** of Lifters Club. It implements the 7 decision types:

1. **Load progression** - increase/maintain/decrease weight
2. **Volume adjustment** - add/maintain/reduce sets
3. **Exercise rotation** - keep or swap exercises
4. **Deload recommendation** - suggest recovery weeks
5. **Session recovery** - adjust for poor recovery
6. **Missed session** - handle skipped workouts
7. **Weekly plan update** - generate next week's plan

## Core Principle: Pure Functions

Every decision function must be **pure**:
- No side effects
- No database calls
- No external API calls
- Same input always produces same output

```typescript
// ✅ Good - pure function
export function calculateLoadProgression(input: ProgressionInput): LoadDecision {
  // Only uses input data, no external calls
  const avgReps = input.recentSets.reduce((sum, s) => sum + s.reps, 0) / input.recentSets.length;
  // ... calculation logic
  return { action: "increase", newWeight: 105, reason: "..." };
}

// ❌ Bad - impure function
export async function calculateLoadProgression(exerciseId: string): LoadDecision {
  const sets = await db.query(...); // Database call
  const settings = await fetchUserSettings(); // API call
  // ...
}
```

## File Structure

```
src/
├── index.ts          # Public exports
├── types.ts          # Input types for decision functions
├── progression.ts    # Load progression logic
├── volume.ts         # Volume adjustment logic
├── rotation.ts       # Exercise rotation logic
├── deload.ts         # Deload detection logic
├── recovery.ts       # Session recovery adjustment (Phase 6)
├── missed-session.ts # Missed session handling (Phase 6)
└── planning.ts       # Weekly plan generation (Phase 4)
```

## Function Design Pattern

### Input Types

Each decision function has a dedicated input type:

```typescript
// types.ts
export interface ProgressionInput {
  exerciseId: string;
  recentSets: Pick<LoggedSet, "reps" | "rpe" | "weight">[];
  currentWeight: number;
  targetRepRange: [number, number];
}

export interface VolumeInput {
  exerciseId: string;
  currentSetCount: number;
  recentPerformance: {
    completedSets: number;
    targetSets: number;
    avgRpe: number;
  }[];
  maxSetsPerExercise?: number;
  minSetsPerExercise?: number;
}
```

### Configuration Pattern

Make thresholds configurable:

```typescript
export interface ProgressionConfig {
  rpeThresholdForIncrease: number;  // default: 8
  rpeThresholdForDecrease: number;  // default: 9
  smallIncrementKg: number;         // default: 2.5
  largeIncrementKg: number;         // default: 5
  weightThresholdForLargeIncrement: number; // default: 50
}

const defaultConfig: ProgressionConfig = {
  rpeThresholdForIncrease: 8,
  rpeThresholdForDecrease: 9,
  smallIncrementKg: 2.5,
  largeIncrementKg: 5,
  weightThresholdForLargeIncrement: 50,
};

export function calculateLoadProgression(
  input: ProgressionInput,
  config: ProgressionConfig = defaultConfig
): LoadDecision {
  // Use config values, not hardcoded numbers
}
```

### Output Types

All decisions return a consistent structure:

```typescript
// From @gymapp/types
interface LoadDecision {
  action: "increase" | "maintain" | "decrease";
  newWeight: number;
  reason: string;  // Human-readable explanation
}

interface VolumeDecision {
  action: "add_set" | "maintain" | "reduce_set";
  newSetCount: number;
  reason: string;
}
```

### Reason Strings

Always provide clear, data-backed reasons:

```typescript
// ✅ Good - specific and actionable
return {
  action: "increase",
  newWeight: 105,
  reason: `Averaging 10.0 reps at RPE 7.0 — ready to progress`,
};

return {
  action: "decrease",
  newWeight: 95,
  reason: `Averaging 6.0 reps at RPE 9.5 — reduce load to maintain quality`,
};

// ❌ Bad - vague
return {
  action: "increase",
  newWeight: 105,
  reason: "You're doing well",
};
```

## Testing Standards

### Coverage Requirement: 90%+

This package is the core business logic. High test coverage is mandatory.

### Test Categories

```typescript
describe("calculateLoadProgression", () => {
  describe("increase scenarios", () => {
    it("increases when hitting top of rep range with low RPE", () => {});
    it("uses small increment for lighter weights", () => {});
    it("uses large increment for heavier weights", () => {});
  });

  describe("maintain scenarios", () => {
    it("maintains when within rep range and moderate RPE", () => {});
    it("maintains with no recent data", () => {});
  });

  describe("decrease scenarios", () => {
    it("decreases when below rep range", () => {});
    it("decreases when RPE is too high", () => {});
  });

  describe("edge cases", () => {
    it("handles empty sets array", () => {});
    it("handles missing RPE values", () => {});
    it("handles zero weight", () => {});
    it("respects custom config", () => {});
  });
});
```

### Test Data Factories

```typescript
// test/factories.ts
export function createProgressionInput(
  overrides: Partial<ProgressionInput> = {}
): ProgressionInput {
  return {
    exerciseId: "bench-press",
    recentSets: [
      { reps: 8, rpe: 7, weight: 100 },
      { reps: 8, rpe: 7, weight: 100 },
      { reps: 8, rpe: 8, weight: 100 },
    ],
    currentWeight: 100,
    targetRepRange: [8, 10],
    ...overrides,
  };
}
```

### Parameterized Tests

```typescript
it.each([
  { reps: 10, rpe: 7, expected: "increase" },
  { reps: 8, rpe: 8, expected: "maintain" },
  { reps: 6, rpe: 9, expected: "decrease" },
])("returns $expected when reps=$reps and rpe=$rpe", ({ reps, rpe, expected }) => {
  const input = createProgressionInput({
    recentSets: [{ reps, rpe, weight: 100 }],
  });
  const result = calculateLoadProgression(input);
  expect(result.action).toBe(expected);
});
```

## Algorithm Documentation

Document the logic behind each decision:

```typescript
/**
 * Calculate whether to increase, maintain, or decrease weight
 * based on recent set performance.
 *
 * Decision Logic:
 * - INCREASE: Avg reps >= max rep range AND avg RPE < 8
 *   (hitting target with room to spare)
 * - DECREASE: Avg reps < min rep range OR avg RPE > 9
 *   (struggling or grinding)
 * - MAINTAIN: Otherwise
 *
 * Increment Logic:
 * - Weight < 50kg: use 2.5kg increments
 * - Weight >= 50kg: use 5kg increments
 *
 * @param input - Recent performance data
 * @param config - Configurable thresholds (optional)
 * @returns Decision with action, new weight, and reason
 */
export function calculateLoadProgression(
  input: ProgressionInput,
  config: ProgressionConfig = defaultConfig
): LoadDecision {
```

## Helper Functions

Extract reusable calculations:

```typescript
// ✅ Good - small, focused helper
function calculateAverageRpe(sets: { rpe?: number }[]): number {
  const setsWithRpe = sets.filter(s => s.rpe !== undefined);
  if (setsWithRpe.length === 0) return 7; // sensible default
  return setsWithRpe.reduce((sum, s) => sum + s.rpe!, 0) / setsWithRpe.length;
}

function calculateAverageReps(sets: { reps: number }[]): number {
  if (sets.length === 0) return 0;
  return sets.reduce((sum, s) => sum + s.reps, 0) / sets.length;
}
```

## Avoid These

```typescript
// ❌ No database calls
import { db } from "@gymapp/db";
const data = await db.query(...);

// ❌ No external API calls
const response = await fetch(...);

// ❌ No global state mutation
let cache = {};
function calculate() { cache = {...}; }

// ❌ No Date.now() or random values (makes testing hard)
const decision = input.rpe > Math.random() * 10;

// ❌ No hardcoded magic numbers
if (avgRpe > 8.5) { // Use config instead
```

## Integration with Service Layer

The engine is called from the service layer which handles data fetching:

```typescript
// apps/server/src/services/progression.service.ts
import { calculateLoadProgression } from "@gymapp/engine";
import { db } from "@gymapp/db";

export class ProgressionService {
  async getLoadDecision(exerciseId: string, userId: string): Promise<LoadDecision> {
    // Service fetches data
    const recentSets = await this.getRecentSets(exerciseId, userId);
    const currentWeight = await this.getCurrentWeight(exerciseId, userId);

    // Engine makes decision (pure function)
    return calculateLoadProgression({
      exerciseId,
      recentSets,
      currentWeight,
      targetRepRange: [8, 10],
    });
  }
}
```

## References

- [Clean Code - Pure Functions](https://github.com/labs42io/clean-code-typescript#functions)
- [Functional Core, Imperative Shell](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell)
- [Testing Pure Functions](https://kentcdodds.com/blog/testing-implementation-details)
