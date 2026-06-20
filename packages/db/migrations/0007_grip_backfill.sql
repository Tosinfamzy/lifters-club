-- Backfill `exercise_lib.exercises.grip` for the grip-relevant subset.
-- Hand-written data migration kept in lockstep with the seed (src/seed.ts):
-- the id lists below MUST match the seed's grip tags exactly. Idempotent —
-- re-running only re-sets the same rows to the same value.

UPDATE "exercise_lib"."exercises" SET "grip" = 'pronated' WHERE "id" IN (
  'barbell-bench-press',
  'incline-barbell-press',
  'decline-bench-press',
  'close-grip-bench-press',
  'overhead-press',
  'push-press',
  'barbell-row',
  'pendlay-row',
  't-bar-row',
  'meadows-row',
  'smith-bent-over-row',
  'smith-incline-press',
  'pull-up',
  'lat-pulldown',
  'assisted-pull-up',
  'barbell-pullover',
  'rear-delt-barbell-raise',
  'reverse-grip-curl'
);--> statement-breakpoint

UPDATE "exercise_lib"."exercises" SET "grip" = 'supinated' WHERE "id" IN (
  'barbell-curl',
  'bicep-curl',
  'preacher-curl',
  'incline-curl',
  'cable-curl'
);--> statement-breakpoint

UPDATE "exercise_lib"."exercises" SET "grip" = 'neutral' WHERE "id" IN (
  'hammer-curl',
  'neutral-grip-pulldown',
  'cable-row',
  'dumbbell-bench-press',
  'incline-dumbbell-press',
  'dumbbell-shoulder-press',
  'dumbbell-row',
  'chest-supported-row',
  'incline-dumbbell-row',
  'seated-dumbbell-press-hammer',
  'ez-bar-curl',
  'cable-ez-bar-curl'
);
