# Lifters Club - Architecture Document

> **Version:** 1.0
> **Last Updated:** January 2025
> **Status:** Pre-implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Decisions](#architecture-decisions)
3. [System Overview](#system-overview)
4. [Data Flow](#data-flow)
5. [Offline-First Strategy](#offline-first-strategy)
6. [Package Structure](#package-structure)
7. [Database Design](#database-design)
8. [API Design](#api-design)
9. [Security Considerations](#security-considerations)
10. [Implementation Phases](#implementation-phases)
11. [Learning Resources](#learning-resources)

---

## Executive Summary

Lifters Club is a **training decision engine** — not just a workout tracker. It transforms workout history into intelligent, justified training decisions for the following week.

### Core Value Proposition

The app makes exactly **7 types of decisions**:
1. Load progression (increase/maintain/decrease weight)
2. Volume adjustment (add/maintain/reduce sets)
3. Exercise rotation (keep or swap exercises)
4. Deload recommendation (suggest recovery weeks)
5. Session recovery adjustment (lighten workout if recovery is poor)
6. Missed session handling (resume/repeat/regress)
7. Weekly plan update (roll all decisions into next week's plan)

### Two Systems, One Monorepo

| System | Purpose | Standalone? |
|--------|---------|-------------|
| **Exercise Library API** | Canonical movement database with substitution logic | Yes — reusable product |
| **Training App** | Decision engine, programs, progression, user management | No — consumes Exercise Library |

---

## Architecture Decisions

All architecture decisions are documented as ADRs in the [docs/adr/](./docs/adr/) folder.

| ID | Title | Status |
|----|-------|--------|
| [ADR-0001](./docs/adr/0001-monorepo-turborepo-pnpm.md) | Monorepo with Turborepo + pnpm | Accepted |
| [ADR-0002](./docs/adr/0002-separate-postgres-schemas.md) | Separate PostgreSQL Schemas | Accepted |
| [ADR-0003](./docs/adr/0003-hono-backend.md) | Hono for Backend API | Accepted |
| [ADR-0004](./docs/adr/0004-drizzle-orm.md) | Drizzle ORM | Accepted |
| [ADR-0005](./docs/adr/0005-powersync-offline-first.md) | PowerSync for Offline-First Sync | Superseded |
| [ADR-0009](./docs/adr/0009-simple-offline-queue.md) | Simple Offline Queue with MMKV | Accepted |
| [ADR-0006](./docs/adr/0006-clerk-authentication.md) | Clerk for Authentication | Accepted |
| [ADR-0007](./docs/adr/0007-testing-strategy.md) | Testing Strategy | Accepted |
| [ADR-0008](./docs/adr/0008-code-quality-principles.md) | Code Quality Principles | Accepted |

### Key Decisions Summary

- **Monorepo:** Turborepo + pnpm for coordinated changes and caching
- **Database:** PostgreSQL with separate schemas (`exercise_lib`, `training`)
- **Backend:** Hono - ultrafast, lightweight, TypeScript-first
- **ORM:** Drizzle - SQL-like syntax, no binary, fast startup
- **Offline-First:** MMKV + offline queue - simple caching and mutation queue (see ADR-0009)
- **Auth:** Clerk - production-ready with good offline session caching
- **Testing:** Vitest with testing pyramid (heavy unit tests on engine)
- **Code Quality:** SOLID principles, pragmatic DRY, simplicity over cleverness

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  React Native + Expo (Mobile App)                                     │  │
│  │  - NativeWind for styling                                             │  │
│  │  - Clerk for auth UI                                                  │  │
│  │  - useWorkoutOffline hook for data                                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Offline Support Layer                                                │  │
│  │  - MMKV for fast key-value storage                                    │  │
│  │  - Offline mutation queue                                             │  │
│  │  - NetInfo for network detection                                      │  │
│  │  - Auto-sync when online                                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ (REST API calls)
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Hono Backend                                                         │  │
│  │                                                                       │  │
│  │  Routes:                                                              │  │
│  │  - /api/exercises/*          - /api/users/*                           │  │
│  │  - /api/programs/*           - /api/workouts/*                        │  │
│  │  - /api/workout-logs/*       - /api/decisions/*                       │  │
│  │                                                                       │  │
│  │  Middleware:                                                          │  │
│  │  - Clerk auth verification                                            │  │
│  │  - Zod request validation                                             │  │
│  │  - Error handling                                                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Decision Engine (Pure Functions)                                     │  │
│  │  - calculateLoadProgression()    - calculateVolumeAdjustment()        │  │
│  │  - calculateExerciseRotation()   - calculateDeloadNeed()              │  │
│  │  - adjustForRecovery()           - generateWeeklyPlan()               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL 16                                                        │  │
│  │                                                                       │  │
│  │  ┌─────────────────────────┐    ┌─────────────────────────────────┐   │  │
│  │  │  exercise_lib schema    │    │  training schema                │   │  │
│  │  │                         │    │                                 │   │  │
│  │  │  - exercises            │    │  - users                        │   │  │
│  │  │                         │    │  - programs                     │   │  │
│  │  │                         │    │  - training_blocks              │   │  │
│  │  │                         │    │  - workouts                     │   │  │
│  │  │                         │    │  - workout_logs                 │   │  │
│  │  │                         │    │  - logged_sets                  │   │  │
│  │  │                         │    │  - decisions                    │   │  │
│  │  └─────────────────────────┘    └─────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Scenario 1: User Logs a Set (Online)

```
User taps "Log Set"
        │
        ▼
┌─────────────────────┐
│ Optimistic update   │
│ in React state      │
│ (instant feedback)  │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ POST to API         │
│ /api/workout-logs/  │
│ :id/sets            │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Hono validates      │
│ & writes to PG      │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Update MMKV cache   │
│ with server response│
└─────────────────────┘
```

### Scenario 2: User Logs Sets (Offline)

```
User taps "Log Set" (no connectivity)
        │
        ▼
┌─────────────────────┐
│ Optimistic update   │
│ in React state      │
│ (instant feedback)  │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Add to MMKV         │
│ offline queue       │
│ (persisted locally) │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ User continues      │
│ workout normally    │
│ (all local)         │
└─────────────────────┘
        │
        ▼ (later, when online)
┌─────────────────────┐
│ NetInfo detects     │
│ connectivity        │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ OfflineProvider     │
│ processes queue     │
│ in order            │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Server processes    │
│ each operation      │
└─────────────────────┘
```

### Scenario 3: Weekly Plan Generation

```
Sunday night (scheduled job or user request)
        │
        ▼
┌─────────────────────────────────────┐
│ Fetch last week's workout logs     │
│ for user                            │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ For each exercise in program:       │
│                                     │
│ 1. calculateLoadProgression()       │
│    → increase/maintain/decrease     │
│                                     │
│ 2. calculateVolumeAdjustment()      │
│    → add/maintain/reduce sets       │
│                                     │
│ 3. calculateExerciseRotation()      │
│    → keep or swap                   │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ calculateDeloadNeed()               │
│ → recommend deload if needed        │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ generateWeeklyPlan()                │
│ → combine all decisions             │
│ → create workout records            │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Store decisions with reasoning      │
│ (audit trail)                       │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ New workouts available via API      │
│ Fetched when user opens app         │
└─────────────────────────────────────┘
```

---

## Offline-First Strategy

> **Note:** Originally planned to use PowerSync (ADR-0005) but switched to a simpler approach (ADR-0009) due to self-hosting complexity and sync rule limitations.

### What Works Offline

| Feature | Offline Support | Notes |
|---------|-----------------|-------|
| View current workout | Yes | Cached in MMKV when opened |
| Log sets during workout | Yes | Queued in MMKV, syncs when online |
| Complete workout | Yes | Queued, syncs when online |
| View exercise instructions | Partial | Only if previously viewed |
| Create new account | No | Requires Clerk API |
| Generate new program | No | Requires decision engine on server |
| View history | No | Requires API call |

### Implementation

```
┌─────────────────────────────────────────┐
│  React Native App                       │
│  ┌───────────────────────────────────┐  │
│  │  useWorkoutOffline Hook           │  │
│  │  - Fetches & caches workout       │  │
│  │  - Queues mutations when offline  │  │
│  │  - Optimistic UI updates          │  │
│  └───────────────────────────────────┘  │
│                    │                    │
│  ┌───────────────────────────────────┐  │
│  │  MMKV Storage                     │  │
│  │  - Cached workout data            │  │
│  │  - Offline mutation queue         │  │
│  └───────────────────────────────────┘  │
│                    │                    │
│  ┌───────────────────────────────────┐  │
│  │  OfflineProvider                  │  │
│  │  - Network state monitoring       │  │
│  │  - Auto-sync when online          │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                     │
                     ▼ (when online)
         ┌─────────────────────┐
         │  Hono Backend API   │
         └─────────────────────┘
```

### Key Files

- `apps/mobile/lib/offline/storage.ts` - MMKV wrapper
- `apps/mobile/lib/offline/queue.ts` - Offline mutation queue
- `apps/mobile/providers/offline-provider.tsx` - Network state & auto-sync
- `apps/mobile/hooks/use-workout-offline.ts` - Main hook

### Conflict Resolution

For this domain, conflicts are rare because:
- Workouts are user-specific (no shared editing)
- Sets are append-only during a workout
- Decisions are generated server-side

**Strategy:** Queue-based with retry. Operations are processed in order when online.

---

## Package Structure

```
lifters-club/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/                  # App Router pages
│   │   │   │   ├── (auth)/           # Auth-required routes
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── workout/
│   │   │   │   │   └── history/
│   │   │   │   ├── (public)/         # Public routes
│   │   │   │   │   └── exercises/
│   │   │   │   └── api/              # API routes (if needed)
│   │   │   ├── components/
│   │   │   │   ├── ui/               # shadcn/ui components
│   │   │   │   ├── workout/          # Workout-specific components
│   │   │   │   └── exercises/        # Exercise-specific components
│   │   │   ├── lib/
│   │   │   │   ├── offline/          # Offline storage & queue
│   │   │   │   └── api-client.ts     # API client
│   │   │   └── hooks/                # Custom React hooks
│   │   └── package.json
│   │
│   └── server/                       # Hono backend
│       ├── src/
│       │   ├── index.ts              # Entry point
│       │   ├── routes/
│       │   │   ├── exercises.ts      # Exercise Library API
│       │   │   ├── users.ts
│       │   │   ├── programs.ts
│       │   │   ├── workouts.ts
│       │   │   └── workout-logs.ts    # Workout log endpoints
│       │   ├── middleware/
│       │   │   ├── auth.ts           # Clerk verification
│       │   │   └── validation.ts     # Zod middleware
│       │   └── services/
│       │       ├── exercise-library/
│       │       │   └── substitution.ts
│       │       └── training-engine/
│       │           └── weekly-plan.ts
│       └── package.json
│
├── packages/
│   ├── types/                        # @gymapp/types
│   │   └── src/
│   │       ├── index.ts
│   │       ├── exercise.ts           # Exercise domain types
│   │       ├── training.ts           # Training domain types
│   │       └── user.ts               # User types
│   │
│   ├── db/                           # @gymapp/db
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── client.ts             # Drizzle client
│   │   │   └── schema/
│   │   │       ├── index.ts
│   │   │       ├── exercise-lib.ts   # exercise_lib schema
│   │   │       └── training.ts       # training schema
│   │   ├── drizzle.config.ts
│   │   └── migrations/
│   │
│   ├── engine/                       # @gymapp/engine
│   │   └── src/
│   │       ├── index.ts
│   │       ├── progression.ts        # Load progression logic
│   │       ├── volume.ts             # Volume adjustment logic
│   │       ├── rotation.ts           # Exercise rotation logic
│   │       ├── deload.ts             # Deload detection
│   │       ├── recovery.ts           # Session recovery adjustment
│   │       ├── missed-session.ts     # Missed session handling
│   │       └── planning.ts           # Weekly plan generation
│   │
│   └── validation/                   # @gymapp/validation
│       └── src/
│           ├── index.ts
│           ├── exercise.ts           # Exercise Zod schemas
│           └── training.ts           # Training Zod schemas
│
├── scripts/
│   └── seed/
│       ├── exercises.ts              # Exercise seed data
│       └── run.ts                    # Seed runner
│
├── docker-compose.yml                # Local dev environment
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Database Design

### Schema: exercise_lib

```sql
-- Canonical exercise database
CREATE SCHEMA exercise_lib;

CREATE TABLE exercise_lib.exercises (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  aliases JSONB DEFAULT '[]',

  equipment JSONB NOT NULL,           -- ["barbell", "dumbbell"]
  movement_patterns JSONB NOT NULL,   -- ["squat", "lunge"]
  primary_muscles JSONB NOT NULL,     -- ["quads", "glutes"]
  secondary_muscles JSONB DEFAULT '[]',

  is_compound BOOLEAN NOT NULL,
  is_unilateral BOOLEAN NOT NULL DEFAULT false,
  difficulty VARCHAR(20) NOT NULL,    -- beginner/intermediate/advanced

  constraints JSONB DEFAULT '[]',     -- ["rack", "bench"]

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_exercises_movement ON exercise_lib.exercises USING GIN (movement_patterns);
CREATE INDEX idx_exercises_muscles ON exercise_lib.exercises USING GIN (primary_muscles);
CREATE INDEX idx_exercises_equipment ON exercise_lib.exercises USING GIN (equipment);
```

### Schema: training

```sql
CREATE SCHEMA training;

-- Users (synced from Clerk)
CREATE TABLE training.users (
  id VARCHAR(64) PRIMARY KEY,
  clerk_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,

  training_level VARCHAR(20) NOT NULL,  -- beginner/intermediate/advanced
  primary_goal VARCHAR(20) NOT NULL,    -- strength/hypertrophy/conditioning
  preferences JSONB NOT NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Program templates
CREATE TABLE training.programs (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  days_per_week INTEGER NOT NULL,
  goal VARCHAR(20) NOT NULL,
  level VARCHAR(20) NOT NULL,

  template JSONB NOT NULL,  -- SessionTemplate[]

  created_at TIMESTAMP DEFAULT NOW()
);

-- User's active program instance
CREATE TABLE training.training_blocks (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES training.users(id),
  program_id VARCHAR(64) NOT NULL REFERENCES training.programs(id),

  start_date DATE NOT NULL,
  end_date DATE,
  current_week INTEGER NOT NULL DEFAULT 1,

  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active/completed/paused

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Scheduled workouts
CREATE TABLE training.workouts (
  id VARCHAR(64) PRIMARY KEY,
  training_block_id VARCHAR(64) NOT NULL REFERENCES training.training_blocks(id),

  scheduled_date DATE NOT NULL,
  week_number INTEGER NOT NULL,
  day_number INTEGER NOT NULL,

  planned_exercises JSONB NOT NULL,  -- PlannedExercise[]
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/in_progress/completed/skipped

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Completed workout logs
CREATE TABLE training.workout_logs (
  id VARCHAR(64) PRIMARY KEY,
  workout_id VARCHAR(64) NOT NULL REFERENCES training.workouts(id),
  user_id VARCHAR(64) NOT NULL REFERENCES training.users(id),

  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,

  overall_rpe REAL,  -- 1-10
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Individual logged sets
CREATE TABLE training.logged_sets (
  id VARCHAR(64) PRIMARY KEY,
  workout_log_id VARCHAR(64) NOT NULL REFERENCES training.workout_logs(id),
  exercise_id VARCHAR(64) NOT NULL,

  set_number INTEGER NOT NULL,
  weight REAL NOT NULL,
  reps INTEGER NOT NULL,
  rpe REAL,  -- 1-10

  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Decision audit trail
CREATE TABLE training.decisions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES training.users(id),
  workout_id VARCHAR(64) REFERENCES training.workouts(id),

  type VARCHAR(50) NOT NULL,  -- load_progression/volume_adjustment/etc
  input JSONB NOT NULL,       -- What data was used
  output JSONB NOT NULL,      -- What was decided
  reasoning TEXT NOT NULL,    -- Human-readable explanation

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_training_blocks_user ON training.training_blocks(user_id);
CREATE INDEX idx_workouts_block ON training.workouts(training_block_id);
CREATE INDEX idx_workouts_date ON training.workouts(scheduled_date);
CREATE INDEX idx_workout_logs_user ON training.workout_logs(user_id);
CREATE INDEX idx_logged_sets_log ON training.logged_sets(workout_log_id);
CREATE INDEX idx_decisions_user ON training.decisions(user_id);
```

---

## API Design

### Exercise Library API (Public)

```
GET    /api/exercises                    # List all exercises
GET    /api/exercises/:id                # Get single exercise
GET    /api/exercises/:id/substitutes    # Get substitution suggestions
GET    /api/exercises/search?q=          # Search exercises
```

### Training API (Authenticated)

```
# Users
POST   /api/users                        # Create user (from Clerk webhook)
GET    /api/users/me                     # Get current user
PATCH  /api/users/me                     # Update preferences

# Programs
GET    /api/programs                     # List available programs
GET    /api/programs/:id                 # Get program details
POST   /api/programs/:id/start           # Start a program (create training block)

# Workouts
GET    /api/workouts                     # List user's workouts
GET    /api/workouts/:id                 # Get workout details
POST   /api/workouts/:id/start           # Start a workout
POST   /api/workouts/:id/complete        # Complete a workout

# Logging
POST   /api/workouts/:id/sets            # Log a set
PATCH  /api/sets/:id                     # Update a logged set
DELETE /api/sets/:id                     # Delete a logged set

# Decisions
GET    /api/decisions                    # View decision history
POST   /api/decisions/generate-week      # Trigger weekly plan generation
```

---

## Security Considerations

### Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│    Clerk    │────▶│   Backend   │
│             │     │             │     │             │
│ 1. Login    │     │ 2. Verify   │     │ 3. Validate │
│    via      │     │    & issue  │     │    Clerk    │
│    Clerk UI │     │    JWT      │     │    JWT      │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Authorization Rules

| Resource | Rule |
|----------|------|
| Exercises | Public read, admin write |
| Users | Own data only |
| Workouts | Own data only |
| Programs | Public read, admin create |
| Decisions | Own data only |

### Data Validation

- All inputs validated with Zod schemas
- Database constraints as final safety net
- API endpoints validate all requests

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** Zero to running monorepo with database

- [ ] Initialize Turborepo + pnpm workspace
- [ ] Create `@gymapp/types` package
- [ ] Create `@gymapp/validation` package
- [ ] Create `@gymapp/db` package with Drizzle schemas
- [ ] Docker Compose with PostgreSQL
- [ ] Basic Hono server (health check only)
- [ ] Vitest setup for all packages
- [ ] CI/CD pipeline (GitHub Actions)

**Milestone:** `docker compose up` starts Postgres, server responds to `/health`

---

### Phase 2: Exercise Library (Week 3-4)

**Goal:** Standalone Exercise Library API

- [ ] Exercise CRUD endpoints
- [ ] Substitution algorithm
- [ ] Exercise search with filters
- [ ] Seed script with 50+ real exercises
- [ ] Integration tests for API
- [ ] API documentation

**Milestone:** Can query exercises, get substitution suggestions

---

### Phase 3: Training Core (Week 5-6)

**Goal:** User management, programs, workouts

- [ ] Clerk integration (auth middleware)
- [ ] User CRUD endpoints
- [ ] Program endpoints
- [ ] Training block management
- [ ] Workout CRUD
- [ ] Integration tests

**Milestone:** User can start a program, see scheduled workouts

---

### Phase 4: Decision Engine (Week 7-8)

**Goal:** Core intelligence working

- [ ] Load progression algorithm
- [ ] Volume adjustment algorithm
- [ ] Deload detection algorithm
- [ ] Weekly plan generation
- [ ] Decision storage with reasoning
- [ ] Heavy unit test coverage (90%+)

**Milestone:** Engine generates sensible next-week plans from workout data

---

### Phase 5: Offline-First Mobile App (Week 9-10)

**Goal:** Working mobile app with offline support

- [x] React Native + Expo setup
- [x] MMKV storage for offline caching
- [x] Offline mutation queue
- [x] Network state detection with NetInfo
- [x] Auto-sync when online
- [ ] Core screens: Dashboard, Workout, History
- [x] Tailwind (NativeWind) + custom components
- [x] Clerk mobile integration

**Milestone:** Log workout at gym with no connectivity, syncs when online

---

### Phase 6: Remaining Decisions + Polish (Week 11-12)

**Goal:** Feature complete MVP

- [ ] Exercise rotation logic
- [ ] Session recovery adjustment
- [ ] Missed session handling
- [ ] UI polish and error handling
- [ ] E2E tests for critical flows
- [ ] Performance optimization
- [ ] Documentation

**Milestone:** Full MVP ready for beta users

---

## Learning Resources

### Hono (Backend Framework)

| Resource | Type | Link |
|----------|------|------|
| Official Getting Started | Docs | [hono.dev/docs/getting-started/basic](https://hono.dev/docs/getting-started/basic) |
| Node.js Specific Guide | Docs | [hono.dev/docs/getting-started/nodejs](https://hono.dev/docs/getting-started/nodejs) |
| Hono + Drizzle Tutorial | Article | [dev.to - Quick REST API with Hono and Drizzle](https://dev.to/aaronksaunders/getting-started-with-hono-js-and-drizzle-orm-2g6i) |
| Production Apps with Hono | Article | [freeCodeCamp - Build Production-Ready Web Apps](https://www.freecodecamp.org/news/build-production-ready-web-apps-with-hono/) |
| Beginner's Guide | Article | [apidog.com/blog/hono-js](https://apidog.com/blog/hono-js/) |
| GitHub Repository | Code | [github.com/honojs/hono](https://github.com/honojs/hono) |

**Key Concepts to Learn:**
- Routing and route groups
- Middleware (built-in: cors, logger, jwt)
- Context object (`c.req`, `c.json()`, `c.param()`)
- Zod validator middleware (`@hono/zod-validator`)
- Error handling

---

### Drizzle ORM

| Resource | Type | Link |
|----------|------|------|
| Official PostgreSQL Guide | Docs | [orm.drizzle.team/docs/get-started-postgresql](https://orm.drizzle.team/docs/get-started-postgresql) |
| 2025 Best Practices | Guide | [GitHub Gist - PostgreSQL Best Practices](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717) |
| Ultimate Guide (2025) | Article | [dev.to - Ultimate Guide to Drizzle ORM](https://dev.to/sameer_saleem/the-ultimate-guide-to-drizzle-orm-postgresql-2025-edition-22b) |
| Drizzle Guides | Docs | [orm.drizzle.team/docs/guides](https://orm.drizzle.team/docs/guides) |

**Key Concepts to Learn:**
- Schema definition syntax
- Migrations workflow (generate → apply)
- Query builder vs SQL-like syntax
- Relations and joins
- Drizzle Kit CLI (`drizzle-kit generate`, `drizzle-kit migrate`)
- Drizzle Studio for debugging

---

### Offline Support (MMKV + Queue)

| Resource | Type | Link |
|----------|------|------|
| MMKV Documentation | Docs | [github.com/mrousavy/react-native-mmkv](https://github.com/mrousavy/react-native-mmkv) |
| React Query | Docs | [tanstack.com/query](https://tanstack.com/query) |
| NetInfo | Docs | [github.com/react-native-netinfo/react-native-netinfo](https://github.com/react-native-netinfo/react-native-netinfo) |

**Key Concepts:**
- MMKV key-value storage (faster than AsyncStorage)
- Mutation queue pattern for offline operations
- Network state detection
- Optimistic UI updates

---

### Turborepo + pnpm

| Resource | Type | Link |
|----------|------|------|
| Official Turborepo Docs | Docs | [turborepo.dev/docs](https://turborepo.dev/docs) |
| Scalable Monorepo Setup | Article | [dev.to - Setting Up a Scalable Monorepo](https://dev.to/hexshift/setting-up-a-scalable-monorepo-with-turborepo-and-pnpm-4doh) |
| 2025 Monorepo Guide | Article | [Medium - Monorepo That Actually Scales](https://medium.com/@TheblogStacker/2025-monorepo-that-actually-scales-turborepo-pnpm-for-next-js-ab4492fbde2a) |
| Nhost Configuration | Case Study | [nhost.io/blog/how-we-configured-pnpm-and-turborepo](https://nhost.io/blog/how-we-configured-pnpm-and-turborepo-for-our-monorepo) |
| pnpm Workspaces | Docs | [pnpm.io/workspaces](https://pnpm.io/workspaces) |

**Key Concepts to Learn:**
- Workspace configuration (`pnpm-workspace.yaml`)
- `turbo.json` pipeline configuration
- Task dependencies (`dependsOn`)
- Caching and cache invalidation
- Running tasks across packages

---

### Next.js 14+ (App Router)

| Resource | Type | Link |
|----------|------|------|
| Official Documentation | Docs | [nextjs.org/docs](https://nextjs.org/docs) |
| App Router Guide | Docs | [nextjs.org/docs/app](https://nextjs.org/docs/app) |
| Learn Next.js | Tutorial | [nextjs.org/learn](https://nextjs.org/learn) |

**Key Concepts to Learn:**
- App Router vs Pages Router
- Server Components vs Client Components
- Route groups `(folder)`
- Loading and error states
- Server Actions (if needed)

---

### Clerk (Authentication)

| Resource | Type | Link |
|----------|------|------|
| Official Documentation | Docs | [clerk.com/docs](https://clerk.com/docs) |
| Next.js Integration | Guide | [clerk.com/docs/quickstarts/nextjs](https://clerk.com/docs/quickstarts/nextjs) |
| Backend Verification | Guide | [clerk.com/docs/backend-requests](https://clerk.com/docs/backend-requests/overview) |

**Key Concepts to Learn:**
- `ClerkProvider` setup
- `useUser()` and `useAuth()` hooks
- Backend JWT verification
- Webhooks for user sync

---

### Tailwind + shadcn/ui

| Resource | Type | Link |
|----------|------|------|
| Tailwind Documentation | Docs | [tailwindcss.com/docs](https://tailwindcss.com/docs) |
| shadcn/ui Documentation | Docs | [ui.shadcn.com](https://ui.shadcn.com) |
| shadcn/ui Components | Reference | [ui.shadcn.com/docs/components](https://ui.shadcn.com/docs/components) |

**Key Concepts to Learn:**
- Utility-first CSS approach
- shadcn/ui installation (`npx shadcn-ui@latest init`)
- Component customization
- Dark mode setup

---

### Zod (Validation)

| Resource | Type | Link |
|----------|------|------|
| Official Documentation | Docs | [zod.dev](https://zod.dev) |
| GitHub Repository | Code | [github.com/colinhacks/zod](https://github.com/colinhacks/zod) |

**Key Concepts to Learn:**
- Schema definition
- Type inference (`z.infer<typeof schema>`)
- Refinements and transforms
- Error handling

---

### Vitest (Testing)

| Resource | Type | Link |
|----------|------|------|
| Official Documentation | Docs | [vitest.dev](https://vitest.dev) |
| Getting Started | Guide | [vitest.dev/guide](https://vitest.dev/guide/) |

**Key Concepts to Learn:**
- Test syntax (Jest-compatible)
- Mocking
- Coverage reports
- Workspace configuration for monorepo

---

## Suggested Learning Path

**Week 1: Fundamentals**
1. Turborepo + pnpm basics (2-3 hours)
2. Drizzle ORM with PostgreSQL (3-4 hours)
3. Hono basics (2-3 hours)

**Week 2: Integration**
1. Hono + Drizzle together (follow the dev.to tutorial)
2. Zod validation patterns (1-2 hours)
3. Vitest setup and basic tests (2 hours)

**Week 3: Frontend & Auth**
1. Next.js App Router (if not familiar) (3-4 hours)
2. Clerk integration (2 hours)
3. shadcn/ui components (2 hours)

**Week 4: Offline-First**
1. MMKV storage concepts (1 hour)
2. Offline queue pattern (2 hours)
3. React Query for data fetching (2 hours)

---

## Appendix: Quick Reference Commands

```bash
# Start local development
docker compose up -d          # Start Postgres + services
pnpm dev                      # Start all apps in dev mode

# Database
pnpm db:generate              # Generate migration from schema changes
pnpm db:migrate               # Apply migrations
pnpm db:push                  # Push schema directly (dev only)
pnpm db:seed                  # Seed database

# Testing
pnpm test                     # Run all tests
pnpm test --filter=engine     # Run engine package tests only

# Building
pnpm build                    # Build all packages
pnpm typecheck                # Type check all packages
pnpm lint                     # Lint all packages
```

---

*Document maintained by the development team. Last reviewed: January 2025*
