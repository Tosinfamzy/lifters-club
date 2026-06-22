# Changelog

All notable changes to Lifters Club are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). The project is not yet versioned by
release, so entries are grouped by date. PR numbers link the change to its review.

## 2026-06-22

### Added

- **Full offline sync** (#30, #31, #32, #33) — the mobile reconnect-flush story, built out on the
  simple-queue path (ADR-0009; PowerSync/ADR-0005 stays superseded). Set logging now persists
  reliably and syncs when back online: **idempotent replay** (server upserts logged sets on the PK,
  so re-sends are no-ops not 500s, #31); **robust flush** with exponential backoff + jitter, error
  classification (4xx → permanent, 5xx/timeout → transient, dependency-not-ready → deferred without a
  retry penalty), and a **dead-letter store** so a permanently-failing op is never silently dropped
  (#32); **flush triggers** on reconnect / app-foreground / mount, a "Sync Failed — tap to retry"
  banner wired to `retryDeadLetter()`, and 409-tolerant decision-outcome replay (#33). Plan:
  `docs/plans/offline-sync.md`.
- **Sentry web alerting** — a high-priority issue-alert rule on `lifters-club-web` (mirrors the
  server default) emails the owner on a new/escalating high-priority issue. (Mobile rule deferred
  until the EAS dev build makes it report.) Error volume is ~6/mo vs the 5k free quota, so no quota
  pressure — alert rules don't consume quota.

### Fixed

- **Logged sets weren't reaching the server** (#30) — the mobile client omitted the server-required
  set `id` (and `completedAt` on complete) on both write paths, so queued sets 400'd on flush, retried
  3×, then were silently dropped. The client now sends the stable id (which also becomes the
  idempotency key). Pre-launch, so no production data lost.
- **Expired Sentry release token** — `SENTRY_AUTH_TOKEN` (both Vercel scopes) had expired (`401`), so
  the `@sentry/nextjs` release + sourcemap-upload step failed on every web build (non-fatal, but no
  readable prod stack traces). Rotated to a fresh, minimally-scoped token; validated by a preview
  build uploading sourcemaps cleanly.

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
- **Cycle-phase load modification — engine + API** (#17) — optional `CyclePhaseConfig` on
  `calculateLoadProgression`: a per-phase load modifier (clamped 0.5–1.0) plus an
  `allowNewWeightTests` veto (the firmer lever — no new maxes during a phase), layered request →
  per-athlete preference override → engine default, applied before the equipment snap. Self-reported
  at session start, opt-in via `tracksCycle`; absent → byte-identical to pre-cycle behavior. The web
  UI for it landed in #26. (Also cleared the outstanding mobile lint debt.)
- **Decision self-tuning** (#9) — load-progression and volume decisions now adjust their
  aggressiveness from the user's historical decision accuracy, gentle + clamped + flag-gated
  (`SELF_TUNING_ENABLED`) + audited. Engine version → `1.1.0`.
- **Auto-evaluation for more decision types** (#10) — `exercise_rotation`, `deload_recommendation`,
  and `session_recovery` decisions are now scored automatically on workout completion (previously
  only load/volume). `missed_session` deferred (weak completion-time signal).
- **Within-session set-by-set coaching — engine + API** (#18) — new pure
  `calculateWithinSessionAdjustment`: given the set just completed, it prescribes the next set's
  load by deviation from a target RPE (grounded in autoregulation literature), reusing the engine's
  existing increment, and flags a mid-session PR (`newBaselineIfConfirmed`) when a set clears the
  planned weight at a sustainable effort — to seed next session's baseline from the achieved weight.
  New `POST /api/decisions/within-session`. The live mobile UI is Phase B.
- **Equipment increment-snap — engine + API** (#18) — `calculateLoadProgression` accepts an optional
  `EquipmentInstance` (per-machine increment / min weight / confirmed working weight) and snaps the
  prescribed load *down* to a weight the machine can actually make (never prescribes an unachievable
  load), preferring a confirmed working weight as the cold-start baseline. Applied after cycle-phase
  scaling. Threaded through the load-progression route. Per-machine data entry is Phase B.
  Engine version → `1.2.0`.
- **Within-session live coaching — mobile** (#20, #25, #27, #28) — the live-coach surface. After each
  set, a non-blocking call to `/decisions/within-session` (which now returns the persisted
  `decisionId`, #20) surfaces a coach card in the rest-timer overlay with the next-set load, delta vs
  the set just done, and the engine's reasoning (#25). "Use it" records *followed* + pre-fills the
  next set; "Dismiss" records *overridden* — both feeding the self-tuning loop (#27). A flagged
  mid-session PR offers an explicit "Set as baseline" tap → `POST /users/:id/baselines` (#28).
- **Equipment instances — persistence + read-through** (#19) — new `gym_equipment_instances` table
  (one row per user+exercise, migration 0008) + `GET/PUT/DELETE /api/users/:id/equipment-instances`,
  plus a read-through that auto-applies a saved machine in `/load-progression` (a request value
  overrides the stored one). Makes the engine snap (#18) actually reachable.
- **Web Coaching Profile** (#21, #22, #23, #26, #29) — a new Settings → Coaching Profile area exposing
  every athlete input the engine consumes: constraints + grip + injuries + banned/corrective
  exercises (#21, #29), permanent substitutions with a reusable searchable exercise picker (#22),
  per-machine equipment limits (#23), and opt-in cycle-phase tracking + per-phase load overrides
  (#26). All ride existing APIs (cycle phase via `updateUser` preferences); no backend changes.
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
- **Flaky exercise seed-guard** (#24) — `exercises.test.ts` gated its seed-dependent cases on
  `count(exercises) > 0`. Vitest runs test files in parallel against one shared CI DB, so any other
  file inserting an exercise flipped that true and made these tests *run* (and 404) without real seed
  data — intermittent CI red on unrelated PRs. Now gates on a specific canonical exercise.
- **Vercel Preview builds were broken** (infra, no PR) — every *Preview* build failed at
  `/_not-found` prerender (`Missing publishableKey`) because `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` lived
  only in the **Production** env scope. Added the public Clerk dev key to the Preview scope. Masked
  for weeks by the "Ignored Build Step" skipping web builds. Production was always unaffected.

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
