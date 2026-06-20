# Plan: Engine coaching gaps (from real 5-week athlete feedback)

> Source: Milica Lukic's feedback doc (17 May 2026) — 5 weeks using the app/Claude as a **live
> coach** (set-by-set feedback, cycle-synced loading, injury constraints, substitutions). This
> is validated real-user input, not speculation. Companion to [ROADMAP.md](../ROADMAP.md).
>
> **Why it matters:** the current engine is *cross-session* (log → next-week advice). This
> feedback is about *live, in-session coaching with athlete context* — a stronger, more
> differentiating product thesis than the table-stakes items (offline sync). Issues 1, 2, 4 are
> the differentiators.

Effort: **S** hours · **M** day or two · **L** multi-day. All are engine-level; pure-function
+ config pattern means 1/2/3/5 are additive optional inputs (no breaking change).

---

## Issue 1 — Athlete constraint profile as a first-class engine input — **MVP ✅ SHIPPED · phase 2 pending**
> MVP shipped: equipment/movement/banned filtering in `findSubstitutes` + corrective-priority
> volume protection + CRUD. **Phase 2 pending:** weekly-plan enforcement (needs exercise-library
> wiring into the planning service) + grip handling (needs a `grip` attribute + reseed to close the
> wrist case). See [issue-1-athlete-constraints.md](issue-1-athlete-constraints.md).
**Problem:** the engine can recommend movements an injured athlete can't safely do; constraints
live outside the engine and are applied by a human.
**Current state (grounded):** *partially scaffolded already* — exercises have a `constraints`
jsonb field, there's a `Constraint` type (`packages/types/src/exercise.ts`), and `findSubstitutes`
already takes `excludeConstraints?: Constraint[]`. What's missing:
1. a **persisted `AthleteConstraints` profile** (new table + API; grip/movement restrictions,
   injury flags, `correctivePriority` exercise IDs that can't be volume-reduced),
2. auto-feeding it into `findSubstitutes` (instead of ad-hoc caller-passed excludes),
3. honoring it in `calculateVolumeAdjustment` (never reduce `correctivePriority` below min) and
   `generateWeeklyPlan` (omit/substitute conflicting exercises — ties to Issue 3 for the
   substitute, so "omit" doesn't leave a hole).
**Take:** highest priority — it's a *safety/correctness* gap, and the foundation exists so it's
less work than it looks. The `correctivePriority` protection in volume is a small, high-value win.

## Issue 2 — Cycle phase as a load modifier (distinct from readiness) — **High · M**
**Problem:** readiness (acute: sleep/stress) and cycle phase (systematic: a multi-day loading
protocol) are different signals needing different responses; conflating them gives wrong outputs.
A menstrual-phase athlete with *high* readiness should still hold load (protocol, not feeling).
**Current state:** `calculateSessionRecovery` handles readiness only; no cycle concept exists.
**Proposed:** optional `CyclePhaseConfig { phase, dayOfPhase, loadModifier, allowNewWeightTests }`
input to `calculateLoadProgression` (+ `generateWeeklyPlan`), applied **before** the readiness
modifier. Self-reported at session start (one optional tap — no wearable needed); "skip" leaves
non-tracking users unaffected.
**Take / critical note:** big differentiator for ~half the user base, rarely done well elsewhere.
But the evidence shows the athlete *exceeded* the menstrual "hold" (hit 127.5 kg) — so the blanket
`loadModifier` (e.g. 0.90) is a **soft, overridable default**; the more robust lever is
`allowNewWeightTests: false` (no new maxes during menstrual) rather than a forced % cut. Phase
must be re-evaluated at session level (it can change mid-week), not baked into the weekly plan.

## Issue 3 — Persist permanent substitutions — **✅ SHIPPED (MVP) · weight-carry pending**
> Shipped: persistence + CRUD + `findSubstitutes` short-circuit + substitutes-route threading.
> **Pending:** weight-carry read-through (folds into weekly-plan assembly in Issue 1 phase 2).
> See [issue-3-permanent-substitutions.md](issue-3-permanent-substitutions.md).
**Problem:** `findSubstitutes` re-derives every time with no memory; permanent swaps (fit/anatomy/
injury, not daily equipment) get silently un-applied (real incident: bilateral leg press done in
error because the permanent BSS swap wasn't enforced).
**Proposed:** `PermanentSubstitution { originalExerciseId, substituteExerciseId, reason,
confirmedAt, weightCarries }` stored on the athlete profile; `findSubstitutes` short-circuits to
the stored sub; **working weight carries** to the substitute when `weightCarries` (don't reset
progression). Pairs with Issue 1 (a constraint-omitted exercise needs a stored substitute).
**Take:** self-contained, clear DoD, removes a real error class. Good medium-effort win.

## Issue 4 — Within-session, set-by-set load adjustment — **Medium · M (engine) + L (mobile)**
**Problem:** the engine is weekly; live coaching is per-set. A weight that moved fast on set 1
should trigger an increase on set 2 — and can establish a new baseline mid-session (real example:
hamstring curl 25→27.5→30 kg in one session set a new working weight).
**Proposed:** new pure `calculateWithinSessionAdjustment(setResult, sessionTarget, remainingSets)`
→ `{ nextSetWeight, action, reason, newBaselineIfConfirmed? }`. Configurable RPE thresholds
(≤6 increase / 7–8 maintain / 9 hold-or-reduce / 10 reduce). `newBaselineIfConfirmed` flags when
an above-target set at RPE ≤8 should seed *next session's* `calculateLoadProgression` from the
achieved weight, not the planned one.
**Take:** the clearest expression of the "live coach, not a tracker" thesis. The engine function
is a clean M, **but the value is unlocked by mobile in-session UI** (accept set feedback, surface
reasoning live) — that's the L, and a product-mode decision. Biggest bet here.

## Issue 5 — Equipment-instance data — **Low–Medium · M**
**Problem:** the taxonomy treats all machines of a type as equivalent; real machines differ in
geometry (different working weights) and have fixed increments, so a target can be unachievable
(16 kg target on a cable that only does 15 kg).
**Proposed:** optional `GymEquipmentProfile { instances: EquipmentInstance[] }` (per-exercise
`weightOffset`, `incrementConstraint`, `confirmedWorkingWeight`, `setupNotes`).
`calculateLoadProgression` snaps the target to the nearest achievable increment and prefers
`confirmedWorkingWeight` as the baseline.
**Take:** real accuracy win but lower urgency and needs per-user equipment data entry (friction).
The `incrementConstraint` snap is the cheapest, highest-value slice; the rest can wait.

---

## Notes from the feedback

- **Calibration onboarding — mostly shipped.** We now have `calibration.ts` + an onboarding flow
  that establishes baselines (incl. an RPE/e1RM estimate, `source: "calibration"`). Milica's
  richer vision — a guided **calibration *week*** running the whole program at controlled RPE 7,
  which also *teaches* RPE through experience — is **not** built (ours is a quick single-session
  baseline entry). Possible onboarding enhancement, not a gap in the core mechanic.
- **Mobile in-session coaching mode** — pairs with Issue 4; a product-direction decision (a
  dedicated live-coaching screen), separable from the engine work.

---

## How this reshapes priorities

This is the strongest signal we have about *what the product should be*: a **constraint-aware,
context-aware live coach**. That reorders things:

1. **Issue 1 (constraints)** — safety/correctness + half-built → do first.
2. **Issue 2 (cycle phase)** — high-value differentiator, clean additive, low UI friction.
3. **Issue 3 (permanent subs)** — self-contained medium win; complements 1.
4. **Issue 4 (within-session) + mobile in-session mode** — the big "live coach" bet; engine first,
   then the mobile mode.
5. **Issue 5 (equipment)** — accuracy polish; start with the increment-snap slice.

vs the prior roadmap: these **coaching gaps outrank offline sync** for *differentiation* (offline
sync is table-stakes UX). Offline sync still matters for reliability; sequence it alongside, not
ahead of, the coaching work. `missed_session` stays deferred (dormant).
