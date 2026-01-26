# Gym App Project Brief

## Overview

Build a gym training application that makes better training decisions over time. This is NOT a workout tracker — it's a **training decision engine** that turns messy workout history into clear, justified next-week decisions.

Two systems in one monorepo:
1. **Exercise Library API** — standalone product, canonical movement database with substitution logic
2. **Training App** — decision engine, program generation, progression logic, user management

---

## Tech Stack

| Concern | Choice |
|---------|--------|
| Monorepo | Turborepo + pnpm |
| Backend | Hono (TypeScript) |
| Frontend | Next.js 14+ (App Router) |
| Database | PostgreSQL 16 (Neon for hosted, Docker for local) |
| ORM | Drizzle |
| Validation | Zod |
| Auth | Clerk |
| Styling | Tailwind + shadcn/ui |
| API | REST (not tRPC) |
| Containerization | Docker + Docker Compose |

---

## Monorepo Structure

```
gymapp/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── Makefile
├── README.md
│
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── app/
│   │       ├── components/
│   │       └── lib/
│   │
│   └── server/                 # Hono backend
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── routes/
│           │   ├── exercises.ts
│           │   ├── users.ts
│           │   ├── programs.ts
│           │   └── workouts.ts
│           ├── middleware/
│           │   ├── auth.ts
│           │   └── validation.ts
│           └── services/
│               ├── exercise-library/
│               └── training-engine/
│
├── packages/
│   ├── types/                  # Shared TypeScript types
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── exercise.ts
│   │       ├── training.ts
│   │       └── user.ts
│   │
│   ├── db/                     # Drizzle schema + migrations
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── client.ts
│   │       ├── schema/
│   │       │   ├── index.ts
│   │       │   ├── exercise-lib.ts
│   │       │   └── training.ts
│   │       └── migrations/
│   │
│   ├── engine/                 # Decision logic (pure functions)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── progression.ts
│   │       ├── volume.ts
│   │       ├── rotation.ts
│   │       ├── deload.ts
│   │       └── planning.ts
│   │
│   └── validation/             # Shared Zod schemas
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── exercise.ts
│           └── training.ts
│
├── scripts/
│   └── seed/
│       ├── exercises.ts
│       └── run.ts
│
└── .github/
    └── workflows/
        └── ci.yml
```

---

## Domain Types

### packages/types/src/exercise.ts

```typescript
// Movement Pattern Taxonomy (12 patterns)
export type MovementPattern =
  | "squat"           // knee-dominant lower
  | "hinge"           // hip-dominant lower
  | "lunge"           // single-leg, split stance
  | "push_horizontal" // bench, push-up
  | "push_vertical"   // overhead press
  | "pull_horizontal" // rows
  | "pull_vertical"   // pull-ups, lat pulldown
  | "carry"           // loaded locomotion
  | "core_anti"       // anti-extension, anti-rotation, anti-lateral
  | "isolation_upper" // curls, tricep work, lateral raises
  | "isolation_lower" // leg curl, leg extension, calf raise
  | "conditioning";   // sled, bike, ski erg, burpees

// Equipment Taxonomy (9 types)
export type EquipmentType =
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "cable"
  | "machine"
  | "bodyweight"
  | "band"
  | "specialty"    // trap bar, landmine, GHD, etc.
  | "cardio";      // bike, rower, ski erg, sled

// Muscle Group Taxonomy (12 groups)
export type MuscleGroup =
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "chest"
  | "lats"
  | "upper_back"    // traps, rhomboids, rear delts
  | "shoulders"     // primarily anterior/lateral delts
  | "biceps"
  | "triceps"
  | "forearms"
  | "core";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type Constraint =
  | "rack"
  | "bench"
  | "cables"
  | "pull_up_bar"
  | "dip_station";

export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  
  equipment: EquipmentType[];
  movementPatterns: MovementPattern[];
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  
  isCompound: boolean;
  isUnilateral: boolean;
  difficulty: Difficulty;
  
  constraints?: Constraint[];
}

// For substitution queries
export interface SubstitutionQuery {
  exerciseId: string;
  excludeEquipment?: EquipmentType[];
  excludeConstraints?: Constraint[];
  preferredDifficulty?: Difficulty;
}

export interface SubstitutionResult {
  exercise: Exercise;
  matchScore: number;
  reason: string;
}
```

