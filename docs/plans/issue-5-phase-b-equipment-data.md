# Plan: Issue 5 Phase B — Equipment-instance data (persistence + CRUD + read-through)

> Phase A shipped the engine snap + the `equipment` field on `POST /load-progression`, but **nothing
> populates it** — the field is dead code today. Phase B closes the loop: persist per-machine data,
> auto-feed it into the load decision, and (later) let users enter it. Companion to
> [issue-5-equipment-instances.md](issue-5-equipment-instances.md) (Phase A).

## Signed-off decisions (2026-06-20)
- **Start here** — this backend slice is the Phase B opener (small, low-risk, makes the Phase A field live).
- **One instance per (user, exercise)** — unique on `(user_id, exercise_id)`, simple PUT-upsert. Add a
  **nullable `label` column now** so we can relax to named machines later without a destructive migration.
- **Defer `weight_offset` / `setup_notes`** — the engine reads neither (don't add columns until a consumer exists).
- **Request overrides stored** — if a load-progression request supplies `equipment`, use it whole; only
  fall through to the stored instance when the request omits it (matches the cycle-phase precedence).
- **Data-entry UI is mobile in-workout**, built *alongside* the Issue 4 mobile work (not a separate context switch). Web settings view deferred.

## Build steps (mirror the athlete-constraints / permanent-substitutions precedent)

1. **Schema** — `gymEquipmentInstances` in `packages/db/src/schema/training.ts` (after `permanentSubstitutions`):
   `id` (`eq_` nanoid PK) · `userId` FK→users · `exerciseId` (soft-FK to exercise_lib, no hard ref) ·
   `incrementConstraint` `real` null · `minWeight` `real` null · `confirmedWorkingWeight` `real` null ·
   `label` varchar(255) null · `createdAt`/`updatedAt`. Index on `userId`; unique on `(userId, exerciseId)`.
   (`real` matches `loggedSets.weight` / `userBaselines.baselineWeight`.)
2. **Migration** — `pnpm --filter @gymapp/db db:generate` → `0008_*.sql` + snapshot + journal. **No backfill**
   (new table, additive). Apply with `db:migrate` (never `db:push`). Prod apply runs via the
   `db-migrate` CI workflow — confirm the log actually says migrations applied (see [[deploy-pipeline-notes]]).
3. **Validation** — new `packages/validation/src/equipment.ts` (`export *` from index): `equipmentInstanceSchema`
   = `{ exerciseId: string.min(1), incrementConstraint: number.positive().optional(), minWeight:
   number.min(0).optional(), confirmedWorkingWeight: number.min(0).optional(), label: string.max(255).optional() }`.
   Replace the inline `equipment` object in `decisions.ts` with the engine-input variant of this schema (DRY).
4. **Read-through loader** — `loadEquipmentInstanceFor(userId, exerciseId)` in
   `apps/server/src/lib/athlete-profile.ts`, mirroring `loadAthleteConstraintsForUserId`; returns
   `EquipmentInstance | undefined`, coercing null columns → undefined. No ClerkId variant (one consumer).
5. **Wire into `/load-progression`** (`decisions.ts`) — when `authedUser` exists and the request did **not**
   send `equipment`, load the stored instance and inject into `resolvedInput` before
   `calculateLoadProgression`. Widen the existing single-user-lookup gate (`isSelfTuningEnabled() ||
   rawCyclePhase`) to also fire on `userId && !input.equipment`, keeping the one-lookup optimization.
6. **CRUD** (`apps/server/src/routes/users.ts`, after Permanent Substitutions): `GET /:id/equipment-instances`
   (list), `PUT /:id/equipment-instances` (upsert by user+exercise, delete-then-insert), `DELETE
   /:id/equipment-instances/:exerciseId`. Auth + ownership via `verifyUserAccess`, `{ data }` shape.
7. **Tests** — server route tests in `users.test.ts` (GET empty / PUT upsert / PUT replace / DELETE /
   ownership 403 / 401), a decisions-route test that a stored instance flows into the snap when the
   request omits `equipment` and that a request `equipment` overrides it, and validation bounds tests.

## PR breakdown
- **PR 1 — Equipment instances backend** (S–M): steps 1–7. One self-contained backend PR. *This session.*
- **PR 2 — Mobile in-workout entry** (M): a compact "this machine" control (confirmed working weight +
  optional increment) → `PUT /equipment-instances`, offline-queue aware. Built with the Issue 4 mobile work.
- **PR 3 (deferred)** — web settings management view.
