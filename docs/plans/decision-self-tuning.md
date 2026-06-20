# Plan: Decision self-tuning (wire `getProgressionModifier`)

> Backlog item [ROADMAP.md](../ROADMAP.md) §2a. Effort: **M**. No DB migration.

## Problem
`getProgressionModifier(accuracyStats, decisionType)` in `packages/engine/src/feedback.ts:161`
returns `0.8` (be conservative) / `1.0` (no-op) / `1.1` (be aggressive), and already
returns `1.0` when `byType[type].total < 5` (cold-start safe). It is **never imported
in `apps/server`**. The `/load-progression` and `/volume` routes call the engine with
no config, so decisions never tune to the user's history.

The catch: the modifier is a **scalar**, but `calculateLoadProgression(input, config)`
expects a `ProgressionConfig`. The scalar→config translation does not exist yet.

## Approach (keeps the engine pure)
1. **New pure engine helpers** (translation is pure math → belongs in the engine):
   - `applyProgressionModifier(modifier, config?): ProgressionConfig` in `progression.ts` —
     scales `smallIncrement`/`largeIncrement` by the modifier and nudges
     `rpeThresholdForIncrease`, **clamped** to a sane range (e.g. [6, 9]). `modifier === 1.0`
     returns the config unchanged (exact no-op — preserves cold-start behavior byte-for-byte).
   - `applyVolumeModifier(modifier, config?): VolumeConfig` in `volume.ts` — volume has no
     increment (±1 sets), so the lever is `rpeThresholdForAdd`/`rpeThresholdForReduce`
     (conservative → make "add set" harder). Keep modest + clamped.
   - Export both from `packages/engine/src/index.ts`.

2. **Extract accuracy stats into a reusable service.** The `/accuracy` handler
   (`apps/server/src/routes/decisions.ts:266-351`) already builds a `DecisionAccuracyStats`
   inline — exactly what `getProgressionModifier` needs. Extract to
   `apps/server/src/services/decision-accuracy.ts`:
   `getDecisionAccuracyStats(userId): Promise<DecisionAccuracyStats>` (the `decisionOutcomes ⨝
   decisions` query). Refactor `/accuracy` to call it (pure refactor, no behavior change). The
   service does the DB read; the engine never touches the DB.

3. **Wire into `/load-progression`** (`decisions.ts:472`): when a `userId` is present,
   `stats = getDecisionAccuracyStats(userId)` → `modifier = getProgressionModifier(stats,
   "load_progression")` → `tuned = applyProgressionModifier(modifier)` →
   `calculateLoadProgression(input, tuned)`. **Anonymous/preview calls (no userId) skip the
   stats fetch entirely** → no extra query, identical behavior.

4. **Wire into `/volume`** (`decisions.ts:517`) — recommended for symmetry (volume also has
   automatic outcome eval, so its loop is genuinely closed). Optional if trimming scope.

5. **Bump `ENGINE_VERSION`** `1.0.0 → 1.1.0` in `index.ts` — tuned configs change output for
   established users, so persisted decisions should be attributable to the self-tuning era.
   No migration (column exists with default; only new rows get the new version).

6. *(Optional)* surface the applied modifier in the persisted `input`/`reasoning` for
   auditability via `/history`.

## Data flow
```
POST /load-progression (userId)
  → getDecisionAccuracyStats(userId)            [service: DB read]
  → getProgressionModifier(stats, type)         [engine: pure → 0.8|1.0|1.1]
  → applyProgressionModifier(modifier)          [engine: pure → tuned config]
  → calculateLoadProgression(input, config)     [engine: pure]
  → persistDecision(..., ENGINE_VERSION=1.1.0)
```

## Tests
- New `feedback.test.ts`: `getProgressionModifier` thresholds (cold-start `1.0`, low success
  `0.8`, high success `1.1`); `applyProgressionModifier(1.0)` deep-equals default (locks the
  no-op); `0.8`/`1.1` shrink/grow increments within clamp bounds.