### packages/types/src/training.ts

```typescript
import type { Exercise, MuscleGroup, MovementPattern } from "./exercise";

// User & Preferences
export type TrainingLevel = "beginner" | "intermediate" | "advanced";
export type PrimaryGoal = "strength" | "hypertrophy" | "conditioning";

export interface UserPreferences {
  focusAreas?: MuscleGroup[];
  avoidExercises?: string[];
  equipmentAvailable: string[];
  daysPerWeek: number;
  sessionDurationMinutes: number;
}

export interface User {
  id: string;
  clerkId: string;
  email: string;
  
  trainingLevel: TrainingLevel;
  primaryGoal: PrimaryGoal;
  preferences: UserPreferences;
  
  createdAt: Date;
  updatedAt: Date;
}

// Program Structure
export interface Program {
  id: string;
  name: string;
  description: string;
  
  daysPerWeek: number;
  goal: PrimaryGoal;
  level: TrainingLevel;
  
  template: ProgramTemplate;
}

export interface ProgramTemplate {
  weeks: number;
  sessions: SessionTemplate[];
}

export interface SessionTemplate {
  dayNumber: number;
  name: string;
  focus: MuscleGroup[];
  exercises: PlannedExercise[];
}

export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repRange: [number, number];
  restSeconds: number;
  notes?: string;
}

// Training Block (time-bounded program instance)
export interface TrainingBlock {
  id: string;
  userId: string;
  programId: string;
  
  startDate: Date;
  endDate?: Date;
  currentWeek: number;
  
  status: "active" | "completed" | "paused";
}

// Workout (planned session)
export interface Workout {
  id: string;
  trainingBlockId: string;
  
  scheduledDate: Date;
  weekNumber: number;
  dayNumber: number;
  
  plannedExercises: PlannedExercise[];
  status: "pending" | "in_progress" | "completed" | "skipped";
}

// Logging
export interface LoggedSet {
  id: string;
  workoutLogId: string;
  exerciseId: string;
  
  setNumber: number;
  weight: number;
  reps: number;
  rpe?: number;  // 1-10 rating of perceived exertion
  
  notes?: string;
}

export interface WorkoutLog {
  id: string;
  workoutId: string;
  userId: string;
  
  startedAt: Date;
  completedAt?: Date;
  
  sets: LoggedSet[];
  
  overallRpe?: number;
  notes?: string;
}

// Decision Engine Types
export type DecisionType =
  | "load_progression"
  | "volume_adjustment"
  | "exercise_rotation"
  | "deload_recommendation"
  | "session_recovery"
  | "missed_session"
  | "weekly_plan_update";

export interface Decision {
  id: string;
  userId: string;
  workoutId?: string;
  
  type: DecisionType;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  reasoning: string;
  
  createdAt: Date;
}

// Progression Rule Outputs
export interface LoadDecision {
  action: "increase" | "maintain" | "decrease";
  newWeight: number;
  reason: string;
}

export interface VolumeDecision {
  action: "add_set" | "maintain" | "reduce_set";
  newSetCount: number;
  reason: string;
}

export interface RotationDecision {
  action: "keep" | "swap";
  newExerciseId?: string;
  reason: string;
}

export interface DeloadDecision {
  recommended: boolean;
  reason: string;
}
```

### packages/types/src/user.ts

```typescript
export interface CreateUserInput {
  clerkId: string;
  email: string;
  trainingLevel: "beginner" | "intermediate" | "advanced";
  primaryGoal: "strength" | "hypertrophy" | "conditioning";
  preferences: {
    focusAreas?: string[];
    equipmentAvailable: string[];
    daysPerWeek: number;
    sessionDurationMinutes: number;
  };
}

export interface UpdateUserInput {
  trainingLevel?: "beginner" | "intermediate" | "advanced";
  primaryGoal?: "strength" | "hypertrophy" | "conditioning";
  preferences?: {
    focusAreas?: string[];
    avoidExercises?: string[];
    equipmentAvailable?: string[];
    daysPerWeek?: number;
    sessionDurationMinutes?: number;
  };
}
```

