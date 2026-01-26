# ADR-0005: PowerSync for Offline-First Sync

## Status

**Superseded** by [ADR-0009](./0009-simple-offline-queue.md)

> PowerSync was evaluated but ultimately removed due to complexity of self-hosting requirements (MongoDB replica set, PostgreSQL logical replication) and sync rule limitations (no JOINs/subqueries, making user-scoped filtering difficult). Replaced with a simpler MMKV + offline queue approach.

## Date

2025-01-21

## Context

Users will log workouts at the gym where connectivity is often unreliable. This is a core use case, not an edge case. We need:

- Immediate UI feedback when logging sets (no spinners waiting for network)
- Workouts logged offline must sync when connectivity returns
- Data consistency across multiple devices
- No data loss even if the app crashes while offline

Building reliable sync is notoriously difficult:
- Mutation ordering (what if set 3 syncs before set 1?)
- Partial failures (half the workout synced, then crash)
- Retry logic with backoff
- Queue persistence across app restarts
- Conflict resolution

## Decision

Use **PowerSync** for bi-directional offline-first sync.

### Architecture

```
┌─────────────────────────────────────────┐
│  Next.js Frontend                       │
│  ┌───────────────────────────────────┐  │
│  │  PowerSync React SDK              │  │
│  │  - useQuery() for reactive reads  │  │
│  │  - Built-in upload queue          │  │
│  └───────────────────────────────────┘  │
│                    │                    │
│  ┌───────────────────────────────────┐  │
│  │  SQLite (wa-sqlite in browser)    │  │
│  │  - Local-first storage            │  │
│  │  - Survives offline/refresh       │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌─────────────────┐    ┌─────────────────┐
│ PowerSync       │    │ Hono Backend    │
│ Service         │    │                 │
│ (self-hosted)   │    │ /api/sync/upload│
│                 │    │ - Validates     │
│ - Reads PG WAL  │    │ - Writes to PG  │
│ - Applies Sync  │    │                 │
│   Rules         │    │                 │
└────────┬────────┘    └────────┬────────┘
         │                      │
         └──────────┬───────────┘
                    ▼
         ┌─────────────────────┐
         │  PostgreSQL         │
         │  - exercise_lib     │
         │  - training         │
         └─────────────────────┘
```

### Sync Rules Configuration

```yaml
# sync-rules.yaml
bucket_definitions:
  # User's own data
  user_data:
    parameters:
      - name: user_id
        type: string
    data:
      - SELECT * FROM training.users WHERE id = :user_id
      - SELECT * FROM training.training_blocks WHERE user_id = :user_id
      - SELECT * FROM training.workouts
        WHERE training_block_id IN (
          SELECT id FROM training.training_blocks WHERE user_id = :user_id
        )
      - SELECT * FROM training.workout_logs WHERE user_id = :user_id
      - SELECT * FROM training.logged_sets
        WHERE workout_log_id IN (
          SELECT id FROM training.workout_logs WHERE user_id = :user_id
        )

  # Exercise library - synced for all users
  exercise_library:
    data:
      - SELECT * FROM exercise_lib.exercises
```

### Client Usage

```typescript
import { useQuery, usePowerSync } from "@powersync/react";

function WorkoutLogger({ workoutId }) {
  // Reactive query - updates automatically
  const { data: sets } = useQuery(
    `SELECT * FROM logged_sets WHERE workout_log_id = ? ORDER BY set_number`,
    [workoutId]
  );

  const powerSync = usePowerSync();

  const logSet = async (setData) => {
    // Writes to local SQLite immediately
    // PowerSync queues for upload automatically
    await powerSync.execute(
      `INSERT INTO logged_sets (id, workout_log_id, exercise_id, set_number, weight, reps)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuid(), workoutId, setData.exerciseId, setData.setNumber, setData.weight, setData.reps]
    );
  };

  // UI updates instantly, no loading state needed
}
```

### Deployment

Using PowerSync Open Edition (self-hosted, free):

```yaml
# docker-compose.yml
services:
  powersync:
    image: journeyapps/powersync-service:latest
    environment:
      POWERSYNC_DATABASE_URL: postgres://...
      POWERSYNC_JWT_SECRET: ${JWT_SECRET}
    ports:
      - "8080:8080"
    depends_on:
      - db
```

## Consequences

### Positive

- **Offline writes work out of the box** - No DIY sync queue
- Built-in upload queue with retry logic
- Sync Rules handle partial replication elegantly
- Uses PostgreSQL WAL - fits our existing stack perfectly
- Self-hostable Open Edition is free
- First-class offline support is their core differentiator
- Reactive queries update UI automatically

### Negative

- Additional service to deploy and manage
- Learning curve for Sync Rules
- Cloud free tier has limitations (2GB/month, deactivates after 1 week idle)
- Pro tier costs $49/month if cloud-hosted

### Neutral

- Client uses SQLite (wa-sqlite) - different from server's Postgres
- Need to implement upload handler endpoint
- Schema needs to be compatible with both Drizzle (server) and PowerSync (client)

## Alternatives Considered

| Alternative | Pros | Cons | Why Not Chosen |
|-------------|------|------|----------------|
| ElectricSQL | Open source, Postgres native | Read-path only, offline writes require custom implementation | Doesn't solve our core problem |
| Custom sync (IndexedDB + queue) | Full control, no vendor | Underestimated complexity, edge cases everywhere | Building sync is a trap |
| Replicache | Battle-tested, great DX | Subscription pricing, specific backend patterns | Cost and lock-in concerns |
| No offline support | Simplest | Users can't log at gym with bad wifi | Fails core use case |

## References

- [PowerSync Documentation](https://docs.powersync.com)
- [PowerSync React SDK](https://www.npmjs.com/package/@powersync/react)
- [PowerSync Open Edition](https://www.powersync.com/pricing)
- [Sync Rules Documentation](https://docs.powersync.com/usage/sync-rules)
- [PowerSync + Supabase Guide](https://docs.powersync.com/integration-guides/supabase-+-powersync)
