# Lifters Club - Project Status

> A comprehensive overview of what has been built, how it fits together, and where we are now. Written for Claude agents working on this codebase.

---

## What Is Lifters Club?

Lifters Club is a **training decision engine** that transforms workout history into intelligent, justified training decisions. It doesn't just track workouts - it tells you *what to do next* and *why*, then learns from whether its advice was good.

The core insight: every logged set feeds a pure-function decision engine that produces recommendations with human-readable reasoning. Users can follow, override, or ignore decisions, and that feedback improves future recommendations.

---

## Monorepo Structure

```
lifters-club/
├── apps/
│   ├── server/          # Hono REST API (port 4000)
│   ├── web/             # Next.js 15 frontend (port 3000)
│   └── mobile/          # Expo/React Native (feature-rich, near parity with web)
├── packages/
│   ├── types/           # @gymapp/types - shared TypeScript types (zero runtime)
│   ├── validation/      # @gymapp/validation - Zod schemas
│   ├── engine/          # @gymapp/engine - pure-function decision logic
│   └── db/              # @gymapp/db - Drizzle ORM schemas + migrations
├── docs/                # ADRs, data model docs
├── .github/workflows/   # CI/CD
└── docker-compose.yml   # Local dev environment
```

**Tooling:** Turborepo + pnpm, TypeScript 5.7 strict mode, Vitest, ESLint

---

## What Has Been Built

### 1. Shared Packages (Foundation Layer)

#### @gymapp/types
Single source of truth for all domain types. Zero runtime code. Defines:
- **Exercise domain:** 12 movement patterns, 9 equipment types, 12 muscle groups, difficulty levels
- **Training domain:** User, Program, TrainingBlock, Workout, WorkoutLog, LoggedSet
- **Decision domain:** 7 decision types (load_progression, volume_adjustment, exercise_rotation, deload_recommendation, session_recovery, missed_session, weekly_plan_update), DecisionOutcome tracking
- **Standalone training:** WorkoutTemplate, WeeklyPlan, StandaloneWorkout

#### @gymapp/validation
Zod schemas for runtime validation with inferred types. Covers exercise, user, program, training block, workout, workout log, decision, and query parameter validation. All schemas include custom error messages.

#### @gymapp/db
Drizzle ORM with PostgreSQL 16. Two separate schemas:

**`exercise_lib` schema** - Standalone exercise library (reusable as independent product):
- `exercises` - Canonical movement database with semantic IDs (e.g., "barbell-back-squat")

**`training` schema** - User and training data (13 tables total):
- `users` - Clerk-authenticated users with preferences, training level, goal
- `programs` - Program templates with JSONB session structures
- `trainingBlocks` - User instances of programs with date tracking
- `workouts` - Scheduled workout instances from training blocks
- `workoutLogs` - Actual workout execution records
- `loggedSets` - Individual set data (weight, reps, RPE)
- `decisions` - Engine decision audit trail with algorithm version
- `decisionOutcomes` - Feedback loop (followed/overridden/ignored + success tracking)
- `standaloneWorkouts` - Single workouts not tied to programs
- `workoutTemplates` - Reusable workout blueprints
- `weeklyPlans` - Standalone week-level training plans
- `userBaselines` - Starting strength data for progression engine
- `readinessChecks` - Pre-workout sleep/soreness/stress/energy assessments

Migrations are tracked in git and run via Drizzle Kit. Seed scripts exist for the exercise library and program templates.

#### @gymapp/engine
The core innovation - **14 pure-function decision/calculation modules** (~2,500 LOC):