### packages/types/src/index.ts

```typescript
export * from "./exercise";
export * from "./training";
export * from "./user";
```

---

## Database Schema

### packages/db/src/schema/exercise-lib.ts

```typescript
import { pgTable, pgSchema, varchar, text, boolean, jsonb } from "drizzle-orm/pg-core";

export const exerciseLib = pgSchema("exercise_lib");

export const exercises = exerciseLib.table("exercises", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  aliases: jsonb("aliases").$type<string[]>().default([]),
  
  equipment: jsonb("equipment").$type<string[]>().notNull(),
  movementPatterns: jsonb("movement_patterns").$type<string[]>().notNull(),
  primaryMuscles: jsonb("primary_muscles").$type<string[]>().notNull(),
  secondaryMuscles: jsonb("secondary_muscles").$type<string[]>().default([]),
  
  isCompound: boolean("is_compound").notNull(),
  isUnilateral: boolean("is_unilateral").notNull().default(false),
  difficulty: varchar("difficulty", { length: 20 }).notNull(),
  
  constraints: jsonb("constraints").$type<string[]>().default([]),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### packages/db/src/schema/training.ts

```typescript
import { pgTable, pgSchema, varchar, text, boolean, jsonb, integer, timestamp, date, real } from "drizzle-orm/pg-core";
import { exercises } from "./exercise-lib";

export const training = pgSchema("training");

