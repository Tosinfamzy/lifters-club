# Plan: Grip handling (Issue 1 phase 2) — closes the wrist/neutral-grip case

> Deferred phase-2 piece. Closes Milica's `no_wrist_extension` (ganglion cyst) / neutral-grip case
> that the MVP left inert. Builds on the merged constraints system.

## Decisions (recommended, baked in)
1. **Single optional `grip` scalar** on `Exercise`: `Grip = "pronated"|"supinated"|"neutral"|"mixed"|"none"`.
   **null/undefined and `none` are NEVER blocked** (the safe default — an untagged exercise is never
   wrongly excluded). Grip is part of exercise identity (close-grip-bench is its own row), so one
   value per exercise, not an array.
2. **`GripRestriction` axis** on `AthleteConstraints`: `neutral_grip_only | no_pronated | no_supinated`.
3. **Re-map `no_wrist_extension`** (currently inert `MobilityConstraint`) to a grip block — wrist
   extension is loaded by pronated/mixed straight-bar work. Via a new `mobilityGripMap` in the
   resolver config (keeps `mobilityMap` = movement-pattern filtering).
4. **Tag only the grip-relevant subset** (~30-40 upper-body pull/press/curl rows); leave the rest
   null. **Pronated completeness is the safety priority** (untagged pronated = not blocked).
5. **Prod backfill = hand-written data migration** (`UPDATE … WHERE id IN (…)` grouped by grip),
   shipped in the SAME PR as the column migration so there's no inert window. Same id→grip mapping
   as the seed (keep in lockstep).

## Changes
- **`packages/types/src/exercise.ts`**: `Grip` union + `grip?: Grip` on `Exercise`.
- **`packages/types/src/constraints.ts`**: `GripRestriction` + `grip?: GripRestriction[]` on `AthleteConstraints` (optional).
- **`packages/validation/src/constraints.ts`**: `gripRestrictionSchema` + `grip: z.array(...).default([])`.
- **`packages/db/src/schema/exercise-lib.ts`**: `grip: varchar("grip",{length:16})` (nullable).
- **`packages/db/src/schema/training.ts`**: `grip: jsonb().$type<string[]>().notNull().default([])` on `athlete_constraints`.
- **Migrations**: `db:generate` → DDL migration (both columns); **hand-write** a backfill migration
  (`UPDATE exercise_lib.exercises SET grip=… WHERE id IN (…)` for the tagged subset). Both run via
  `db-migrate.yml`. Sequence in one PR.
- **`packages/engine/src/constraints.ts`**: add `gripMap` + `mobilityGripMap` to
  `ConstraintResolverConfig`/defaults; new filtering steps 4 (grip axis) + 5 (mobility→grip) after
  the mobility loop, guarded by `grip && grip !== "none"`; remove the "deferred to phase 2"
  comment; update the resolution-order JSDoc. Default `gripMap`: `neutral_grip_only →
  [pronated,supinated,mixed]`, `no_pronated → [pronated,mixed]`, `no_supinated → [supinated,mixed]`
  (mixed over-excluded, conservative). `mobilityGripMap`: `no_wrist_extension → [pronated,mixed]`.
- **CRUD wiring (no spread — explicit field lists)**: add `grip` to `EMPTY_CONSTRAINT_PROFILE`, the
  `PUT /constraints` insert `.values`, and `loadAthleteConstraintsForUserId`'s return map
  (`apps/server/src/routes/users.ts`, `apps/server/src/lib/athlete-profile.ts`). **CRITICAL:**
  `mapToExercise` must map `grip: row.grip` or grip filtering silently no-ops (resolver reads
  `exercise.grip`).
- **`packages/db/src/seed.ts`**: tag the grip-relevant subset. Pronated (audit carefully):
  barbell rows (barbell-row, pendlay/t-bar/meadows/smith-bent-over-row), pull-up/lat-pulldown/
  assisted-pull-up, barbell-bench/incline-barbell/overhead-press/push-press/close-grip-bench,
  barbell-pullover, rear-delt-barbell-raise. Supinated: barbell-curl/bicep-curl/preacher/incline/
  cable-curl. Neutral: hammer-curl, neutral-grip-pulldown, cable-row, dumbbell presses/rows
  (tag neutral so the athlete keeps them), ez-bar-curl (cambered → neutral). Leave lower-body/
  machine/core null.

## Tests
- Engine `constraints.test.ts`: neutral_grip_only blocks pronated+supinated, allows neutral/none/
  null; no_pronated blocks pronated+mixed; no_supinated blocks supinated+mixed; untagged allowed
  under all; **no_wrist_extension now blocks pronated** (the closed case); banned still wins over
  grip; custom config; empty profile still passes.
- Seed sanity test (`@gymapp/db`): every non-null grip ∈ Grip union; spot-assert barbell-row=
  pronated, barbell-curl=supinated, hammer-curl=neutral, pull-up=pronated, leg-press=null.
- Zod: accepts grip; defaults []; rejects bad enum. Route: PUT/GET round-trip grip.

## MVP vs full
MVP closes the ganglion case: all of the above with the **pronated set + neutral alternatives**
tagged. Full: supinated/mixed completeness, exercises admin CRUD accepts grip, web UI for the grip axis.

## Risks
- **Classification accuracy (safety):** untagged pronated = not blocked → audit the pronated list
  for completeness; prefer tagging an ambiguous bar movement pronated over leaving it null.
- **Ambiguous grips** (ez-bar, dumbbells, face-pull): tag the safe/most-loaded value, comment the call.
- **`no_wrist_extension` behavior change** on existing profiles (was inert) — intended, note it.
- **Seed/backfill drift** — keep id lists identical; the seed sanity test guards the seed half.

## Effort: **M** (seed classification + tests is the bulk).