1. **Load Progression** - Increase/decrease/maintain weight based on rep range and RPE thresholds. Configurable increments (small: 2.5kg for <50kg, large: 5kg for >=50kg). Baseline-aware for new users.
2. **Volume Adjustment** - Add/reduce sets based on completion rate and RPE. Respects min/max bounds (2-6 sets). Requires 2 weeks of data before adjusting.
3. **Exercise Rotation** - Keep or swap exercises based on plateau detection, fatigue, injury concerns.
4. **Deload Detection** - Recommends recovery weeks after extended high RPE periods.
5. **Session Recovery** - Reduces volume/intensity when readiness is poor (sleep/soreness/stress).
6. **Missed Session Handling** - Decides whether to resume, repeat, or regress after skipped workouts.
7. **Weekly Plan Generation** - Rolls forward incomplete workouts, applies decision modifications.
8. **Session Readiness** - Scores 0-100 from readiness inputs, recommends proceed/modify/rest.
9. **Decision Evaluation** - Retrospective accuracy analysis of past decisions.
10. **Exercise Substitution** - Weighted scoring: movement pattern (35%), primary muscles (25%), secondary muscles (10%), compound match (10%), difficulty (10%), equipment (10%). Returns top ranked substitutes with reasons.
11. **1RM Estimation** - Brzycki formula, working weight calculation, percentage utilities.
12. **Calibration** - Generates baseline exercise plans for new users, processes calibration results.
13. **Feedback Analysis** - Analyzes override patterns to improve confidence scoring.
14. **Performance Trending** - Multi-week trend analysis for plateau/regression/improvement detection.

**Key design:** All functions take data as input (no DB calls), return decisions with reasoning strings, accept optional config objects for threshold customization. Engine version is tracked for audit trail.

**Test coverage:** 5 test suites, 60+ test cases covering progression, volume, rotation, planning, and recovery. Targets 90%+.

---

### 2. Backend Server (`apps/server`)

**Framework:** Hono 4.6 on Node.js

**Middleware stack (in order):**
1. Request ID generation (tracing)
2. Structured logging (Pino) with request context
3. Security headers (HSTS, CSP, etc.)
4. Rate limiting (skipped in dev)
5. CORS
6. Clerk JWT verification (protected routes)

**25+ REST API endpoints:**

| Area | Endpoints | Description |
|------|-----------|-------------|
| Exercises | GET/POST/PATCH/DELETE `/api/exercises`, GET `/:id/substitutes` | Full CRUD + substitution scoring |
| Training Blocks | GET/POST `/api/training-blocks`, GET `/:id` | Program instance management |
| Workouts | GET `/api/workouts`, GET `/:id`, POST `/:id/complete`, POST `/:id/skip` | Scheduled workout operations |
| Users | GET/PATCH `/api/users/me` | Authenticated user management |
| Programs | GET/POST/PATCH `/api/programs`, GET `/:id` | Program template library |
| Workout Logs | GET/POST `/api/workout-logs`, POST `/:id/sets` | Set-by-set logging |
| Decisions | GET `/api/decisions`, POST `/:id/override`, GET `/accuracy` | Decision history + feedback |
| Analytics | GET `/api/analytics` | Trends, PRs, heatmaps |
| Weekly Plans | GET `/api/weekly-plans` | Standalone week plans |
| Standalone Workouts | GET `/api/standalone-workouts` | Non-program workouts |
| Health | GET `/health` | Health check |

**Additional features:**
- OpenAPI/Swagger docs at `/api/docs`
- Sentry error tracking
- Structured JSON logging with request context

**Integration tests:** 4 test suites covering exercises, users, programs, and workouts. Tests mock Clerk JWT verification and run against a real PostgreSQL database in CI.

---

### 3. Web Frontend (`apps/web`)

**Framework:** Next.js 15 (App Router) with Tailwind CSS 4 + shadcn/ui

**Authentication:** Clerk with dark-mode theming

**Pages implemented:**

| Route | Description |
|-------|-------------|
| `/` | Marketing landing page |
| `/sign-in`, `/sign-up` | Clerk authentication |
| `/dashboard` | Today's workout, recent workouts, active block progress, pending decisions, streak |
| `/analytics` | Strength progress charts, volume trends, RPE heatmap, frequency heatmap, PRs |
| `/history` | Workout history with filtering, set-by-set logging interface |
| `/decisions` | Decision cards with reasoning, override with reason picker, accuracy stats |
| `/programs` | Program library (filter by goal/level), creation/deletion dialogs |
| `/programs/[id]` | Program details, training block progress |
| `/settings` | User preferences and configuration |
| `/onboarding` | Guided user setup flow |
| `/exercises` | Exercise library browser (public, searchable) |
| `/exercises/[id]` | Exercise details with substitution suggestions |

