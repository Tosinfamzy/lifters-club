# ADR-0002: Separate PostgreSQL Schemas

## Status

Accepted

## Date

2025-01-21

## Context

The application has two distinct domains:
1. **Exercise Library** - A canonical database of exercises with movement patterns, muscle groups, and substitution logic. This is designed to be a standalone, reusable product.
2. **Training System** - User data, programs, workouts, and the decision engine. This consumes the Exercise Library.

Both domains need `exercises` related data, but with different purposes:
- Exercise Library: The canonical exercise definitions
- Training: User's exercise preferences, logged exercises, program exercises

We need to decide how to organize these in the database.

## Decision

Use **two separate PostgreSQL schemas** within the same database:

```sql
CREATE SCHEMA exercise_lib;
CREATE SCHEMA training;
```

### Schema Allocation

**exercise_lib schema:**
- `exercises` - Canonical exercise definitions

**training schema:**
- `users`
- `programs`
- `training_blocks`
- `workouts`
- `workout_logs`
- `logged_sets`
- `decisions`

### Cross-Schema References

```sql
-- Training schema references exercise_lib by ID only
-- No foreign key constraint across schemas (loose coupling)
CREATE TABLE training.logged_sets (
  exercise_id VARCHAR(64) NOT NULL,  -- References exercise_lib.exercises.id
  ...
);
```

## Consequences

### Positive

- Clear logical separation matching domain boundaries
- Prevents table naming conflicts (both domains have "exercise" concepts)
- Exercise Library can be extracted to separate database later if needed
- Independent migrations per schema
- Clearer ownership and boundaries

### Negative

- Slightly more complex migration management (need to specify schema)
- Cross-schema queries require explicit schema references
- No foreign key constraints across schemas (by design, for loose coupling)

### Neutral

- Need to configure Drizzle for multiple schemas
- Backup/restore can target specific schemas if needed

## Alternatives Considered

| Alternative | Pros | Cons | Why Not Chosen |
|-------------|------|------|----------------|
| Single schema, prefixed tables | Simpler setup | Naming conflicts, unclear boundaries | Doesn't scale with complexity |
| Separate databases | Full isolation | Connection overhead, harder local dev | Overkill, adds operational complexity |
| Single schema, no prefix | Simplest | Naming conflicts inevitable | `exercises` table collision |

## References

- [PostgreSQL Schemas Documentation](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [Drizzle Multi-Schema Support](https://orm.drizzle.team/docs/schemas)
