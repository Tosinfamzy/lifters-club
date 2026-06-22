# Plan: Full offline sync (ROADMAP 3a)

> Mobile has basic offline set-queueing but not full reconnect-flush sync. Build it out on the
> **simple-queue** approach (ADR-0009; ADR-0005/PowerSync is *superseded*). Append-only, single-user
> data → near-zero conflict surface, so this is bounded engineering, not a re-platform.

## Signed-off decisions (2026-06-22)
- **Architecture:** stay with the simple queue (AsyncStorage + custom queue + NetInfo). Confirmed.
- **Idempotency:** PK-upsert on a **client-supplied `id`** — `INSERT … ON CONFLICT (id) DO NOTHING`,
  return the row. No new unique constraint, **no migration** (the `varchar(64)` PK already exists),
  no middleware. A re-sent set/log becomes a no-op.
- **No DB unique constraint** on `(workout_log_id, exercise_id, set_number)` — would break legit edits/
  re-logs; PK-as-idempotency-key is sufficient.
- **Conflict handling:** none beyond idempotent replay (implicit last-write-wins; single writer).
- **Dead-letter:** build the store + **minimal UX** (failed-op count + retry) so gym data is never
  silently dropped. Defer the **AsyncStorage→MMKV** migration (AsyncStorage works; just update ADR-0009
  to match reality later).
- **Scope this round:** PR-1 + PR-2 (foundation), then reassess.

## Verified bug (the foundation fixes a real defect)
`POST /api/logs/:logId/sets` validates with `createSetSchema` where **`id` is REQUIRED**
(`apps/server/src/routes/logs.ts:403`, no `.optional()`; handler inserts `data.id` at `:463`). But the
mobile client omits it: `createLoggedSet` sends `{exerciseId,setNumber,weight,reps,rpe?,notes?}`
(`apps/mobile/lib/api.ts` ~`:569`). Same for `createWorkoutLog` (no `id`) and `completeWorkoutLog`
(no `completedAt`, required by `completeWorkoutLogSchema` at `logs.ts:32`). → the **online** logging
path would 400; unnoticed because the app is pre-launch and failures fall through to the offline queue.

## PR breakdown
- **PR-1 — client id/completedAt fix (mobile, S)** *(this round)*: thread the client-generated stable
  `id` from the caller (`use-workout-offline.ts` already mints `offline-…` ids) into
  `createWorkoutLog`/`createLoggedSet`, and send `completedAt` on `completeWorkoutLog`. Fixes the 400
  bug and is the foundation for idempotent replay.
- **PR-2 — server idempotent upsert (server, M)** *(this round)*: `.onConflictDoNothing({target: id})`
  on the `loggedSets` and `workoutLogs` inserts (`logs.ts:460-472`, `:170-179`), returning the
  existing/inserted row; retire the racy existence-precheck/409. Tests for duplicate-id replay → same
  row, 2xx. **No migration.**
- **PR-3 — decision-outcome 409-tolerant replay (mobile, S)**: treat 409 from `/decisions/:id/outcome`
  as success in the queue processor (matches the log path).
- **PR-4 — exponential backoff + error classification (mobile, M)**: `nextRetryAt` on the queue item;
  skip future items; 4xx = permanent (→ dead-letter), 5xx/timeout/offline = transient (→ backoff).
- **PR-5 — dead-letter store + no silent drops (mobile, M)**: move exhausted/permanent-fail ops to a
  `DEAD_LETTER` store instead of dropping; expose `deadLetterCount`. (UX surfacing per sign-off.)
- **PR-6 — deferred ≠ failed (mobile, S/M)**: a set whose workout-log dependency isn't resolved yet
  must not consume retry budget (today it drops at retry ≥3).
- **PR-7 — AppState foreground + on-mount flush (mobile, S)**: flush the queue when the app
  foregrounds and once on mount if items are pending (today only NetInfo reconnect triggers it).
- **PR-8/9 (deferred)** — sync-status UX; AsyncStorage→MMKV.

## Critical files
- `apps/mobile/lib/api.ts` · `apps/mobile/hooks/use-workout-offline.ts` · `apps/mobile/lib/offline/queue.ts`
- `apps/mobile/providers/offline-provider.tsx` · `apps/server/src/routes/logs.ts`