**Key components:**
- `DashboardLayout` - Sidebar nav + mobile hamburger nav
- `DecisionCard` - Interactive decision display with override capability
- `TrainingBlockProgress` - Visual week/progress tracking
- Recharts-based analytics (strength, volume, RPE, heatmap)
- `SetInput` / `WorkoutDrawer` / `LogWorkoutDialog` - Workout logging UI
- `ExerciseGrid` - Searchable exercise browser with keyboard navigation
- Toast notifications via Sonner

**Patterns:** React Server Components for data fetching, client components for interactivity, centralized `useApi` hook, error boundaries, loading states.

---

### 4. Mobile App (`apps/mobile`)

**Framework:** Expo 54 + React Native 0.81 + Expo Router 6

**Status:** Feature-rich, near parity with web. This is a production-quality mobile app, not a scaffold.

**5 tab screens:**
- **Today** - Today's scheduled workout, rest day state, stats card (total workouts, weekly, streak), quick actions
- **Programs** - Recommended programs (filtered by goal/level), active program card, start/pause/switch
- **Exercises** - Full library browser with search, filters (difficulty/muscle/equipment), pagination
- **History** - Toggle between workout history list and analytics view (volume charts, stats cards)
- **Profile** - User info, training level/goal badges, settings, sign out

**Workout logging screen** (the core feature):
- Pre-workout readiness check (sleep, soreness, stress, energy) with scoring and recommendations
- Exercise tabs with swipe navigation
- Set-by-set logging: weight (+/- 5lb buttons), reps (+/- 1), RPE
- Rest timer overlay with +30s and skip
- Load progression recommendations fetched inline per exercise
- Decision badges and explanation modals
- Exercise actions: info, alternatives, skip, mark done
- Completion celebration with undo countdown
- Offline set queueing via MMKV

**Additional modal screens:**
- Exercise info (equipment, muscles, recent history, personal best)
- Exercise alternatives (match scores, swap in workout, save preference)
- Workout detail view (post-workout summary with set tables)
- Edit profile, settings

**Onboarding parity with web:** Mobile onboarding is now a 4-step flow matching web — training level, goal, equipment selection, baseline method (known maxes / calibration / conservative start).

---

### 5. CI/CD

**GitHub Actions pipeline (`.github/workflows/ci.yml`):**
1. Checkout + setup pnpm 10.28.0 + Node 20
2. Install dependencies (frozen lockfile)
3. Build all packages
4. Type check (tsc)
5. Lint (ESLint)
6. Run database migrations against PostgreSQL 16 service container
7. Run tests (Vitest)

**Additional workflows:**
- `db-migrate.yml` - Database migration deployment
- `deploy-api.yml` - Server deployment (scaffold)

**Docker:** `docker-compose.yml` for local dev (server, web, db), `docker-compose.test.yml` for test database, multi-stage Dockerfiles for both server and web.

---

### 6. Documentation

- **10 Architecture Decision Records (ADRs)** covering monorepo choice, separate schemas, Hono, Drizzle, PowerSync offline-first, Clerk, testing strategy, code quality, simple offline queue, and observability strategy
- **Package-level CLAUDE.md files** in each package/app with patterns and conventions
- **Root CLAUDE.md** with comprehensive SOLID principles, clean code guidelines, TypeScript standards, testing standards, and git conventions
- **USER-WORKOUT-RELATIONSHIP.md** - Full entity relationship documentation with data flow diagrams
- **structured-logging.md** - Logging patterns documentation

---

## Architecture Decisions Worth Knowing

1. **Dual PostgreSQL schemas** - `exercise_lib` is intentionally separate from `training` so the exercise library can be a standalone product. Cross-schema references use soft FKs (no database constraints).

2. **Immutable workout data** - When workouts are created, `plannedExercises` are *copied* from the program template. Template changes don't affect existing workouts. The decision engine can modify future workouts without touching the template.

3. **Two training paths** - Users can follow structured multi-week programs (Program -> TrainingBlock -> Workouts) OR use standalone workouts (Templates, Weekly Plans, Quick Workouts). Both paths feed the same decision engine.

4. **Decision audit trail** - Every engine decision records input, output, reasoning, and algorithm version. Decision outcomes track whether users followed/overridden/ignored + whether it was successful. This enables retrospective accuracy analysis and engine improvement.

5. **Nullable FKs for flexibility** - `workoutLogs` can link to program workouts, standalone workouts, or neither (ad-hoc/retrospective logging). `standaloneWorkouts` can optionally link to templates and weekly plans.

