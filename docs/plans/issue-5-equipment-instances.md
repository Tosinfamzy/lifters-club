# Plan: Issue 5 — Equipment-instance data (increment-snap slice)

> Source gap: [engine-coaching-gaps.md](engine-coaching-gaps.md) Issue 5. The taxonomy treats all
> machines of a type as equivalent, but real machines have fixed increments and different working
> weights, so a target can be physically unachievable (16 kg on a cable that only does 15 kg).
> The doc's own take: "the `incrementConstraint` snap is the cheapest, highest-value slice; the
> rest can wait." This plan builds exactly that slice plus the `confirmedWorkingWeight` baseline.

**Scope:** Phase A = engine snap + baseline preference (this plan) threaded through the
`/load-progression` route. Phase B = per-user equipment data entry/CRUD UI (the friction part).

## Signed-off decisions (2026-06-20)

- **Snap direction = DOWN.** When a target falls between achievable weights, round to the nearest
  achievable weight **at or below** target. Never prescribe a weight the machine can't make.
  Config-overridable to `"nearest"` later if needed.
- **`confirmedWorkingWeight` is the preferred baseline** when no recent sets exist (real machine
  truth beats a derived estimate).
- **MVP type is minimal** — `incrementConstraint`, `minWeight`, `confirmedWorkingWeight` only.
  `weightOffset` / `setupNotes` deferred to avoid half-built fields (the doc explicitly parks them).

## Engine API

New public type in `packages/types/src/training.ts` (alongside `CyclePhaseConfig`):

```ts
export interface EquipmentInstance {
  /** Smallest achievable weight step on this machine, in kg (e.g. 5 for a 5 kg-stack cable). */
  incrementConstraint?: number;
  /** Lowest achievable weight, in kg (e.g. empty carriage). Defaults to 0. */
  minWeight?: number;
  /** A confirmed real working weight on this specific machine; preferred as baseline. */
  confirmedWorkingWeight?: number;
}
```

Add optional `equipment?: EquipmentInstance` to `ProgressionInput` (engine `types.ts`).

**Snap helper (pure):** achievable weights are `{ minWeight + k·increment : k ≥ 0 }`. Snap down =
largest achievable `≤ target` (floored at `minWeight`).

```ts
function snapDownToEquipment(target: number, eq: EquipmentInstance): number {
  const min = eq.minWeight ?? 0;
  const inc = eq.incrementConstraint;
  if (!inc || inc <= 0) return target;            // no constraint → unchanged
  if (target <= min) return min;
  const k = Math.floor((target - min) / inc);
  return min + k * inc;
}
```

## Integration into `calculateLoadProgression`

- **Precedence:** self-tuning(config) → core branch → cycle veto → cycle loadModifier scale →
  **equipment snap (last).** The snap is the physical reality of the machine, applied after every
  load-shaping axis. Implemented by extending the existing `finalize()` wrapper so the snap
  composes after `applyCyclePhase`. Absent `equipment` → byte-identical to today.
- **Baseline preference:** in the `recentSets.length === 0` branch, when
  `equipment.confirmedWorkingWeight` is set, prefer it (snapped) over the baseline-derived working
  weight; reason: "using confirmed working weight on this machine".
- Snapping an `increase` whose target lands between increments can collapse it back to the current
  weight (you can't make the in-between weight) — that is physically correct; the reason notes the
  snap when it changes the value.

## Server API (PR3)

Extend `loadProgressionSchema` in `decisions.ts` with an optional `equipment` object
(`incrementConstraint`/`minWeight`/`confirmedWorkingWeight`, all non-negative, validated at the
boundary like `cyclePhase`). Thread onto `resolvedInput`. No new route.

## Out of scope (Phase B)
- `gym_equipment_instances` table + CRUD + the per-machine data-entry UI (the friction).
- `weightOffset` (machine geometry) and `setupNotes`.
- Snapping inside `generateWeeklyPlan` (per-session equipment context isn't assembled there yet).
