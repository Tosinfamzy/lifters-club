# Lifters Club - Project Status

> Last updated: January 2025

## Overview

**Lifters Club** is a training decision engine that transforms workout history into intelligent, justified training decisions. The system consists of a backend API, web dashboard, and mobile app.

---

## Architecture

```
lifters-club/
├── packages/
│   ├── types/        ✅ Domain types (Exercise, Workout, Decision, etc.)
│   ├── validation/   ✅ Zod schemas for all inputs
│   ├── db/           ✅ Drizzle ORM + PostgreSQL schema + seed data
│   └── engine/       ✅ Pure decision functions (7 algorithms)
├── apps/
│   ├── server/       ✅ Hono REST API (25+ endpoints)
│   ├── web/          ⚠️ Next.js 15 (scaffolded only)
│   └── mobile/       ⚠️ Expo 54 (scaffolded only)
```

---

## What's Complete ✅

### 1. Type System (`@gymapp/types`)
- Exercise taxonomy: 12 movement patterns, 9 equipment types, 12 muscle groups
- Training entities: Program, TrainingBlock, Workout, WorkoutLog, LoggedSet
- Decision types: 7 decision outputs with action + reason

### 2. Validation (`@gymapp/validation`)
- Zod schemas for all API inputs
- Runtime validation with type inference
- Enum schemas for all taxonomies

### 3. Database (`@gymapp/db`)
- **Schema**: 2 PostgreSQL schemas
  - `exercise_lib`: exercises table (standalone library)
  - `training`: users, programs, training_blocks, workouts, workout_logs, logged_sets, decisions
- **Seed data**: 100+ exercises, multiple training programs
- **ORM**: Drizzle with full type safety

### 4. Decision Engine (`@gymapp/engine`)
Pure functions with no side effects:

| Function | Purpose | Status |
|----------|---------|--------|
| `calculateLoadProgression` | Adjust weight up/down/maintain | ✅ Tested |
| `calculateVolumeAdjustment` | Add/reduce/maintain sets | ✅ Tested |
| `calculateExerciseRotation` | Swap or keep exercise | ✅ Tested |
| `calculateDeloadNeed` | Recommend recovery week | ✅ Tested |
| `calculateSessionRecovery` | Adjust based on readiness | ✅ Tested |
| `calculateMissedSessionHandling` | Handle skipped workouts | ✅ Tested |
| `generateWeeklyPlan` | Aggregate weekly decisions | ✅ Tested |
| `findSubstitutes` | Find similar exercises | ✅ Tested |

**Test coverage**: 60 tests passing across 7 test files

### 5. API Server (`@gymapp/server`)
Hono REST API with full CRUD:

| Route Group | Endpoints | Status |
|-------------|-----------|--------|
| `/api/exercises` | GET, POST, PATCH, DELETE, /substitutes | ✅ |
| `/api/users` | GET /me, POST, readiness check | ✅ |
| `/api/programs` | GET, POST, PATCH | ✅ |
| `/api/workouts` | training-blocks + workouts CRUD | ✅ |
| `/api/workouts/today` | Mobile convenience endpoint | ✅ |
| `/api/workouts/recent` | Mobile convenience endpoint | ✅ |
| `/api/logs` | Workout logs + logged sets | ✅ |
| `/api/decisions` | All 7 decision endpoints + history | ✅ |

**Features**:
- Zod validation on all inputs
- OpenAPI/Swagger docs at `/api/docs`
- Decision persistence to database
- JSONB array queries (PostgreSQL)

---

## What's Scaffolded ⚠️

### 6. Web App (`@gymapp/web`)
- Next.js 15 with App Router initialized
- Placeholder home page only
- **Missing**: Tailwind, shadcn/ui, Clerk auth, all pages

### 7. Mobile App (`@gymapp/mobile`)
- Expo 54 with Expo Router initialized
- Basic home screen only
- **Missing**: Navigation, screens, API client, offline sync

---

## What's Not Started ❌

- Clerk authentication middleware
- Rate limiting
- Real UI implementation (web & mobile)
- Analytics/reporting features

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + Yarn 4 |
| Backend | Hono (TypeScript) |
| Frontend | Next.js 15 (App Router) |
| Mobile | Expo 54 + React Native 0.81 |
| Database | PostgreSQL 16 + Drizzle ORM |
| Validation | Zod |
| Auth | Clerk (planned) |
| Styling | Tailwind + shadcn/ui (planned) |
| Offline Sync | MMKV + offline queue |
| Testing | Vitest |

---

## Development Commands

```bash
# Install dependencies
yarn install

# Push schema to database
yarn db:push

# Seed exercises and programs
yarn db:seed
yarn db:seed:programs

# Run all apps in dev mode
yarn dev

# Run specific app
yarn workspace @gymapp/server dev
yarn workspace @gymapp/web dev
yarn mobile  # Expo

# Run tests
yarn test

# Build all
yarn build
```

---

## Current Phase

### ✅ Phase 1-4: Backend Complete
- [x] Monorepo structure
- [x] Type system
- [x] Validation schemas
- [x] Database schema + seed
- [x] Decision engine (7 functions)
- [x] API routes (25+ endpoints)
- [x] Decision persistence
- [x] Mobile API endpoints

### 🚧 Phase 5: Frontend (In Progress)
- [x] Web app scaffolded
- [x] Mobile app scaffolded
- [ ] Add Tailwind + shadcn/ui to web
- [ ] Add Clerk auth
- [ ] Build dashboard page
- [ ] Build program management
- [ ] Build workout history

### 📋 Phase 6: Mobile (Upcoming)
- [x] Build core screens
- [x] Add API client
- [x] Add offline sync (MMKV + queue)

---

## Next Steps

1. **Web App Setup**
   - Add Tailwind CSS
   - Add shadcn/ui components
   - Add Clerk authentication
   - Create layout with sidebar

2. **Core Web Pages**
   - Dashboard (current block, today's workout)
   - Programs (list, create, edit)
   - History (workout logs)

3. **Mobile Expansion**
   - Today's workout screen
   - Workout logging UI
   - History view
