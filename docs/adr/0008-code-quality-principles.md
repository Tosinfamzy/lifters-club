# ADR-0008: Code Quality Principles

## Status

Accepted

## Date

2025-01-21

## Context

We need consistent code quality standards across the monorepo that:
- Make the codebase maintainable as it grows
- Enable multiple developers to work effectively
- Prevent common bugs and anti-patterns
- Keep the codebase simple and focused

## Decision

Apply **SOLID principles** pragmatically, enforce **DRY** through shared packages, and prioritize **simplicity** over cleverness.

### SOLID Principles Application

#### Single Responsibility (SRP)

Each decision function in the engine does one thing:

```typescript
// Good - single responsibility
export function calculateLoadProgression(input: ProgressionInput): LoadDecision
export function calculateVolumeAdjustment(input: VolumeInput): VolumeDecision
export function calculateDeloadNeed(input: DeloadInput): DeloadDecision

// Bad - multiple responsibilities
export function makeAllDecisions(input: AllInput): AllDecisions
```

#### Open/Closed (OCP)

Decision functions are configurable without modification:

```typescript
// Configurable thresholds, no code changes needed
interface ProgressionConfig {
  rpeThresholdForIncrease: number;  // default: 8
  rpeThresholdForDecrease: number;  // default: 9
  smallIncrement: number;         // default: 2.5
  largeIncrement: number;         // default: 5
}

export function calculateLoadProgression(
  input: ProgressionInput,
  config: ProgressionConfig = defaultConfig
): LoadDecision
```

#### Liskov Substitution (LSP)

All decision outputs follow consistent interfaces:

```typescript
// All decisions have action and reason
interface BaseDecision {
  reason: string;
}

interface LoadDecision extends BaseDecision {
  action: "increase" | "maintain" | "decrease";
  newWeight: number;
}

interface VolumeDecision extends BaseDecision {
  action: "add_set" | "maintain" | "reduce_set";
  newSetCount: number;
}
```

#### Interface Segregation (ISP)

Separate interfaces for different consumers:

```typescript
// For database operations
interface ExerciseRow { id: string; name: string; /* all fields */ }

// For API responses
interface ExerciseResponse { id: string; name: string; /* subset */ }

// For substitution queries
interface SubstitutionQuery { exerciseId: string; excludeEquipment?: string[]; }
```

#### Dependency Inversion (DIP)

Engine depends on abstractions, not database:

```typescript
// Engine takes data, doesn't fetch it
export function calculateLoadProgression(input: ProgressionInput): LoadDecision

// Service layer handles data fetching
class ProgressionService {
  constructor(private db: Database) {}

  async getProgression(exerciseId: string, userId: string) {
    const recentSets = await this.db.query.loggedSets.findMany(/* ... */);
    return calculateLoadProgression({ recentSets, /* ... */ });
  }
}
```

### DRY Strategy

DRY is enforced through shared packages, not premature abstraction:

| Duplication Type | Solution |
|------------------|----------|
| Types | `@gymapp/types` package |
| Validation schemas | `@gymapp/validation` package |
| Database queries | `@gymapp/db` package |
| Business logic | `@gymapp/engine` package |

**Important:** Don't abstract too early. Three similar lines is better than a wrong abstraction.

```typescript
// Acceptable duplication (similar but different context)
const userWorkouts = await db.query.workouts.findMany({
  where: eq(workouts.userId, userId)
});

const blockWorkouts = await db.query.workouts.findMany({
  where: eq(workouts.trainingBlockId, blockId)
});

// Over-abstraction (don't do this)
const findWorkouts = (field: string, value: string) => /* ... */
```

### Simplicity Guidelines

1. **No speculative features** - Only build what's needed now
2. **Minimal error handling** - Trust internal code, validate at boundaries
3. **No backwards-compatibility hacks** - Delete unused code completely
4. **Flat is better than nested** - Avoid deep abstractions
5. **Explicit is better than clever** - Readable code over smart code

```typescript
// Good - explicit and simple
async function getWorkoutWithSets(workoutId: string) {
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
  });

  if (!workout) return null;

  const sets = await db.query.loggedSets.findMany({
    where: eq(loggedSets.workoutLogId, workout.id),
  });

  return { ...workout, sets };
}

// Bad - overly clever
const getWorkoutWithSets = compose(
  map(attachSets),
  filter(Boolean),
  findWorkout
);
```

### Code Review Checklist

- [ ] Does it do one thing well? (SRP)
- [ ] Can it be configured without modification? (OCP)
- [ ] Are interfaces minimal and focused? (ISP)
- [ ] Does it depend on abstractions? (DIP)
- [ ] Is duplication in shared packages, not scattered? (DRY)
- [ ] Is it the simplest solution that works?
- [ ] No unused code or speculative features?
- [ ] No backwards-compatibility hacks?

## Consequences

### Positive

- Maintainable codebase as it grows
- Easy to test (especially engine)
- Clear boundaries between packages
- New developers can understand code quickly
- Refactoring is safe with test coverage

### Negative

- May need to refactor as requirements become clearer
- Some duplication allowed (pragmatic DRY)
- Requires discipline to not over-engineer

### Neutral

- Code reviews need to enforce principles
- Documentation of decisions helps (these ADRs)

## References

- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [The Wrong Abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction)
- [Simple Made Easy - Rich Hickey](https://www.infoq.com/presentations/Simple-Made-Easy/)
