# Changelog

All notable changes to Lifters Club are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). The project is not yet versioned by
release, so entries are grouped by date. PR numbers link the change to its review.

## 2026-06-20

### Added

- **Athlete constraint profile** (#11) — injury/equipment/movement restrictions are now a
  persisted, first-class engine input. The engine won't *suggest* a movement an athlete can't
  safely do: `findSubstitutes` auto-filters by equipment/movement/banned exercises, and
  corrective-priority exercises are protected from volume reduction. New
  `GET/PUT /api/users/:id/constraints`.
- **Permanent substitutions** (#11) — deliberate exercise swaps (fit/anatomy/injury) persist and
  apply consistently instead of being re-derived. `findSubstitutes` short-circuits to the stored
  swap (with a safety valve so a constraint block wins over a stale swap). New
  `GET/PUT/DELETE /api/users/:id/substitutions`.
- **Weekly-plan constraint enforcement** (#12) — `generateWeeklyPlan` no longer *schedules* an
  unsafe exercise: it substitutes (permanent swap first, else a constraint-safe ranked sub) or
  omits with a reason. Also revived exercise rotation, which had been dead (empty substitute list).
- **Permanent-substitution weight-carry** (#13) — a substituted exercise progresses off its own
  logged history once it exists, falls back to the original's weight on cold start (when
  `weightCarries`), else a conservative start.
- **Grip handling** (#14) — a `grip` axis on exercises + a grip-restriction constraint axis;
  closes the `no_wrist_extension` / neutral-grip case (previously inert). 35 exercises tagged.
- **Decision self-tuning** (#9) — load-progression and volume decisions now adjust their
  aggressiveness from the user's historical decision accuracy, gentle + clamped + flag-gated
  (`SELF_TUNING_ENABLED`) + audited. Engine version → `1.1.0`.
- **Auto-evaluation for more decision types** (#10) — `exercise_rotation`, `deload_recommendation`,
  and `session_recovery` decisions are now scored automatically on workout completion (previously
  only load/volume). `missed_session` deferred (weak completion-time signal).
- **ROADMAP + banked plans** (#7, #8) — `docs/ROADMAP.md` and detailed implementation plans under
  `docs/plans/` (observability, decision-engine, athlete-coaching gaps from real athlete feedback).

### Changed

- **Node 20 → 22 (LTS)** (#4) — CI, Dockerfiles, `.nvmrc`, `engines`; GitHub Action runtimes bumped
  off the deprecated node20 runtime.

### Fixed

- **`db-migrate` workflow was a silent no-op** (#15) — it ran a nonexistent `drizzle-kit` *script*,
  printed a warning, and exited 0, so migrations never reached production (surfaced as a 500 outage
  when a public-table column was added). Now runs `db:migrate`.
- **`/decisions/accuracy` & `/pending-evaluation` were 404-shadowed** by the `/:id` route (#9) —
  reordered so the static routes resolve.

## 2026-06-19

### Added

- **Calibration completion flow** (#2) — `POST /api/users/:id/calibration-results` turns logged
  calibration sets into baselines (best set per exercise + estimated 1RM); web + mobile onboarding
  wired to submit them.
- **Pino structured logs → Sentry Logs** (#6) — server logs (warn+ by default, tunable via
  `SENTRY_LOG_LEVELS`) now flow into Sentry's Logs product with their structured attributes.

### Fixed

- **Onboarding baselines silently failed** (#5) — the calibration-plan fetch was ownership-gated and
  ran *before* the user existed, so it 404'd and no baselines were ever saved. The plan is now
  stateless; the silent error-swallow surfaces real errors.
- **Program seed** (#1) — made idempotent (FK-safe upsert) and registered the missing
  `db:seed:*` turbo tasks.
- **API deploy** (#3) — the Sentry release step no longer blocks the deploy (squash-merge +
  shallow-clone tolerated via `fetch-depth: 0` + `ignore_missing` + `continue-on-error`).

---

> Earlier history predates this changelog. See `git log` and `docs/PROJECT-STATUS.md` for the
> foundational build-out (monorepo, type system, decision engine, API, web + mobile apps,
> multi-platform Sentry observability).