export const users = training.table("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  
  trainingLevel: varchar("training_level", { length: 20 }).notNull(),
  primaryGoal: varchar("primary_goal", { length: 20 }).notNull(),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const programs = training.table("programs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  daysPerWeek: integer("days_per_week").notNull(),
  goal: varchar("goal", { length: 20 }).notNull(),
  level: varchar("level", { length: 20 }).notNull(),
  
  template: jsonb("template").$type<Record<string, unknown>>().notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const trainingBlocks = training.table("training_blocks", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  programId: varchar("program_id", { length: 64 }).notNull().references(() => programs.id),
  
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  currentWeek: integer("current_week").notNull().default(1),
  
  status: varchar("status", { length: 20 }).notNull().default("active"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workouts = training.table("workouts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  trainingBlockId: varchar("training_block_id", { length: 64 }).notNull().references(() => trainingBlocks.id),
  
  scheduledDate: date("scheduled_date").notNull(),
  weekNumber: integer("week_number").notNull(),
  dayNumber: integer("day_number").notNull(),
  
  plannedExercises: jsonb("planned_exercises").$type<Record<string, unknown>[]>().notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workoutLogs = training.table("workout_logs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workoutId: varchar("workout_id", { length: 64 }).notNull().references(() => workouts.id),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  
  overallRpe: real("overall_rpe"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const loggedSets = training.table("logged_sets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workoutLogId: varchar("workout_log_id", { length: 64 }).notNull().references(() => workoutLogs.id),
  exerciseId: varchar("exercise_id", { length: 64 }).notNull(),
  
  setNumber: integer("set_number").notNull(),
  weight: real("weight").notNull(),
  reps: integer("reps").notNull(),
  rpe: real("rpe"),
  
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const decisions = training.table("decisions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  workoutId: varchar("workout_id", { length: 64 }).references(() => workouts.id),
  
  type: varchar("type", { length: 50 }).notNull(),
  input: jsonb("input").$type<Record<string, unknown>>().notNull(),
  output: jsonb("output").$type<Record<string, unknown>>().notNull(),
  reasoning: text("reasoning").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

---

## Docker Configuration

### docker-compose.yml

```yaml
services:
  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: ${DB_USER:-gymapp}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-gymapp}
      POSTGRES_DB: ${DB_NAME:-gymapp}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-gymapp}"]
      interval: 5s
      timeout: 5s
      retries: 5

  server:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
      target: dev
    ports:
      - "4000:4000"
    environment:
      DATABASE_URL: postgres://${DB_USER:-gymapp}:${DB_PASSWORD:-gymapp}@db:5432/${DB_NAME:-gymapp}
      CLERK_SECRET_KEY: ${CLERK_SECRET_KEY}
      NODE_ENV: development
    volumes:
      - ./apps/server:/app/apps/server
      - ./packages:/app/packages
      - /app/node_modules
    depends_on:
      db:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: dev
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      NODE_ENV: development
    volumes:
      - ./apps/web:/app/apps/web
      - ./packages:/app/packages
      - /app/node_modules
    depends_on:
      - server

volumes:
  pgdata:
```

### apps/server/Dockerfile

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Dependencies
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY packages/engine/package.json ./packages/engine/
COPY packages/validation/package.json ./packages/validation/
RUN pnpm install --frozen-lockfile

# Dev target - hot reload
FROM deps AS dev
COPY . .
WORKDIR /app/apps/server
CMD ["pnpm", "dev"]

# Build
FROM deps AS build
COPY . .
RUN pnpm --filter server build

# Production
FROM base AS prod
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

### apps/web/Dockerfile

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Dependencies
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/
RUN pnpm install --frozen-lockfile

# Dev target - hot reload
FROM deps AS dev
COPY . .
WORKDIR /app/apps/web
CMD ["pnpm", "dev"]

# Build
FROM deps AS build
COPY . .
RUN pnpm --filter web build

# Production
FROM base AS prod
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./.next/static
COPY --from=build /app/apps/web/public ./public
CMD ["node", "server.js"]
```

---

## Configuration Files

### package.json (root)

```json
{
  "name": "gymapp",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "db:generate": "pnpm --filter db generate",
    "db:migrate": "pnpm --filter db migrate",
    "db:push": "pnpm --filter db push",
    "db:seed": "pnpm --filter db seed"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

### .env.example

```bash
# Database
DB_USER=gymapp
DB_PASSWORD=gymapp
DB_NAME=gymapp
DATABASE_URL=postgres://gymapp:gymapp@localhost:5432/gymapp

# Auth (Clerk)
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

# API
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### .gitignore

```
# Dependencies
node_modules
.pnpm-store

# Build outputs
dist
.next
.turbo

# Environment
.env
.env.local
.env.*.local

# IDE
.idea
.vscode
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage
```

### Makefile

```makefile
.PHONY: up down restart logs db-shell migrate seed build clean

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

db-shell:
	docker compose exec db psql -U gymapp

migrate:
	docker compose exec server pnpm db:migrate

seed:
	docker compose exec server pnpm db:seed

build:
	docker compose build

clean:
	docker compose down -v
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules
```

---

## CI/CD

### .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test
```

---

## Initial Hono Server

### apps/server/src/index.ts

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { exercisesRouter } from "./routes/exercises";
import { usersRouter } from "./routes/users";
import { programsRouter } from "./routes/programs";
import { workoutsRouter } from "./routes/workouts";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors({
  origin: ["http://localhost:3000"],
  credentials: true,
}));

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Routes
app.route("/api/exercises", exercisesRouter);
app.route("/api/users", usersRouter);
app.route("/api/programs", programsRouter);
app.route("/api/workouts", workoutsRouter);

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default {
  port: 4000,
  fetch: app.fetch,
};
```

### apps/server/src/routes/exercises.ts

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { exercises } from "@gymapp/db/schema";
import { eq } from "drizzle-orm";

const exercisesRouter = new Hono();

// GET /api/exercises
exercisesRouter.get("/", async (c) => {
  const allExercises = await db.select().from(exercises);
  return c.json(allExercises);
});

// GET /api/exercises/:id
exercisesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const exercise = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1);
  
  if (!exercise.length) {
    return c.json({ error: "Exercise not found" }, 404);
  }
  
  return c.json(exercise[0]);
});

// GET /api/exercises/:id/substitutes
exercisesRouter.get("/:id/substitutes", zValidator("query", z.object({
  excludeEquipment: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
})), async (c) => {
  const id = c.req.param("id");
  const query = c.req.valid("query");
  
  // TODO: Implement substitution logic
  return c.json({ exerciseId: id, substitutes: [] });
});

export { exercisesRouter };
```

---

## MVP Decision Engine (7 Decisions Only)

The engine makes exactly these decisions:

1. **Load progression** — increase / maintain / decrease weight
2. **Volume adjustment** — add / maintain / reduce sets
3. **Exercise rotation** — keep or swap exercises
4. **Deload recommendation** — suggest recovery weeks (never forced)
5. **Session recovery adjustment** — lighten today's workout if recovery is poor
6. **Missed session handling** — resume / repeat / regress intelligently
7. **Weekly plan update** — roll all decisions into next week's plan

If a situation doesn't fit one of these → do nothing.

### packages/engine/src/progression.ts

```typescript
import type { LoggedSet, LoadDecision } from "@gymapp/types";

interface ProgressionInput {
  exerciseId: string;
  recentSets: LoggedSet[];
  currentWeight: number;
  targetRepRange: [number, number];
}

export function calculateLoadProgression(input: ProgressionInput): LoadDecision {
  const { recentSets, currentWeight, targetRepRange } = input;
  const [minReps, maxReps] = targetRepRange;
  
  if (recentSets.length === 0) {
    return {
      action: "maintain",
      newWeight: currentWeight,
      reason: "No recent data to base decision on",
    };
  }
  
  // Calculate average reps and RPE from recent sets
  const avgReps = recentSets.reduce((sum, s) => sum + s.reps, 0) / recentSets.length;
  const setsWithRpe = recentSets.filter(s => s.rpe !== undefined);
  const avgRpe = setsWithRpe.length > 0 
    ? setsWithRpe.reduce((sum, s) => sum + s.rpe!, 0) / setsWithRpe.length 
    : 7; // Default assumption
  
  // Decision logic
  if (avgReps >= maxReps && avgRpe < 8) {
    // Hitting top of rep range with room to spare → increase
    const increment = currentWeight < 50 ? 2.5 : 5;
    return {
      action: "increase",
      newWeight: currentWeight + increment,
      reason: `Averaging ${avgReps.toFixed(1)} reps at RPE ${avgRpe.toFixed(1)} — ready to progress`,
    };
  }
  
  if (avgReps < minReps || avgRpe > 9) {
    // Below rep range or grinding → decrease
    const decrement = currentWeight < 50 ? 2.5 : 5;
    return {
      action: "decrease",
      newWeight: Math.max(0, currentWeight - decrement),
      reason: `Averaging ${avgReps.toFixed(1)} reps at RPE ${avgRpe.toFixed(1)} — reduce load to maintain quality`,
    };
  }
  
  return {
    action: "maintain",
    newWeight: currentWeight,
    reason: `Averaging ${avgReps.toFixed(1)} reps at RPE ${avgRpe.toFixed(1)} — on track, maintain load`,
  };
}
```

---

## Instructions for Claude Code

1. **Scaffold the monorepo structure** using Turborepo with pnpm
2. **Create all packages** with their package.json and tsconfig.json files
3. **Set up Drizzle** with the two schemas (exercise_lib, training)
4. **Create the Docker setup** with docker-compose.yml and Dockerfiles
5. **Implement the Hono server** with basic route structure
6. **Set up the Next.js frontend** with App Router and Tailwind
7. **Create the shared types package** with all domain types
8. **Create the validation package** with Zod schemas
9. **Set up the basic engine package** with the progression logic stub

Start with the infrastructure (monorepo, docker, database) before implementing business logic.

Use `@gymapp/types`, `@gymapp/db`, `@gymapp/engine`, `@gymapp/validation` as package names.

The goal is: `git clone` → `cp .env.example .env` → `docker compose up` → everything works.
