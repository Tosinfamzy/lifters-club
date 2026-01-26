# @gymapp/validation - Development Standards

> Zod schemas for runtime validation across the Lifters Club monorepo.

## Purpose

This package provides **runtime validation schemas** that:
- Validate API inputs
- Parse external data safely
- Generate TypeScript types from schemas
- Share validation logic between frontend and backend

## Guidelines

### Schema Naming

```typescript
// Base schemas: lowercase noun + "Schema"
export const exerciseSchema = z.object({ ... });
export const userSchema = z.object({ ... });

// Action schemas: verb + noun + "Schema"
export const createExerciseSchema = exerciseSchema.omit({ id: true });
export const updateExerciseSchema = exerciseSchema.partial();

// Query schemas: noun + "QuerySchema"
export const substitutionQuerySchema = z.object({ ... });
```

### Type Inference

Always export inferred types alongside schemas:

```typescript
// Schema definition
export const createExerciseSchema = z.object({
  name: z.string().min(1).max(255),
  equipment: z.array(equipmentTypeSchema).min(1),
  difficulty: difficultySchema,
});

// Inferred type export
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;
```

### Enum Schemas

Use `z.enum()` for string unions that match `@gymapp/types`:

```typescript
// ✅ Good - matches the type definition exactly
export const difficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

// ✅ Good - for arrays of valid values
export const movementPatternSchema = z.enum([
  "squat",
  "hinge",
  "lunge",
  "push_horizontal",
  "push_vertical",
  "pull_horizontal",
  "pull_vertical",
  "carry",
  "core_anti",
  "isolation_upper",
  "isolation_lower",
  "conditioning",
]);

// Type can be extracted
type Difficulty = z.infer<typeof difficultySchema>;
```

### Composition Patterns

```typescript
// Base schema for reuse
const timestampsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Compose schemas
export const exerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  // ... other fields
}).merge(timestampsSchema);

// Omit for creation (no id, no timestamps)
export const createExerciseSchema = exerciseSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Partial for updates
export const updateExerciseSchema = createExerciseSchema.partial();
```

### Validation Messages

Provide clear error messages:

```typescript
export const createUserSchema = z.object({
  email: z.string()
    .email("Invalid email format")
    .min(1, "Email is required"),

  daysPerWeek: z.number()
    .int("Days per week must be a whole number")
    .min(1, "Must train at least 1 day per week")
    .max(7, "Cannot train more than 7 days per week"),

  sessionDurationMinutes: z.number()
    .int()
    .min(15, "Sessions must be at least 15 minutes")
    .max(180, "Sessions cannot exceed 3 hours"),
});
```

### Refinements

Use `.refine()` for complex validation:

```typescript
export const repRangeSchema = z.tuple([
  z.number().int().min(1),
  z.number().int().min(1),
]).refine(
  ([min, max]) => min <= max,
  { message: "Min reps must be less than or equal to max reps" }
);

export const plannedExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int().min(1).max(10),
  repRange: repRangeSchema,
  restSeconds: z.number().int().min(0).max(600),
});
```

### Transform

Use `.transform()` to normalize data:

```typescript
// Normalize email to lowercase
export const emailSchema = z.string()
  .email()
  .transform(email => email.toLowerCase());

// Parse date strings to Date objects
export const dateStringSchema = z.string()
  .datetime()
  .transform(str => new Date(str));
```

### Organization

```
src/
├── index.ts          # Re-exports all schemas
├── exercise.ts       # Exercise validation schemas
├── training.ts       # Training schemas (programs, workouts)
└── user.ts           # User and preferences schemas
```

### Best Practices

```typescript
// ✅ Use .default() for optional fields with defaults
export const userPreferencesSchema = z.object({
  focusAreas: z.array(muscleGroupSchema).optional(),
  daysPerWeek: z.number().int().min(1).max(7).default(3),
});

// ✅ Use .nullable() vs .optional() correctly
z.string().optional()   // string | undefined
z.string().nullable()   // string | null
z.string().nullish()    // string | null | undefined

// ✅ Use .strict() to reject unknown keys (API inputs)
export const createExerciseSchema = z.object({
  name: z.string(),
}).strict();

// ✅ Use .passthrough() when unknown keys are OK (internal)
export const configSchema = z.object({
  knownField: z.string(),
}).passthrough();
```

### Avoid These

```typescript
// ❌ Don't use z.any()
const badSchema = z.object({
  data: z.any(), // Defeats the purpose
});

// ❌ Don't duplicate type definitions
// Types should come from schema inference, not manual definition

// ❌ Don't skip error messages on user-facing validation
z.string().min(1); // Bad - generic error
z.string().min(1, "Name is required"); // Good - clear message
```

### Testing

Test edge cases and error messages:

```typescript
import { describe, it, expect } from "vitest";
import { createExerciseSchema } from "./exercise";

describe("createExerciseSchema", () => {
  it("validates a valid exercise", () => {
    const result = createExerciseSchema.safeParse({
      name: "Bench Press",
      equipment: ["barbell"],
      difficulty: "intermediate",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createExerciseSchema.safeParse({
      name: "",
      equipment: ["barbell"],
      difficulty: "intermediate",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain("required");
  });

  it("rejects invalid difficulty", () => {
    const result = createExerciseSchema.safeParse({
      name: "Test",
      equipment: ["barbell"],
      difficulty: "expert", // Invalid
    });
    expect(result.success).toBe(false);
  });
});
```

### Usage in API Routes

```typescript
import { zValidator } from "@hono/zod-validator";
import { createExerciseSchema } from "@gymapp/validation";

app.post("/exercises",
  zValidator("json", createExerciseSchema),
  async (c) => {
    const data = c.req.valid("json"); // Fully typed!
    // data is CreateExerciseInput
  }
);
```

## Adding New Schemas

1. Add schema to appropriate domain file
2. Export inferred type
3. Re-export from `index.ts`
4. Add tests for edge cases
5. Run `yarn typecheck` and `yarn test`
