# @gymapp/db - Development Standards

> Drizzle ORM schemas and database utilities for the Lifters Club monorepo.

## Purpose

This package provides:
- Drizzle schema definitions for PostgreSQL
- Database client configuration
- Migration management
- Seed scripts

## Schema Organization

### Two Schemas, One Database

```
PostgreSQL Database
├── exercise_lib schema    # Standalone Exercise Library
│   └── exercises table
│
└── training schema        # Training application
    ├── users
    ├── programs
    ├── training_blocks
    ├── workouts
    ├── workout_logs
    ├── logged_sets
    └── decisions
```

### File Structure

```
src/
├── index.ts              # Exports db client and all schemas
├── client.ts             # Drizzle client setup
├── schema/
│   ├── index.ts          # Re-exports all schemas
│   ├── exercise-lib.ts   # exercise_lib schema
│   └── training.ts       # training schema
└── seed.ts               # Seed script
```

## Drizzle Patterns

### Schema Definition

```typescript
import { pgSchema, varchar, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";

// Create a named schema
export const exerciseLib = pgSchema("exercise_lib");

// Define tables within the schema
export const exercises = exerciseLib.table("exercises", {
  // Primary key - use varchar for semantic IDs
  id: varchar("id", { length: 64 }).primaryKey(),

  // Required string fields
  name: varchar("name", { length: 255 }).notNull(),

  // JSON arrays with type annotation
  equipment: jsonb("equipment").$type<string[]>().notNull(),
  aliases: jsonb("aliases").$type<string[]>().default([]),

  // Booleans
  isCompound: boolean("is_compound").notNull(),
  isUnilateral: boolean("is_unilateral").notNull().default(false),

  // Enums as varchar (simpler than PG enums for migrations)
  difficulty: varchar("difficulty", { length: 20 }).notNull(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### Column Naming

```typescript
// ✅ Database columns: snake_case
created_at, training_level, primary_muscles, workout_log_id

// ✅ TypeScript properties: camelCase (Drizzle maps automatically)
exercises.createdAt  // Maps to created_at column
```

### Foreign Keys

```typescript
export const trainingBlocks = training.table("training_blocks", {
  id: varchar("id", { length: 64 }).primaryKey(),

  // Foreign key with explicit reference
  userId: varchar("user_id", { length: 64 })
    .notNull()
    .references(() => users.id),

  programId: varchar("program_id", { length: 64 })
    .notNull()
    .references(() => programs.id),
});
```

### JSON Columns

```typescript
// ✅ Type-safe JSON with $type<T>()
preferences: jsonb("preferences").$type<UserPreferences>().notNull(),
template: jsonb("template").$type<ProgramTemplate>().notNull(),
plannedExercises: jsonb("planned_exercises").$type<PlannedExercise[]>().notNull(),

// ✅ JSON arrays
aliases: jsonb("aliases").$type<string[]>().default([]),
```

### Nullable vs NotNull

```typescript
// Required field - use .notNull()
email: varchar("email", { length: 255 }).notNull(),

// Optional field - omit .notNull()
notes: text("notes"),  // Nullable
endDate: date("end_date"),  // Nullable

// Optional with default
status: varchar("status", { length: 20 }).notNull().default("pending"),
```

## Query Patterns

### Basic Queries

```typescript
import { db } from "@gymapp/db";
import { exercises } from "@gymapp/db/schema";
import { eq, and, or, sql } from "drizzle-orm";

// Select all
const allExercises = await db.select().from(exercises);

// Select with where
const squats = await db
  .select()
  .from(exercises)
  .where(eq(exercises.difficulty, "intermediate"));

// Select specific columns
const names = await db
  .select({ id: exercises.id, name: exercises.name })
  .from(exercises);
```

### JSON Queries (PostgreSQL)

```typescript
// Query JSON array containment
const squatExercises = await db
  .select()
  .from(exercises)
  .where(sql`${exercises.movementPatterns} @> '["squat"]'`);

// Query JSON array overlap (any match)
const compoundLifts = await db
  .select()
  .from(exercises)
  .where(sql`${exercises.primaryMuscles} && '["quads", "glutes"]'`);
```

### Joins

```typescript
import { workouts, workoutLogs, loggedSets } from "@gymapp/db/schema";

// Inner join
const workoutsWithLogs = await db
  .select()
  .from(workouts)
  .innerJoin(workoutLogs, eq(workoutLogs.workoutId, workouts.id));

// Left join
const workoutsWithOptionalLogs = await db
  .select()
  .from(workouts)
  .leftJoin(workoutLogs, eq(workoutLogs.workoutId, workouts.id));
