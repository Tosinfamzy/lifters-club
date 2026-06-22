# Lifters Club — Roadmap & Backlog

> Forward-looking companion to [PROJECT-STATUS.md](PROJECT-STATUS.md) (which describes
> *current* state). This file is the prioritized backlog of what's left to build,
> with enough detail to pick any item up later. Keep entries crisp; move shipped
> items to PROJECT-STATUS.md.

Effort key: **S** = hours · **M** = a day or two · **L** = multi-day.

> **★ Engine coaching gaps (real 5-week athlete feedback)** — see
> [plans/engine-coaching-gaps.md](plans/engine-coaching-gaps.md). Five engine gaps from live
> coaching use (athlete constraints, cycle-phase loading, permanent substitutions, within-session
> adjustment, equipment instances). These are the **product differentiators** and reorder
> priorities — coaching gaps generally outrank offline sync for differentiation.

---

## 1. Observability follow-ups (banked)

Structured Pino logs now flow to Sentry Logs (server), error monitoring + CPU
profiling are live across server/web/mobile. Remaining polish:

### 1a. Richer prod log level — **S**
Server forwards `warn,error,fatal` to Sentry Logs by default (set in
`apps/server/src/instrument.ts` via `SENTRY_LOG_LEVELS`). To capture full
request-level flow, set `SENTRY_LOG_LEVELS=info,warn,error,fatal` on the Railway
service.
- **Caveat:** `info` includes the per-request "Request completed" log, including
  frequent `/health` pings → volume/quota. Before enabling `info`, add a
  `beforeSendLog` hook in `instrument.ts` that drops logs whose `path`/`route`
  attribute is `/health`, `/api/docs`, or `/api/openapi.json`. Then `info` gives
  useful request tracing without the noise.

### 1b. Web + mobile logs into Sentry — **S–M**
Server uses the first-party `pinoIntegration`. Web (`@sentry/nextjs`) and mobile
(`@sentry/react-native`) have no structured logger, so they currently send only
errors/traces. To get client logs: set `enableLogs: true` in their Sentry configs
and either call `Sentry.logger.*` at meaningful points or add
`Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] })` to capture
console output. Decide whether client log volume is worth the quota.

### 1c. Migrate web Sentry client config — **S**
`apps/web/sentry.client.config.ts` still uses the legacy file. Sentry warns it
won't work under Turbopack. Move its contents to
`apps/web/src/instrumentation-client.ts` before adopting Turbopack.

### 1d. SQL span coverage for `@gymapp/db` — **M**
Drizzle uses `postgres-js` (porsager), which Sentry's `postgresIntegration` (pg
only) doesn't instrument, so DB time is invisible in traces. Either wrap DB calls
in explicit `Sentry.startSpan(...)` in the db package, or swap to a driver Sentry
instruments.

### 1e. Alerting & dashboards — **partially done** (2026-06-22)
**Done:** high-priority issue-alert rules email the owner on `lifters-club-server` (Sentry default)
and `lifters-club-web` (added — rule 675079, mirrors the server config). **Remaining:** add the same
rule to `lifters-club-mobile` *after* the EAS dev build (1f) makes it actually report; verify Spike
Protection is on per project (UI: Settings → Projects → … → Spike Protection); optionally a logs/perf
dashboard via the `sentry dashboard` CLI. Note: error volume is ~6/mo against the 5k free quota, so
no quota pressure — alerts don't consume quota.

### 1f. First mobile EAS dev build — **S** (needs store credentials)
`apps/mobile/eas.json` has a `development` profile, but Sentry's native iOS/Android
modules only load after a real `eas build --profile development` (Expo Go won't
load them). Mobile observability is in code but unverified until this runs.

---

## 2. Decision engine completeness (core product differentiator)

The engine is the heart of the product; these close the "learns from feedback" loop.

### 2a. Feedback-driven self-tuning — **M**
`getProgressionModifier()` exists in `packages/engine/src/feedback.ts` and is
exported, but **no decision route calls it**. Wire it into the decision endpoints
so the engine adjusts aggressiveness based on the user's historical decision
accuracy (followed + successful → more confident; overridden → more cautious).
→ **Detailed plan: [plans/decision-self-tuning.md](plans/decision-self-tuning.md)**

