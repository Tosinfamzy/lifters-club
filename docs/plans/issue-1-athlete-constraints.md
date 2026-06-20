# Plan: Issue 1 — Athlete Constraint Profile (first-class engine input)

> From [engine-coaching-gaps.md](engine-coaching-gaps.md) Issue 1 (real 5-week athlete feedback).
> Goal: make injury/grip/movement restrictions a **persisted, first-class input** so the engine
> never *recommends* an unsafe movement. Today a human applies the filter on top.

## Key finding (corrects the "half-scaffolded" assumption)
The existing `Constraint` type (`packages/types/src/exercise.ts:52`) is **equipment-availability**
(`rack | bench | cables | pull_up_bar | dip_station`) — "what apparatus does this exercise
*need*", answering "does the gym have a rack?". `findSubstitutes` excludes candidates whose
`constraints` the user lacks. The athlete's restrictions (`no_barbell`, `neutral_grip_only`,
`no_wrist_extension`) are a **different axis** (athlete *capability*) that map onto **multiple**
exercise fields (`equipment`, `movementPatterns`, `id`), not the single `constraints` field. Seed
data confirms `constraints` is loose/untyped at rest (`requires_mobility`, `squat_rack`).
**→ Introduce a NEW `AthleteConstraints` vocabulary; do NOT overload `Constraint`.** Reuse the
existing *filtering primitives* (`availableEquipment`, `excludeExerciseIds`) via a resolver.

## 1. Types (`@gymapp/types`, new — keep `Constraint` untouched)
`AthleteConstraints { equipmentRestrictions?, gripRestrictions?, movementRestrictions?,
injuryFlags?, bannedExerciseIds?, correctivePriorityExerciseIds? }` with enums:
- `EquipmentRestriction`: `no_barbell | no_machine | no_cable | …`
- `MovementRestriction`: `no_wrist_extension | no_overhead | no_spinal_loading | no_deep_knee_flexion | …`
- `GripRestriction`: `no_pronated | no_supinated | neutral_grip_only | …`
- `InjuryRegion`: `wrist | elbow | shoulder | knee | lower_back | …` (reasoning/audit only)

## 2. The mapping (the crux) — new pure resolver `packages/engine/src/constraints.ts`
`isExerciseAllowed(exercise, constraints, config?) → { allowed, reason? }`, blocking maps held in
a tunable `ConstraintResolverConfig` (OCP):

| Restriction | Exercise field | Rule |
|---|---|---|
| `no_barbell` / `no_machine` / `no_cable` | `equipment` | exclude if equipment includes that class |
| `no_overhead` | `movementPatterns` | exclude `push_vertical` |
| `no_spinal_loading` / `no_lumbar_flexion` | `movementPatterns` | exclude `squat`/`hinge` (coarse — conservative-safe, config-tunable) |
| `no_deep_knee_flexion` | `movementPatterns` | exclude `squat`/`lunge` |
| `bannedExerciseIds` | `id` | hard exclude |
| `neutral_grip_only` / `no_pronated` | `id`/`aliases` heuristic | **v1 lossy** — no `grip` field on `Exercise` (see risks) |
| `correctivePriorityExerciseIds` | `id` | does NOT filter — drives volume protection (§4) |
| `injuryFlags` | — | carried into reason strings; reserved for future region→pattern rules |

## 3. Persistence
- **New table** `athlete_constraints` (one row/user; mirrors `userBaselines`/`readinessChecks`),
  jsonb string[] columns + `userId` FK + index. Additive migration via
  `pnpm --filter @gymapp/db db:generate` → `migrations/0004_*.sql`.
- **Zod** `athleteConstraintsSchema` in `packages/validation`.
- **CRUD** `GET/PUT /api/users/:id/constraints` in `apps/server/src/routes/users.ts`, mirroring
  `/:id/baselines` (ownership via `verifyUserAccess`, upsert-by-userId).
- **Threading:** route/service fetches the profile and passes the plain object into engine calls.
  Engine stays pure (no DB). Public `GET /exercises/:id/substitutes` applies the profile only when
  an authed userId is present (optional).

## 4. Engine changes (all additive/optional — no breaking changes)
- `findSubstitutes` (`substitution.ts`): add `athleteConstraints?` to `SubstitutionInput`; in the
  candidate loop, `continue` if `!isExerciseAllowed(...)`. Coexists with the existing apparatus
  `constraints` filter.
- `calculateVolumeAdjustment` (`volume.ts`): add `isCorrectivePriority?: boolean` to `VolumeInput`;
  in the `reduce_set` branch, force `maintain` when true (route sets the flag from
  `correctivePriorityExerciseIds`). Keeps volume ignorant of the constraint vocabulary (SRP).
- `generateWeeklyPlan` (`planning.ts`, phase 2): validate each planned exercise; if disallowed,
  substitute from `availableSubstitutes` filtered through `isExerciseAllowed`; if none qualifies,
  set `omitted: true` + `omissionReason` (don't silently drop). Needs `ExercisePerformance`
  enriched with `equipment`/`movementPatterns` (populated by the calling service).
- Export resolver + types from `packages/engine/src/index.ts`.

## 5. MVP vs full (recommended phased cut)
**MVP (safety-critical, zero heuristic ambiguity):**
1. Types + Zod + `athlete_constraints` table + `GET/PUT /constraints`.
2. `isExerciseAllowed` for **equipment + movement + bannedExerciseIds only** (skip grip).
3. Wire into `findSubstitutes` (auto-filter) + `calculateVolumeAdjustment` (corrective protection).
→ Delivers the core guarantee (engine won't *suggest* an unsafe substitute) + corrective volume
protection. **Effort: M.**

**Full (phase 2):** planning validate/substitute/omit; grip restrictions (+ likely a first-class
`grip` attribute on `Exercise` — a library schema + reseed decision); injury-region rules. **→ L.**

## 6. Tests
- Engine: new `constraints.test.ts` (per restriction class; empty profile allows all), new
  `substitution.test.ts` (disallowed candidates dropped; empty profile = unchanged ranking),
  extend `volume.test.ts` (corrective → maintain) and `planning.test.ts` (substitute/omit).
- Route: `PUT/GET /constraints` round-trip + ownership (403) + invalid enum (400); substitutes/
  weekly-plan endpoints honor a saved profile.

## 7. Risks / decisions to sign off
1. **New vocabulary vs reuse** — recommend NEW (`Constraint` is apparatus, not capability).
2. **Grip is the biggest ambiguity** — no `grip` field on `Exercise`; v1 can only approximate via
   id/alias tokens. **Recommend: ship MVP without grip**, then decide heuristic vs a real `grip`
   attribute (bigger data change).
3. **Omit-vs-substitute in planning** — substitute first; if none, flag `omitted` + reason (don't
   silently shorten the session).
4. **Depends on Issue 3** for *stable* planning substitution (else swaps re-derive weekly). Order:
   **Issue 1 MVP → Issue 3 → Issue 1 planning (full).**
5. **Coarse movement blocks** (`no_spinal_loading` → squat+hinge) — keep in tunable config,
   default conservative-safe (over-exclude rather than risk an unsafe rec).
6. **Public substitutes route** — profile application optional there.

## Critical files
`packages/types/src/exercise.ts` · `packages/engine/src/constraints.ts` *(new)* ·
`packages/engine/src/substitution.ts` · `packages/engine/src/volume.ts` · `planning.ts` ·
`packages/db/src/schema/training.ts` · `packages/validation/src/` ·
`apps/server/src/routes/users.ts`
