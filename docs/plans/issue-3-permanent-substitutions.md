# Plan: Issue 3 — Persist permanent substitutions

> From [engine-coaching-gaps.md](engine-coaching-gaps.md) Issue 3. Real incident: a permanent
> BSS-for-leg-press swap kept getting un-applied because `findSubstitutes` re-derived every time.
> Mirrors the Issue 1 MVP patterns (constraints type/table/CRUD/engine threading) — freshest template.

## Decisions (recommended, baked in)
1. **Override, single result** — if a permanent sub matches the queried exercise, `findSubstitutes`
   returns exactly that one (not top-ranked-with-flag). Kills the "un-apply" error class.
2. **Weight-carry = read-through** (not baseline-row copy): when `weightCarries`, the *caller*
   feeds the **original** exercise's history into the substitute's `ProgressionInput`. Single
   source of truth, trivially reversible. Engine unchanged (it takes data, doesn't fetch).
   Precedence: the substitute's own recent sets win once it has them; the original's history only
   fills the cold-start gap (first session post-swap).
3. **`reason` = small enum + optional `note`** (`anatomy|injury|fit_preference|mobility|other`) —
   mirrors `InjuryFlag`, enables clean engine reason strings.
4. **Constraint block wins** over a stale permanent sub: if the substitute isn't an allowed
   candidate (banned by `athleteConstraints` / filtered out), fall through to the algorithm.
5. **One sub per (userId, originalExerciseId)** — unique index; upsert by that key.

## Type — `@gymapp/types/src/substitution.ts` (new)
`PermanentSubstitution { originalExerciseId, substituteExerciseId, reason: SubstitutionReason,
note?, confirmedAt: string (ISO), weightCarries: boolean }`. Re-export from index.

## Persistence
- **Table** `permanent_substitutions` in `schema/training.ts` (multi-row/user; cols: id, userId FK,
  original_exercise_id, substitute_exercise_id, reason varchar, note text, weight_carries bool
  default true, confirmed_at, created/updated). `index(user_id)` + `uniqueIndex(user_id,
  original_exercise_id)` (add `uniqueIndex` to the drizzle import). Exercise ids are varchar, NOT
  cross-schema FKs (mirrors `userBaselines.exerciseId`). Additive migration `0005_*` via `db:generate`.
- **Validation** `permanentSubstitutionSchema` (Zod) + `.refine` rejecting self-map
  (`original === substitute`). Re-export from index.
- **CRUD** in `apps/server/src/routes/users.ts` (mirror the constraints block):
  - `GET /:id/substitutions` → list (`[]` when none).
  - `PUT /:id/substitutions` → upsert-one (delete where userId+originalExerciseId, insert). `confirmedAt`
    defaults to now server-side if omitted. id `ps_${nanoid(12)}`.
  - `DELETE /:id/substitutions/:originalExerciseId` → remove one (the explicit, controlled "un-swap").
  - ownership via `verifyUserAccess`.

## Engine — `findSubstitutes` short-circuit (pure, additive)
- Add `permanentSubstitutions?: PermanentSubstitution[]` to `SubstitutionInput` (pass the **list**,
  not a pre-resolved one — so `generateWeeklyPlan` can reuse it per-exercise in Issue 1 phase 2).
- Add `isPermanent?: boolean` to `ScoredSubstitute`.
- At the top of `findSubstitutes`: find the sub whose `originalExerciseId === input.exercise.id`. If
  found AND its `substituteExerciseId` is in `candidateExercises`, return a **single** result
  `{ exercise, score: 1, matchReasons: ["Permanent substitution (<reason>)"], isPermanent: true }`.
  If the substitute isn't an allowed candidate → fall through to the algorithm (safety valve).
- Absent the list → byte-identical to today (additive).

## Substitutes route — `apps/server/src/routes/exercises.ts`
- Sibling `loadPermanentSubstitutionsForClerkId(clerkId)` (anonymous → undefined), like the
  constraints loader (route is `optionalAuthMiddleware`).
- **Candidate-presence guarantee (the #1 bug risk):** the route pre-filters candidates by
  movement/muscle overlap (limit 200). A permanent substitute may not overlap. So after the
  pre-filter, if a matching permanent sub exists and its `substituteExerciseId` isn't in the set,
  fetch that one exercise by id and append it before calling `getTopSubstitutes`.
- Surface `isPermanent` in the JSON so the UI can label "Your permanent swap."

## Weight-carry read-through (route/service)
Where `ProgressionInput` is assembled for an exercise: if a `weightCarries` permanent sub exists,
fetch `recentSets`/baseline using the **original** exercise id but set `exerciseId` to the
substitute. **Include in MVP only if there's a single progression-assembly chokepoint**
(`/load-progression` route); if assembly is scattered, defer to phase 2. (Verify during build.)

## MVP vs phase 2
**MVP:** type + table + CRUD + engine short-circuit + substitutes threading (kills the error class).
**Phase 2 / fold-in-if-cheap:** weight-carry read-through; planning consumes the same list (Issue 1 phase 2).

## Tests
- Engine (extend `substitution.test.ts`): permanent match → single result/`isPermanent`/reason;
  non-match falls through; substitute-not-in-candidates falls through; constraint-blocked substitute
  not resurrected; absent list = unchanged (regression).
- Validation: valid; self-map rejected; bad reason rejected; `weightCarries` defaults true.
- Route (`users.test.ts`): GET `[]`; PUT round-trip; PUT-twice-same-original upserts (1 row);
  two originals coexist; DELETE one; 403 non-owner. (`exercises.test.ts` if seedable: stored sub
  returned even when it wouldn't rank.)

## Risks
- Candidate pre-filter dropping the substitute → the fetch-and-append guarantee (highest-likelihood bug).
- Dangling `substituteExerciseId` if an exercise is later removed (no cross-schema FK) — acceptable,
  mirrors baselines.
- Weight-carry double-count → precedence rule (substitute's own recent sets win).

## Effort: **M**. Files: `types/src/substitution.ts`, `validation/src/substitution.ts`,
`db/src/schema/training.ts` (+migration 0005), `engine/src/substitution.ts`,
`apps/server/src/routes/users.ts`, `apps/server/src/routes/exercises.ts`.
