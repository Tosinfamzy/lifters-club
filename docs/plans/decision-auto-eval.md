# Plan: Auto-evaluate all decision types

> Backlog item [ROADMAP.md](../ROADMAP.md) §2b. Effort: **M/L**. No DB migration.

## Problem
On workout completion (`POST /api/logs/:id/complete`), `evaluatePendingDecisions`
(`apps/server/src/services/decision-eval.ts`) calls the engine's
`evaluateDecision(decision, subsequentSets): EvaluationResult | null`
(`packages/engine/src/feedback.ts:136`) — a `switch` on `decision.type` that only handles
`load_progression` and `volume_adjustment`; everything else hits `default → null`.

**Core constraint:** the service is structurally *exercise-centric* — it hard-requires
`decision.input.exerciseId` (`decision-eval.ts:76-82`), filters the completed log's sets to
that exercise, and averages weights/reps for `actualValue`. `deload_recommendation` and
`session_recovery` are **not** exercise-scoped, so they are always skipped today even if the
engine had a branch.

## Architectural decision: additive evaluation context (Option A)
Add an optional 3rd param: `evaluateDecision(decision, subsequentSets, context?:
EvaluationContext)`. Existing branches ignore it (preserves Liskov/OCP, no breaking change).
New branches read non-exercise facts from it. The **service** computes the aggregates and
passes them in — the engine stays pure (no `Date.now()`, no DB).

```ts
interface EvaluationContext {
  completedSetCount: number;
  sessionOverallRpe?: number;
  recentOverallRpe?: number[];          // recent prior logs, for deload baseline
  readiness?: { score: number; recommendation: string };
}
```

## Per-type success definitions & feasibility
| Type | Effort | "Success" = | Data needed |
|------|--------|-------------|-------------|
| `exercise_rotation` | **M** | swap→adopted & trained productively (sets for `output.newExerciseId`, RPE<10); keep→trained without grinding | exercise-scoped sets (fits model; service picks `newExerciseId` for swaps) |
| `deload_recommendation` | **M** | recommended→`overallRpe` dropped vs recent baseline; not-recommended→completed sustainably (RPE<~9) | this log `overallRpe` + recent prior `overallRpe` window — **needs service change** |
| `session_recovery` | **M/L** | rest/light rec→user actually went light (low sets/RPE); full→completed at non-maximal RPE; reduced→volume/intensity at/below recommended | this log set count + `overallRpe` + linked `readinessChecks` — **needs service change** |
| `missed_session` | **L** | **weak signal** — narrow MVP: user returned to training at non-maximal RPE. Does NOT verify the specific action (resume/repeat/regress). | recommend MVP-or-defer; document limitation |

`weekly_plan_update` stays unhandled (not completion-evaluable).

## Exact changes
### `packages/engine/src/feedback.ts`
- Add `EvaluationContext` interface near `EvaluationResult`.
- Add four pure evaluators (mirror existing style, data-backed `reason` strings, thresholds in
  a small config with defaults per OCP):
  `evaluateExerciseRotation(decision, sets)`, `evaluateDeloadRecommendation(decision, context)`,
  `evaluateSessionRecovery(decision, context)`, `evaluateMissedSession(decision, context)`.
- Extend the `evaluateDecision` switch (line 140) with the four cases + optional `context` param.

### `packages/engine/src/index.ts`
- Export the four evaluators + `EvaluationContext`.

### `apps/server/src/services/decision-eval.ts` (the real work + main bug surface)
1. **Branch by `decision.type`** instead of hard-requiring `exerciseId`:
   - exercise-scoped (`load_progression`, `volume_adjustment`, `exercise_rotation`): keep the
     exercise filter; for rotation use `output.newExerciseId` when `action === "swap"`.
   - non-exercise-scoped (`deload`, `recovery`, `missed_session`): build an `EvaluationContext`.
2. **Gather context data**: `sessionOverallRpe` (from `workoutLogs.overallRpe`, fallback avg of
   set RPE), `completedSetCount`; query recent prior `workoutLogs.overallRpe` for the deload
   baseline; select the `readinessChecks` row by `workoutLogId` for recovery.
3. **Type-aware `actualValue`** (lines 110-128): current hardcoded `{ setsCompleted, avgWeight,
   avgReps }` **divides by zero** when there are no exercise-matched sets — for non-exercise
   types write `{ sessionOverallRpe, completedSetCount, readinessScore?, evaluationReason }`.
4. Keep the `success IS NULL` idempotency filter (prevents re-scoring) and `evaluatedAt` logic.

### No schema changes
`decisionOutcomes.actualValue` is `jsonb`; `success` nullable. Everything fits existing columns.

## Tests
- New `packages/engine/src/__tests__/feedback.test.ts` (none today): per-type success/fail
  cases (rotation adopted vs not; deload RPE-dropped vs not; recovery heeded vs ignored;
  missed-session returned); dispatcher returns `null` for `weekly_plan_update`; load/volume
  unchanged when `context` omitted.
- New `apps/server/src/services/__tests__/decision-eval.test.ts`: seed a decision+outcome of
  each new type + completed log (+ readiness row for recovery), run `evaluatePendingDecisions`,
  assert `success`/`evaluatedAt`/type-appropriate `actualValue`. Explicitly assert the
  **previously-skipped** deload/recovery are now evaluated and **no divide-by-zero**.

## Risks / decisions to flag
1. **Non-exercise data gathering is the crux** — the service is exercise-centric today; adding
   session/readiness context + type-aware `actualValue` is the main effort and bug surface
   (divide-by-zero).
2. **`missed_session` is weak at completion time** — MVP validates "returned to training," not
   the recommended action. Consider deferring to manual scoring; document clearly.
3. **Counterfactual problem** (rotation/recovery/deload): we measure adherence + realized
   outcome, never "the path not taken." Reason strings must say so, so `getProgressionModifier`
   / `DecisionAccuracyStats` aren't misread as proof of optimality.
4. **Keep the engine pure** — all timestamps/RPE windows/readiness joins computed in the
   service, passed via `context`.

## Critical files
- `packages/engine/src/feedback.ts`, `index.ts`
- `apps/server/src/services/decision-eval.ts`
- `packages/types/src/training.ts` (decision output shapes)
- `apps/server/src/routes/logs.ts` (completion trigger)

## Sequencing note
This is a **prerequisite for §2a (self-tuning) to be fully effective** — self-tuning's
`successRate` only has signal for decision types that get auto-evaluated. Doing §2b first (or
together) widens the feedback loop self-tuning depends on.
