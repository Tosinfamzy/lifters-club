-- Grip backfill for `barbell-shrug` — missed in 0007's grip backfill. A barbell
-- shrug is held with a pronated (overhand) bar grip. Kept in lockstep with the
-- seed (src/seed.ts). Idempotent: re-running re-sets the same row to the same value.

UPDATE "exercise_lib"."exercises" SET "grip" = 'pronated' WHERE "id" = 'barbell-shrug';