### 2b. Auto-evaluate remaining decision types — **mostly done** ✅
**Done:** `exercise_rotation`, `deload_recommendation`, `session_recovery` now auto-evaluate
on completion (additive `EvaluationContext`). **Remaining:** `missed_session` (deferred —
weak completion-time signal; manual-only for now, narrow MVP optional later).


`evaluatePendingDecisions` (`apps/server/src/services/decision-eval.ts`) runs on
workout completion and is generic, but the engine's `evaluateDecision` only
meaningfully scores `load_progression` and `volume_adjustment`. The other four —
`exercise_rotation`, `deload_recommendation`, `session_recovery`,
`missed_session` — can only be evaluated manually via
`PATCH /decisions/:id/outcome`. Extend `evaluateDecision` to score them so the
accuracy/feedback loop covers all decision types.
→ **Detailed plan: [plans/decision-auto-eval.md](plans/decision-auto-eval.md)**
(Prerequisite for 2a to be fully effective — self-tuning needs the wider feedback signal.)

---

## 3. Offline & mobile

### 3a. Full offline sync — **DONE 2026-06-22** (simple-queue path, ADR-0009)
Built out as a 4-PR arc (#30–#33; plan: `docs/plans/offline-sync.md`). Confirmed the simple-queue
approach over PowerSync (ADR-0005 stays superseded). What shipped:
- **Set persistence fixed** — the client omitted the server-required set `id`, so logged sets were
  400'ing on flush and being dropped (#30). Plus `completedAt` on complete.
- **Idempotent replay** — server upserts sets on the PK (`onConflictDoNothing`), so re-sends are
  no-ops, not 500s (#31).
- **Robust flush** — exponential backoff + jitter, error classification (4xx permanent → dead-letter;
  5xx/timeout transient → back off; dependency-not-ready → deferred, no retry penalty), and a
  **dead-letter store** so nothing is silently dropped (#32).
- **Triggers + recovery UX** — flush on reconnect/foreground/mount; the OfflineIndicator surfaces a
  "Sync Failed — tap to retry" banner wired to `retryDeadLetter()`; 409-tolerant decision replay (#33).

**Deferred (optional polish):** AsyncStorage→MMKV migration (ADR-0009 names MMKV; the code uses
AsyncStorage — functionally fine). Conflict handling intentionally minimal (append-only, single
writer → idempotent replay is sufficient).

---

## 4. Infra / ops polish

- **Vercel Preview builds (web) — FIXED 2026-06-20.** Every *Preview* build had
  been failing at `/_not-found` prerender (`@clerk/clerk-react: Missing
  publishableKey`) because `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` lived only in the
  **Production** scope. Added the public `pk_test_` (Clerk dev-instance) key to the
  Preview scope. Validated by the next web PR's preview build. *Note:* for preview
  *login* to work, that Clerk dev instance must also allow `*.vercel.app` preview
  origins (Clerk dashboard) — separate, not yet done.
- **Sentry release token — RESOLVED 2026-06-22.** `SENTRY_AUTH_TOKEN` had expired
  (`401`) on both Vercel scopes, so the `@sentry/nextjs` release + sourcemap-upload
  step failed on every web build (non-fatal). Rotated to a fresh, minimally-scoped
  Sentry personal token (`org:read` + `project:read` + `project:releases`) on both
  Preview + Production scopes. Validates on the next web build.
- **Pin base image digests** — `node:22-alpine` carries upstream CVEs; pin a
  patched digest in both Dockerfiles to silence image-scan warnings. **S**
- **Production deploy polish** — domain/DNS hardening, blue-green or health-gated
  deploys, rollback runbook. **M**
- **Mobile lint debt** — two unused-arg warnings: `setIndex` in
  `apps/mobile/components/workout/SetInputRow.tsx`, `exerciseIndex` in
  `apps/mobile/components/workout/ExerciseSetLogger.tsx` (prefix `_`). **S**

---

## Suggested sequencing

1. **2a + 2b** — highest product value; completes the decision feedback loop that
   is the app's core differentiator.
2. **1a + 1c** — quick observability wins (richer logs + Turbopack-ready).
3. **3a** — offline sync; large but high user value for a gym app.
4. **1d, 1e, 4** — ops maturity as traffic grows.
