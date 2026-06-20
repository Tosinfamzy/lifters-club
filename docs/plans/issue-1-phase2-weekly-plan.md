# Plan: Issue 1 phase 2 — weekly-plan constraint enforcement

> Makes `generateWeeklyPlan` constraint-aware so the engine never *schedules* an unsafe exercise
> (the MVP only stopped it *suggesting* unsafe substitutes). Uses the merged Issue 1 (constraints)
> + Issue 3 (permanent subs).

## Core design: service resolves, engine applies
The pure engine must NOT fetch the library. So the **service** (`week-generation.ts`) loads
constraints + permanent subs + exercise metadata, and pre-resolves each planned exercise into a
`constraintDecision: { action: "allow"|"substitute"|"omit", substituteExerciseId?, isPermanent?,
reason? }` on `ExercisePerformance`. The **engine** just applies it with correct precedence.

## Scoping decisions (this chunk)
- **Defer weight-carry** read-through (isolatable follow-up; `weightCarries` column already unused).
- **No new `DecisionType`** — surface constraint substitutions/omissions in the plan `changes[]` +
  structured logs (Sentry Logs), not formal decision rows. Constraint enforcement is a safety
  guarantee, not a coaching judgment to evaluate; avoids the DecisionType + web UI ripple.
- **Bonus fix:** populate `availableSubstitutes` (constraint-filtered) — rotation has been dead
  since it was hardcoded `[]`.

## Engine (`packages/engine/src/planning.ts`, additive only)
- `ExercisePerformance`: add optional `equipment?`, `movementPatterns?`, `constraintDecision?`.
- `PlannedExerciseUpdate`: add `omitted?`, `omissionReason?`, `substitutionSource?: "rotation"|"constraint"`.
  Reuse `newExerciseId` for the substitute target.
- Per-exercise loop precedence: **omit > constraint-substitute > rotation-swap**; deload scaling
  applies on top of whatever survives. Omit → push update with `omitted:true`+reason, `continue`
  (no load/volume changes), add `changes` entry. Substitute → set `newExerciseId`,
  `substitutionSource:"constraint"`, skip rotation swap (guard the existing rotation block), add
  `changes` entry. Allow/undefined → existing behavior.
- Summary counts: add omitted count.

## Service (`apps/server/src/services/week-generation.ts`)
- **Extract shared loaders** to a new `apps/server/src/lib/athlete-profile.ts`:
  `loadAthleteConstraintsForUserId` / `...ForClerkId`, `loadPermanentSubstitutionsForUserId` /
  `...ForClerkId`, and `mapToExercise` (currently inline in `routes/exercises.ts`). Refactor the
  exercises route to import from there (DRY — 3 call sites). NB `generateNextWeek` has the internal
  `userId`, not clerkId — use the userId variants.
- In `gatherExercisePerformance`: load constraints + permanent subs once. **If none → skip all
  constraint work (byte-identical to today, no library query).** Else batch-fetch exercise metadata
  (`inArray`) for planned exercises + a pre-filtered candidate pool (mirror `exercises.ts:347`
  containment query + permanent-sub candidate-presence top-up).
- **Resolve per exercise:** attach `equipment`/`movementPatterns`; call `isExerciseAllowed`. Allowed
  → `action:"allow"` + populate constraint-filtered `availableSubstitutes` (via
  `getTopSubstitutes` with constraints+permanentSubs) so rotation only rotates into safe exercises.
  Not allowed → `getTopSubstitutes({...})` (engine already does permanent-sub-first + constraint
  safety-valve): `result[0]` → `action:"substitute"`; empty → `action:"omit"` with the
  `isExerciseAllowed` reason.
- **Consume:** drop `omitted` updates from the built workout's `plannedExercises`
  (filter in the `adjustedExercises`/`updateMap` step); omitted → no workout (`workoutId` nullable).
  Log each substitution/omission (`logger.info`, structured) with reason.

## MVP vs defer
MVP: engine constraintDecision apply + service resolution + drop-omitted + dead-rotation fix +
logging. Defer: weight-carry read-through; formal decision persistence; grip (`no_wrist_extension`
still needs the grip attribute).

## Tests
- Engine `planning.test.ts`: substitute (newExerciseId set, source=constraint, rotation skipped);
  omit (omitted+reason, excluded from schedule, no load changes); precedence (constraint beats
  rotation; deload still scales the survivor); backward-compat (no constraintDecision → unchanged).
- Service integration `week-generation.test.ts` (seed exercises/users/constraints/perm-subs/program/
  block/logged_sets): constrained exercise + valid candidate → substitute in `plannedExercises`;
  no candidate → omitted (session shorter by exactly one); permanent-sub-blocked → falls through;
  unconstrained user → byte-identical output.
- Shared loader unit tests.

## Risks
- Loader clerkId vs userId mismatch (use userId variants).
- Candidate pool completeness (pre-filtered 200; permanent-sub top-up required).
- Omit must run even on deload weeks (safety unconditional).
- Unconstrained-user fast path must avoid the library query (perf + exact-parity).

## Effort: **M**. Files: `packages/engine/src/planning.ts`,
`apps/server/src/services/week-generation.ts`, new `apps/server/src/lib/athlete-profile.ts`,
`apps/server/src/routes/exercises.ts` (refactor to shared lib).
