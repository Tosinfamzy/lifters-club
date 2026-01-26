# ADR-0009: Simple Offline Queue with MMKV

## Status

Accepted

## Date

2025-01-25

## Context

We initially chose PowerSync (ADR-0005) for offline-first sync, but encountered significant implementation challenges:

1. **Self-hosting complexity**: PowerSync requires MongoDB with replica set configuration for bucket storage, plus PostgreSQL with logical replication enabled
2. **Sync rule limitations**: PowerSync sync rules don't support JOINs or subqueries, making it impossible to filter related tables (e.g., `logged_sets` by user) without schema denormalization
3. **Infrastructure overhead**: Additional services (PowerSync, MongoDB) increased deployment complexity

Our actual offline requirements are simpler than what PowerSync solves:
- Cache the current workout for offline access
- Queue set logging operations when offline
- Sync queued operations when back online
- Show offline status to users

## Decision

Replace PowerSync with a **simple offline queue** using:

- **MMKV** for fast key-value storage (workout cache, offline queue)
- **React Query** for data fetching with built-in caching
- **NetInfo** for network state detection
- **Custom queue processor** for syncing when online

### Architecture

```
┌─────────────────────────────────────────┐
│  React Native App                       │
│  ┌───────────────────────────────────┐  │
│  │  useWorkoutOffline Hook           │  │
│  │  - Fetches & caches workout       │  │
│  │  - Queues mutations when offline  │  │
│  │  - Optimistic UI updates          │  │
│  └───────────────────────────────────┘  │
│                    │                    │
│  ┌───────────────────────────────────┐  │
│  │  MMKV Storage                     │  │
│  │  - Cached workout data            │  │
│  │  - Offline mutation queue         │  │
│  └───────────────────────────────────┘  │
│                    │                    │
│  ┌───────────────────────────────────┐  │
│  │  OfflineProvider                  │  │
│  │  - Network state monitoring       │  │
│  │  - Auto-sync when online          │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                     │
                     ▼ (when online)
         ┌─────────────────────┐
         │  Hono Backend API   │
         │  - /api/workouts    │
         │  - /api/workout-logs│
         │  - /api/logged-sets │
         └─────────────────────┘
                     │
                     ▼
         ┌─────────────────────┐
         │  PostgreSQL         │
         └─────────────────────┘
```

### Offline Queue Operations

```typescript
type QueuedOperation =
  | { type: "CREATE_WORKOUT_LOG"; data: WorkoutLog }
  | { type: "UPDATE_WORKOUT_LOG"; data: Partial<WorkoutLog> }
  | { type: "CREATE_LOGGED_SET"; data: LoggedSet }
  | { type: "UPDATE_LOGGED_SET"; data: Partial<LoggedSet> }
  | { type: "DELETE_LOGGED_SET"; data: { id: string } };
```

### Usage

```typescript
function WorkoutScreen({ workoutId }) {
  const {
    workout,
    workoutLog,
    loggedSets,
    isLoading,
    isOnline,
    startWorkout,
    logSet,
    completeWorkout,
  } = useWorkoutOffline(workoutId);

  // Works offline - queued for sync
  const handleLogSet = async () => {
    await logSet(exerciseId, setNumber, weight, reps, rpe);
  };
}
```

## Consequences

### Positive

- **Simple infrastructure**: No additional services beyond existing PostgreSQL
- **Easy to understand**: Standard REST API calls with local caching
- **Fast storage**: MMKV is significantly faster than AsyncStorage
- **Flexible**: Can add new operation types without sync rule changes
- **Debuggable**: Queue is just JSON in MMKV, easy to inspect

### Negative

- **No bi-directional sync**: Changes from other devices won't appear until refresh
- **Manual conflict handling**: If needed, must implement ourselves
- **Limited to current workout**: Doesn't sync historical data for offline viewing

### Neutral

- **Optimistic updates**: Must handle manually (but gives full control)
- **Queue processing**: Simple retry logic, no sophisticated backoff

## Why This Works For Us

Our use case is narrowly scoped:
1. User opens workout screen (fetches & caches workout)
2. User logs sets (may be offline)
3. Sets sync when connectivity returns
4. User doesn't need to see other devices' changes in real-time

We don't need:
- Real-time collaboration
- Offline access to historical workouts
- Bi-directional sync of all data

## Implementation

Key files:
- `apps/mobile/lib/offline/storage.ts` - MMKV wrapper
- `apps/mobile/lib/offline/queue.ts` - Offline mutation queue
- `apps/mobile/providers/offline-provider.tsx` - Network state & auto-sync
- `apps/mobile/hooks/use-workout-offline.ts` - Main hook

## References

- [MMKV](https://github.com/mrousavy/react-native-mmkv) - Fast key-value storage
- [React Query](https://tanstack.com/query) - Data fetching with caching
- [NetInfo](https://github.com/react-native-netinfo/react-native-netinfo) - Network state