6. **Engine is pure** - All decision functions are deterministic pure functions. They take data in, return decisions out. No database calls, no side effects. This makes them testable, configurable, and version-tracked.

---

## Development Timeline (from git history)

The project was built in roughly this order:

1. **Foundation** - Monorepo setup, Exercise Substitution Flow MVP, Docker config
2. **Infrastructure** - CI/CD pipelines, deployment scaffolds, React version pinning, Dockerfile optimization
3. **Core Features** - CORS config, program creation/deletion, exercise detail pages, decision badges
4. **Mobile App** - Expo app with full workout logging, readiness checks, decision integration, exercise substitution
5. **Database Maturation** - Migrations (replacing schema push), Drizzle snapshots, test database setup
6. **Observability** - Structured logging with Pino, request tracing, enhanced route logging
7. **Workout Logging** - Retrospective logging, workout completion logic, mobile nav
8. **Testing** - Integration tests for workouts API, Clerk mock setup, CI database service
9. **UX Polish** - Dashboard with today's workout, exercise search with keyboard nav, Sonner toasts, analytics enhancements
10. **Engine Expansion** - Quick workout generation, readiness checks, rest timer hooks
11. **Documentation** - Package-level CLAUDE.md files, CI fixes for secrets and Turborepo

---

## Current State

**What works end-to-end:**
- User signs up via Clerk, goes through onboarding, picks a program
- Training blocks are created from programs, workouts are generated
- Users can log sets with weight/reps/RPE (both web and mobile)
- Decision engine analyzes performance and produces recommendations
- Users can view, follow, or override decisions with reason tracking
- Decision outcomes are recorded and auto-evaluated on workout completion (load progression + volume adjustment)
- Algorithm version (`ENGINE_VERSION = "1.0.0"`) is stamped on every decision for audit trail
- Analytics show trends, PRs, volume, RPE patterns
- Exercise library is browsable with substitution suggestions
- Standalone/quick workouts work independently from programs
- Mobile app has full workout logging with readiness checks, rest timers, decision badges, and exercise substitution
- Mobile onboarding has reached parity with web (training level, goal, equipment, baseline method)

**What's wired but incomplete:**
- **Calibration workout path** - Web onboarding shows calibration plan and manual baseline entry works, but the "run calibration workouts and extract baselines" flow is missing. `processCalibrationResults()` exists in the engine but is never called from any endpoint.
- **Decision feedback loop** - Outcomes are tracked and accuracy stats are calculated, but `getProgressionModifier()` (adjusting algorithm aggressiveness based on historical accuracy) exists in the engine but isn't called by decision routes. Decisions don't yet self-tune.
- **Non-load/volume decision evaluation** - Only `load_progression` and `volume_adjustment` auto-evaluate on workout completion. Other decision types (rotation, deload, recovery, missed session) can only be manually evaluated via `PATCH /decisions/:id/outcome`.

**What needs building:**
- Calibration workout completion flow (endpoint to process calibration results into baselines) — **elevated priority**: mobile onboarding now lets users pick "calibration" as a baseline method, but the backend endpoint to turn completed calibration workouts into baselines doesn't exist, so the path dead-ends
- Feedback-driven algorithm adjustment (wire `getProgressionModifier()` into decision routes)
- Auto-evaluation for remaining decision types
- Offline sync (PowerSync/MMKV queue documented in ADRs, mobile has basic MMKV set queueing but full sync not implemented)
- Production deployment infrastructure beyond scaffolds

---

## Key File Locations

| What | Where |
|------|-------|
| Database schema | `packages/db/src/schema/` |
| Engine logic | `packages/engine/src/` |
| API routes | `apps/server/src/routes/` |
| Server middleware | `apps/server/src/middleware/` |
| Web pages | `apps/web/src/app/(app)/` |
| Web components | `apps/web/src/components/` |
| Mobile screens | `apps/mobile/app/` |
| Mobile API client | `apps/mobile/lib/api.ts` |
| Type definitions | `packages/types/src/` |
| Validation schemas | `packages/validation/src/` |
| Migrations | `packages/db/drizzle/` |
| Seed data | `packages/db/src/seed/` |
| CI config | `.github/workflows/ci.yml` |
| Docker setup | `docker-compose.yml` |
| ADRs | `docs/adr/` |