```

### Inserts

```typescript
// Single insert
await db.insert(exercises).values({
  id: "barbell-back-squat",
  name: "Barbell Back Squat",
  equipment: ["barbell"],
  movementPatterns: ["squat"],
  primaryMuscles: ["quads", "glutes"],
  secondaryMuscles: ["hamstrings", "core"],
  isCompound: true,
  isUnilateral: false,
  difficulty: "intermediate",
});

// Bulk insert
await db.insert(exercises).values([
  { id: "exercise-1", ... },
  { id: "exercise-2", ... },
]);

// Insert returning
const [inserted] = await db
  .insert(exercises)
  .values({ ... })
  .returning();
```

### Updates

```typescript
// Update by ID
await db
  .update(exercises)
  .set({ name: "New Name", updatedAt: new Date() })
  .where(eq(exercises.id, exerciseId));

// Update returning
const [updated] = await db
  .update(exercises)
  .set({ ... })
  .where(eq(exercises.id, exerciseId))
  .returning();
```

### Deletes

```typescript
// Delete by ID
await db.delete(exercises).where(eq(exercises.id, exerciseId));

// Soft delete pattern (if using)
await db
  .update(exercises)
  .set({ deletedAt: new Date() })
  .where(eq(exercises.id, exerciseId));
```

## Migration Guidelines

### Workflow

```bash
# 1. Modify schema files
# 2. Generate migration
yarn db:generate

# 3. Review generated SQL in migrations/
# 4. Apply migration
yarn db:migrate

# Development: push schema directly (skips migration files)
yarn db:push
```

### Migration Best Practices

```typescript
// ✅ Use varchar for IDs (allows semantic naming)
id: varchar("id", { length: 64 }).primaryKey(),

// ✅ Use varchar for enums (easier migrations than PG enums)
difficulty: varchar("difficulty", { length: 20 }).notNull(),

// ✅ Always add createdAt
createdAt: timestamp("created_at").defaultNow().notNull(),

// ✅ Add updatedAt for mutable entities
updatedAt: timestamp("updated_at").defaultNow().notNull(),

// ✅ Add indexes for frequently queried columns
// (Define in schema or add via raw SQL in migration)
```

### Backwards Compatible Changes

Safe migrations (no data loss):
- Adding nullable columns
- Adding tables
- Adding indexes
- Widening varchar length

Unsafe migrations (require care):
- Dropping columns/tables
- Renaming columns/tables
- Changing column types
- Adding NOT NULL to existing column

## ID Generation

Use semantic, readable IDs:

```typescript
// ✅ Good - semantic IDs for exercises
"barbell-back-squat"
"dumbbell-bench-press"
"pull-up"

// ✅ Good - UUID or nanoid for user-generated content
import { nanoid } from "nanoid";
const id = nanoid(); // "V1StGXR8_Z5jdHi6B-myT"

// ❌ Bad - auto-incrementing integers (leak info, hard to shard)
id: serial("id").primaryKey(),
```

## Testing

### Test Database Setup

```typescript
// tests/setup.ts
import { db } from "@gymapp/db";
import { exercises } from "@gymapp/db/schema";

beforeEach(async () => {
  // Clean up before each test
  await db.delete(exercises);
});

afterAll(async () => {
  // Close connection
  await db.$client.end();
});
```

### Integration Tests

```typescript
describe("exercises table", () => {
  it("inserts and retrieves an exercise", async () => {
    await db.insert(exercises).values({
      id: "test-exercise",
      name: "Test Exercise",
      equipment: ["barbell"],
      movementPatterns: ["squat"],
      primaryMuscles: ["quads"],
      isCompound: true,
      difficulty: "beginner",
    });

    const [result] = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, "test-exercise"));

    expect(result.name).toBe("Test Exercise");
    expect(result.equipment).toEqual(["barbell"]);
  });
});
```

## Best Practices

```typescript
// ✅ Always handle not found
const exercise = await db
  .select()
  .from(exercises)
  .where(eq(exercises.id, id))
  .limit(1);

if (exercise.length === 0) {
  throw new NotFoundError(`Exercise ${id} not found`);
}

// ✅ Use transactions for related writes
await db.transaction(async (tx) => {
  await tx.insert(workoutLogs).values({ ... });
  await tx.insert(loggedSets).values([...]);
});

// ✅ Limit results for list queries
const recentWorkouts = await db
  .select()
  .from(workouts)
  .where(eq(workouts.userId, userId))
  .orderBy(desc(workouts.scheduledDate))
  .limit(10);
```

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle PostgreSQL Guide](https://orm.drizzle.team/docs/get-started/postgresql-new)
- [Drizzle Best Practices 2025](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717)