- Extend `progression.test.ts`: same input → smaller `newWeight` step under `0.8`, larger
  under `1.1`.
- New `apps/server/src/routes/decisions.test.ts` (harness from `logs.test.ts`): cold-start
  no-op end-to-end; ≥5 low-success outcomes → conservative; ≥5 high-success → aggressive;
  anonymous → default; persisted row has `algorithmVersion = "1.1.0"`; `/accuracy` shape
  unchanged after the service extraction.

## Risks / decisions to flag
1. **Extra indexed query per authenticated decision** on a hot path (small per-user). If a
   future endpoint generates load+volume together (weekly-plan), fetch stats once and reuse.
2. **Multiplier→config semantics are a product/algorithm decision** (which fields, clamp
   ranges) — needs sign-off; document in JSDoc.
3. **Weekly-plan path not covered**: `generateWeeklyPlan` also persists load/volume decisions
   but won't use the modifier. Threading a config through the planning function is a larger
   follow-up — track separately.
4. **Feedback latency**: `successRate` only populates after `evaluatePendingDecisions` runs on
   completion, and only for the two types `evaluateDecision` handles today (see §2b plan).

## Mitigations & safety nets

Per-risk:
1. **Hot-path query** — anonymous calls skip it entirely; the stats fetch is a reusable
   `getDecisionAccuracyStats(userId)` service so multi-decision callers fetch once; log the
   query timing and add a short-TTL per-user cache **only if** profiling shows it hot
   (don't pre-optimize).
2. **Tuning semantics** — kept **gentle** (±20% max), **fully clamped**, and **exact no-op at
   1.0**, so worst case is bounded and cold-start behavior is byte-identical to today. Mapping
   + clamps live in named constants with JSDoc so the numbers are reviewable/tweakable without
   a rewrite (see table below).
3. **Weekly-plan gap** — explicitly out of v1 scope; tracked as a ROADMAP follow-up and noted
   in the PR. It's a coverage gap, not a correctness bug.
4. **Feedback latency** — inherent (can't tune on absent data); the ≥5-outcome gate avoids
   tuning on noise. §2b broadens the signal to the other decision types.

Cross-cutting safety nets (added to scope):
- **Kill switch** — `SELF_TUNING_ENABLED` env flag (default on) to disable tuning instantly in
  prod, no revert-and-redeploy.
- **Audit trail** — persist the applied modifier into the decision's stored `input` so every
  tuned decision is inspectable via `/history`.
- **Observability** — log each tuning event (`userId`, `type`, `modifier`, config delta) so it
  surfaces in Sentry Logs; self-tuning is visible, not a black box.

### Tuning constants — proposed defaults (set/adjust before build)
Modifier thresholds mirror the existing `getProgressionModifier` (`feedback.ts:161`):

| Modifier | Trigger (per decision type) | Effect on `ProgressionConfig` |
|----------|-----------------------------|-------------------------------|
| `1.0` (no-op) | `total < 5` **or** `0.6 ≤ successRate ≤ 0.85` | config unchanged (exact) |
| `0.8` (conservative) | `successRate < 0.6` | increments ×0.8; `rpeThresholdForIncrease` −0.5 |
| `1.1` (aggressive) | `successRate > 0.85` | increments ×1.1; `rpeThresholdForIncrease` +0.5 |

**Clamps (guardrails):** increment ∈ `[1.0 kg, 2× default]`; `rpeThresholdForIncrease` ∈ `[6, 9]`.
Volume path mirrors this on `rpeThresholdForAdd`/`rpeThresholdForReduce` (no increment field).

> These deltas (−0.5 RPE, ×0.8/×1.1) and the clamp ranges are the **product/algorithm
> decision to sign off** — they're proposals, easy to change since they're isolated constants.

## Critical files
- `apps/server/src/routes/decisions.ts`
- `packages/engine/src/feedback.ts`, `progression.ts`, `volume.ts`, `index.ts`
- `apps/server/src/services/decision-accuracy.ts` *(new)*
- `apps/server/src/routes/decisions.test.ts` *(new)*
