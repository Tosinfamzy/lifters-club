# ADR-0004: Drizzle ORM

## Status

Accepted

## Date

2025-01-21

## Context

We need an ORM/query builder for PostgreSQL that provides:
- Type-safe database queries
- Migration management
- Good developer experience
- Fast startup time (for potential serverless deployment)
- PostgreSQL-specific feature support (JSONB, schemas)

## Decision

Use **Drizzle ORM** for all database operations.

### Schema Definition

```typescript
// packages/db/src/schema/exercise-lib.ts
import { pgSchema, varchar, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";

export const exerciseLib = pgSchema("exercise_lib");

export const exercises = exerciseLib.table("exercises", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  equipment: jsonb("equipment").$type<string[]>().notNull(),
  movementPatterns: jsonb("movement_patterns").$type<string[]>().notNull(),
  primaryMuscles: jsonb("primary_muscles").$type<string[]>().notNull(),
  isCompound: boolean("is_compound").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Query Examples

```typescript
// SQL-like syntax
const allExercises = await db.select().from(exercises);

// With conditions
const squats = await db
  .select()
  .from(exercises)
  .where(sql`${exercises.movementPatterns} @> '["squat"]'`);

// Joins
const workoutWithSets = await db
  .select()
  .from(workoutLogs)
  .leftJoin(loggedSets, eq(loggedSets.workoutLogId, workoutLogs.id))
  .where(eq(workoutLogs.id, workoutId));
```

### Migration Workflow

```bash
# Generate migration from schema changes
pnpm drizzle-kit generate

# Apply migrations
pnpm drizzle-kit migrate

# Push schema directly (dev only)
pnpm drizzle-kit push

# Open Drizzle Studio
pnpm drizzle-kit studio
```

## Consequences

### Positive

- Lightweight, no heavy Rust binary (unlike Prisma)
- SQL-like syntax with full TypeScript inference
- Fast startup time (critical for serverless/edge)
- Two-step migrations (generate SQL, then apply) give more control
- Excellent PostgreSQL support including JSONB operators
- Multiple schema support built-in
- Drizzle Studio for visual database exploration

### Negative

- Smaller ecosystem than Prisma
- Less abstraction (closer to SQL, which is also a pro)
- Relations syntax different from Prisma's intuitive approach

### Neutral

- Two-step migration process (generate then apply) vs Prisma's single step
- Need to learn Drizzle-specific patterns

## Alternatives Considered

| Alternative | Pros | Cons | Why Not Chosen |
|-------------|------|------|----------------|
| Prisma | Great DX, large ecosystem, intuitive relations | Heavy binary, slow cold starts, introspection issues | Performance concerns for serverless |
| Kysely | Type-safe, lightweight | Less mature, smaller ecosystem | Drizzle has better DX |
| Raw SQL + pg | Maximum control | No type safety, more boilerplate | Too much manual work |
| TypeORM | Full ORM features | Heavy, decorator-based, slower | Architectural complexity |

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle PostgreSQL Guide](https://orm.drizzle.team/docs/get-started-postgresql)
- [Drizzle Kit CLI](https://orm.drizzle.team/kit-docs/overview)
- [2025 Drizzle Best Practices](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717)
