# Plan: Issue 4 — Within-session, set-by-set load adjustment

> Source gap: [engine-coaching-gaps.md](engine-coaching-gaps.md) Issue 4. The engine is
> *weekly*; live coaching is *per-set*. A weight that moved fast on set 1 should trigger an
> increase on set 2 — and can establish a new baseline mid-session (real example: hamstring
> curl 25→27.5→30 kg in one session). This is the clearest expression of the "live coach, not
> a tracker" thesis. See [project-coaching-direction] in memory.

**Scope:** Phase A = engine + API (this plan). Phase B = mobile in-session live-coaching UI
(the "L", separate plan) — the engine fn is useless to users until the mobile surface renders
it live, but the engine/API land first and independently.

## Signed-off decisions (2026-06-20)

- **Target RPE default = 8** (top of the evidence-based working range RPE 7–9).
- **Adjustment is deviation-based** (relative to target RPE), not fixed absolute buckets — matches
  the autoregulation literature (prescribed RPE 8, reported RPE 9 → drop load ~4%;
  [SET FOR SET](https://www.setforset.com/blogs/news/autoregulation-tools-for-strength-training),
  [Autoregulation NMA, PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12336695/)).
- **Step size = reuse the existing engine increment** (2.5 kg under 50 kg working weight, else
  5 kg) — consistent with `calculateLoadProgression`, no new magic number, aligns with the
  literature's ±5 kg per-set accessory range.

## Decision table (target RPE 8)

| Reported RPE vs target | Reps | Action | Next-set weight |
|---|---|---|---|
| ≥2 below (≤6) | hit top of range | **increase** | +1 increment |
| within ±1 (7–9) | any | **maintain** | same |
| exactly +1 (9) | hit top | **maintain** (hold) | same — reason notes "RPE 9, hold before adding load" |
| ≥+2 (10) | any | **decrease** | −1 increment |
| any | below min reps | **decrease** | −1 increment |

Actions stay `increase | maintain | decrease` to match `LoadDecision` (LSP-consistent). The
"hold" nuance lives in the `reason` string, not a 4th enum value.

### New-baseline flag
`newBaselineIfConfirmed` is set when the completed set was **above the planned weight** at
**RPE ≤ 8** and **not below min reps** → next session's `calculateLoadProgression` should seed
its baseline from the *achieved* weight, not the planned one. Pure data on the output; the
imperative shell (server/mobile) decides whether to persist it.

## Engine API

New file `packages/engine/src/within-session.ts`:

```ts
export interface WithinSessionInput {
  completedSet: { weight: number; reps: number; rpe?: number };
  targetRepRange: [number, number];
  plannedWeight: number;       // the session's planned working weight for this exercise
  remainingSets: number;       // sets left after this one (0 = last set)
  targetRpe?: number;          // default config.targetRpe (8)
}

export type WithinSessionAction = "increase" | "maintain" | "decrease";

export interface WithinSessionDecision {
  action: WithinSessionAction;
  nextSetWeight: number;
  reason: string;
  newBaselineIfConfirmed?: { weight: number; reps: number };
}

export interface WithinSessionConfig {
  targetRpe: number;                       // 8
  increaseRpeGap: number;                  // 2  (≥ this far below target → eligible to increase)
  reduceRpeGap: number;                    // 2  (≥ this far above target → reduce)
  smallIncrement: number;                  // 2.5
  largeIncrement: number;                  // 5
  weightThresholdForLargeIncrement: number;// 50
  baselineMaxRpe: number;                  // 8  (max RPE that confirms a new baseline)
}

export function calculateWithinSessionAdjustment(
  input: WithinSessionInput,
  config?: WithinSessionConfig
): WithinSessionDecision;
```

**Behavior notes**
- Increment is chosen off `completedSet.weight` (the real anchor — the athlete may have
  deviated from plan), mirroring the `< weightThresholdForLargeIncrement` rule in progression.
- `increase` requires BOTH low RPE AND hitting the top of the rep range — low RPE on low reps is
  not a green light.
- No RPE reported → fall back to reps-only: ≥ max reps → maintain (can't *confirm* it was easy,
  so don't push), < min reps → decrease, else maintain. Conservative by design.
- `remainingSets === 0` → still returns an action + `newBaselineIfConfirmed`; `nextSetWeight` is
  the advisory weight "if you did another set" and the reason notes it was the last set.
- Pure function, no side effects. Unit-tested to ≥ 90% (engine target).

## Server API (PR3)

`POST /api/decisions/within-session` in `apps/server/src/routes/decisions.ts`, mirroring the
`/load-progression` shape: zod-validated body, optional `userId`/`workoutId` for persistence,
persists as a new decision type `within_session` (additive to the decision-type union). No
self-tuning/cycle wiring in Phase A (within-session is its own short feedback loop).

## Out of scope (Phase B)
- Mobile in-session UI: surface `nextSetWeight`/`reason` live (rest-timer overlay is the natural
  slot — `RestTimerOverlay.tsx`), accept/override capture, baseline-promotion confirm.
- Auto-evaluation of `within_session` decisions (short loop; defer with `missed_session`).
