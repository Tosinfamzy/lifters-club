# Plan: Issue 2 — cycle phase as a load modifier

> From [engine-coaching-gaps.md](engine-coaching-gaps.md) Issue 2 (real athlete feedback). Menstrual
> cycle phase is a *systematic load protocol* distinct from acute readiness: a menstrual-phase
> athlete with HIGH readiness should still hold/reduce load (protocol, not feeling).

## Core design (code-true)
- `calculateLoadProgression` and `calculateSessionRecovery` are **separate functions** (load decision
  vs session volume/intensity scalar) — never chained. So "apply cycle **before** readiness" means:
  **cycle bakes into the load *target/action*; readiness stays a later session scalar.** Orthogonal.
- **Self-tuning composes via the config (2nd arg); cycle via the input (1st arg).** Self-tuning shapes
  *how aggressive* the increment/threshold are; cycle decides *whether an increase is allowed* and
  *scales the target weight*. They never collide.

## Decisions
1. **`allowNewWeightTests: false` is the ENFORCED lever** — suppresses the `increase` branch even when
   reps/RPE + aggressive self-tuning earned it ("menstrual — holding load, no new weight tests").
   **`loadModifier` is the SOFT default** — scales the chosen `newWeight` (clamped ≤1, ≥0.5: a
   hold/reduce protocol, never an increase). Both **per-athlete overridable** (evidence: the athlete
   *exceeded* the menstrual hold at high readiness).
2. **No migration for MVP.** Phase is self-reported per session (changes mid-week), sent transiently in
   the `/load-progression` request, and persisted in the existing `decisions.input` jsonb (audit).
   A `users.preferences.tracksCycle` flag (jsonb, no migration) gates the UI; optional
   `preferences.cyclePhaseOverrides` holds per-athlete % overrides.
3. **Not threaded into `generateWeeklyPlan`** — cycle is a session-time re-evaluation (the plan is
   generated ahead; phase changes mid-week). One-line comment in `planning.ts` to record the intent.

## Default per-phase modifiers (engine `defaultCyclePhaseConfig`, OCP, overridable) — FOR SIGN-OFF
| Phase | loadModifier | allowNewWeightTests | Rationale |
|-------|--------------|---------------------|-----------|
| menstrual | **0.90** | **false** | protocol hold + no new maxes (Milica's "~10% reduction, hold") |
| follicular | 1.00 | true | progress freely (full effort) |
| ovulatory | 1.00 | true | peak — progress freely |
| luteal | 0.95 | true | mild conservative taper |

> These are overridable soft defaults; the cycle-periodization literature is mixed, so the enforced
> behavior is the `allowNewWeightTests` veto, not the %. Numbers are the product decision to confirm.

## Types
- `@gymapp/types/src/training.ts`: `CyclePhase = "menstrual"|"follicular"|"ovulatory"|"luteal"`;
  `CyclePhaseConfig { phase, dayOfPhase?, loadModifier, allowNewWeightTests }`. Add `tracksCycle?` +
  `cyclePhaseOverrides?` to `UserPreferences`.
- `@gymapp/engine/src/progression.ts`: `defaultCyclePhaseConfig: Record<CyclePhase, {loadModifier, allowNewWeightTests}>` (named constants).
- `@gymapp/engine/src/types.ts`: optional `cyclePhase?: CyclePhaseConfig` on `ProgressionInput`.

## Engine logic (`calculateLoadProgression`, guarded by `if (input.cyclePhase)` → undefined = byte-identical)
After self-tuning has shaped `config` and the core branch computes action: if `allowNewWeightTests===false`,
suppress `increase` → fall to `maintain` (or `decrease` if independently true), reason explains the hold.
Apply `loadModifier` to the chosen `newWeight` (and the `recentSets:[]` baseline `workingWeight`), round to
0.5kg. Precedence: self-tuning(config) → core branch → cycle increase-veto → cycle loadModifier scale.

## API (`apps/server/src/routes/decisions.ts` + validation)
`cyclePhaseSchema` (Zod, `loadModifier` 0.5–1 optional, phase enum) on `loadProgressionSchema`. Handler
resolver: merge request partial over `defaultCyclePhaseConfig[phase]` (+ `preferences.cyclePhaseOverrides`)
→ full `CyclePhaseConfig` on the input. Skip entirely when absent (byte-identical). Log when applied
(mirror "Self-tuning applied"). Audit rides in `decisions.input`.

## Tests (engine `progression.test.ts`)
menstrual + earned-increase reps ⇒ NOT increase (held, weight ×0.90); menstrual ⇒ loadModifier scales a
maintain/decrease; follicular + moderate ⇒ progresses normally; allowNewWeightTests:false blocks increase
in isolation; **undefined cyclePhase ⇒ byte-identical** (regression); **composition: aggressive tuning +
menstrual no-tests ⇒ still no increase**; baseline branch ×loadModifier; per-athlete override beats default.
Server: `/load-progression` with cyclePhase persists it in `input`.

## MVP vs full
MVP: types + defaults + engine + validation + route resolver + preferences flag (no migration).
Full: `readinessChecks.cyclePhase`/`cycleDayOfPhase` columns + cycle-vs-performance analytics; dayOfPhase-aware
tapering; onboarding/session UI; thread into the Issue 4 within-session endpoint when it lands.

## Effort: **M** (engine is S). Risks: the % defaults (product sign-off — enforced lever is the veto, not
the %); per-athlete overrides in jsonb; mid-week change handled by session-level application; engine trusts
self-reported phase (boundary validation only, no Date math — stays pure).
