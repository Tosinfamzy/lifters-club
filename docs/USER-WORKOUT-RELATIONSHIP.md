# User & Workout Relationship Analysis

> A comprehensive breakdown of the Lifters Club data model, entity relationships, and user flows.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Schema Architecture](#schema-architecture)
3. [Core Entities](#core-entities)
4. [Entity Relationships](#entity-relationships)
5. [User Flows](#user-flows)
6. [Data Flow Diagrams](#data-flow-diagrams)
7. [Design Patterns](#design-patterns)

---

## Executive Summary

Lifters Club is a **training decision engine** that transforms workout history into intelligent, justified training decisions. The system uses a dual-schema PostgreSQL architecture:

| Schema | Purpose |
|--------|---------|
| `exercise_lib` | Standalone canonical exercise library (reusable product) |
| `training` | User data, programs, workouts, decisions |

The relationship between a **User** and their **Workout** flows through several interconnected entities. Users can train through two paths:

**Program-Based Training:**
```
User → Training Block → Workouts → Workout Logs → Logged Sets
         ↓                                            ↓
      Program                                    Exercises
```

**Standalone Training:**
```
User → Workout Templates → Standalone Workouts → Workout Logs → Logged Sets
         ↓                          ↑                               ↓
   (reusable)              Weekly Plans                        Exercises
```

---

## Schema Architecture

### Exercise Library Schema (`exercise_lib`)

The exercise library is a **standalone, canonical movement database** that can be used independently of the training app.

```
┌─────────────────────────────────────────────┐
│              exercise_lib.exercises          │
├─────────────────────────────────────────────┤
│ • Semantic IDs (e.g., "barbell-back-squat") │
│ • Movement patterns (12 types)              │
│ • Muscle groups (primary & secondary)       │
│ • Equipment requirements                    │
│ • Difficulty classification                 │
│ • Physical constraints (rack, bench, etc.)  │
└─────────────────────────────────────────────┘
```

### Training Schema (`training`)

The training schema contains all user-specific data and the decision engine audit trail.

---

## Core Entities

### 1. User

The central entity representing a person using the app.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | Internal user ID |
| `clerkId` | VARCHAR(255) | Clerk authentication ID |
| `email` | VARCHAR(255) | User's email |
| `trainingLevel` | VARCHAR(20) | beginner / intermediate / advanced |
| `primaryGoal` | VARCHAR(20) | strength / hypertrophy / conditioning |
| `preferences` | JSONB | User configuration object |
| `onboardingComplete` | BOOLEAN | Has completed onboarding |
| `baselineComplete` | BOOLEAN | Has established baseline strength |

**Preferences Structure:**
```typescript
{
  focusAreas?: MuscleGroup[]           // Muscles to emphasize
  avoidExercises?: string[]            // Exercise IDs to skip
  equipmentAvailable: string[]         // Available equipment
  daysPerWeek: number                  // Training frequency
  sessionDurationMinutes: number       // Target session length
}
```

---

### 2. Program

A template defining a training structure that users can follow.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | Program ID |
| `name` | VARCHAR(255) | Display name |
| `description` | TEXT | Program description |
| `daysPerWeek` | INTEGER | Sessions per week |
| `goal` | VARCHAR(20) | Target goal |
| `level` | VARCHAR(20) | Difficulty level |
| `template` | JSONB | Complete program structure |

**Template Structure:**
```typescript
{
  weeks: number
  sessions: SessionTemplate[]
}

SessionTemplate = {
  dayNumber: number          // 1-7
  name: string               // "Upper A", "Lower B", etc.
  focus: MuscleGroup[]       // Primary muscle focus
  exercises: PlannedExercise[]
}

PlannedExercise = {
  exerciseId: string         // References exercise_lib.exercises
  sets: number               // Prescribed set count
  repRange: [min, max]       // Target rep range
  restSeconds: number        // Rest between sets
  notes?: string             // Special instructions
}
```

---

### 3. Training Block

An **instance** of a program assigned to a specific user with dates.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | Block ID |
| `userId` | VARCHAR(64) | FK → users.id |
| `programId` | VARCHAR(64) | FK → programs.id |
| `startDate` | DATE | When the block started |
| `endDate` | DATE | When the block ended (nullable) |
| `currentWeek` | INTEGER | Current week progress |
| `status` | VARCHAR(20) | active / completed / paused |

**Key Insight:** Training Blocks represent the "bridge" between a generic Program template and a specific User's journey through that program.

---

### 4. Workout (Program-Based)

A **scheduled workout instance** generated from a training block.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | Workout ID |
| `trainingBlockId` | VARCHAR(64) | FK → training_blocks.id |
| `scheduledDate` | DATE | When scheduled |
| `weekNumber` | INTEGER | Week in the program |
| `dayNumber` | INTEGER | Day in the week |
| `plannedExercises` | JSONB[] | Exercises to perform |
| `status` | VARCHAR(20) | pending / in_progress / completed / skipped |

**Important:** `plannedExercises` is **copied** from the program template at creation time. This ensures:
- Historical accuracy (changes to program don't affect past workouts)
- Decision engine can modify future workouts without altering the template

---

### 5. Workout Template (NEW)

A **reusable workout blueprint** that users can create and reuse (e.g., "Back Day", "Push Day").

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | Template ID |
| `userId` | VARCHAR(64) | FK → users.id |
| `name` | VARCHAR(255) | Display name (e.g., "Back Day") |
| `description` | TEXT | Template description |
| `focusMuscles` | JSONB[] | Target muscle groups |
| `exercises` | JSONB[] | PlannedExercise[] |
| `estimatedDurationMinutes` | INTEGER | Expected duration |

**Purpose:** Allows users to save frequently used workout structures for quick scheduling without being tied to a multi-week program.

---

### 6. Weekly Plan (NEW)

A **standalone week of workouts** not tied to multi-week programs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | Plan ID |
| `userId` | VARCHAR(64) | FK → users.id |
| `name` | VARCHAR(255) | Display name |
| `description` | TEXT | Plan description |
| `startDate` | DATE | Week start date |
| `daysPerWeek` | INTEGER | Training frequency |
| `goal` | VARCHAR(20) | strength / hypertrophy / conditioning |
| `status` | VARCHAR(20) | active / completed / archived |

**Purpose:** For users who want structured weekly training without committing to multi-week programs. Perfect for:
- Maintenance phases
- Flexible schedules
- Week-by-week planning

---

### 7. Standalone Workout (NEW)

A **single workout instance** not tied to a program or training block.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | Workout ID |
| `userId` | VARCHAR(64) | FK → users.id |
| `templateId` | VARCHAR(64) | FK → workout_templates.id (nullable) |
| `weeklyPlanId` | VARCHAR(64) | FK → weekly_plans.id (nullable) |
| `name` | VARCHAR(255) | Workout name |
| `scheduledDate` | DATE | When scheduled |
| `dayOfWeek` | INTEGER | Day in weekly plan (1-7, nullable) |
| `plannedExercises` | JSONB[] | Exercises to perform |
| `focusMuscles` | JSONB[] | Target muscle groups |
| `status` | VARCHAR(20) | pending / in_progress / completed / skipped |

**Key Features:**
- Can be created from a template (`templateId`)
- Can be part of a weekly plan (`weeklyPlanId`)
- Can be completely ad-hoc (both nullable)
- Supports AI-generated exercise selection via `generateQuickWorkout()`

---

### 8. Workout Log

A **record of actual workout execution** (what the user actually did).

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | Log ID |
| `workoutId` | VARCHAR(64) | FK → workouts.id (nullable) |
| `standaloneWorkoutId` | VARCHAR(64) | FK → standalone_workouts.id (nullable) |
| `userId` | VARCHAR(64) | FK → users.id |
| `startedAt` | TIMESTAMP | When started |
| `completedAt` | TIMESTAMP | When finished (nullable) |
| `overallRpe` | REAL | Session RPE (1-10) |
| `notes` | TEXT | Session notes |

**Why both IDs are nullable:**
- `workoutId` null: Workout not from a program
- `standaloneWorkoutId` null: Workout not a standalone workout
- **Both null**: Retrospective/ad-hoc logging
- **One set**: Linked to program or standalone workout

---

### 9. Logged Set

Individual set data recorded during a workout.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | Set ID |
| `workoutLogId` | VARCHAR(64) | FK → workout_logs.id |
| `exerciseId` | VARCHAR(64) | Reference to exercise_lib.exercises |
| `setNumber` | INTEGER | Set order (1, 2, 3...) |
| `weight` | REAL | Weight used |
| `reps` | INTEGER | Reps completed |
| `rpe` | REAL | Rating of Perceived Exertion (1-10) |
| `notes` | TEXT | Set-specific notes |

**Cross-Schema Reference:** `exerciseId` references `exercise_lib.exercises.id` but is NOT a database foreign key. This allows:
- Independent schema evolution
- Exercise library as standalone product
- Flexibility in exercise management

**Decision Engine Integration:** All logged sets feed into the decision engine regardless of workout type (program-based or standalone). This means:
- Progression recommendations use ALL exercise history
- Squatting 100kg in a program workout affects standalone "Leg Day" recommendations
- Unified exercise history across workout types

---

### 10. User Baseline

Established baseline strength for exercises (used for progression calculations).

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | Baseline ID |
| `userId` | VARCHAR(64) | FK → users.id |
| `exerciseId` | VARCHAR(64) | Reference to exercise |
| `baselineWeight` | REAL | Starting weight |
| `baselineReps` | INTEGER | Starting reps |
| `estimatedE1RM` | REAL | Estimated 1-rep max |
| `source` | VARCHAR(20) | user_input / calibration / inferred |
| `establishedAt` | TIMESTAMP | When established |

**Purpose:** Provides the starting point for the progression engine to calculate appropriate loads.

---

### 11. Decision

Audit trail of training decisions made by the engine.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | Decision ID |
| `userId` | VARCHAR(64) | FK → users.id |
| `workoutId` | VARCHAR(64) | FK → workouts.id (nullable) |
| `type` | VARCHAR(50) | Decision type |
| `input` | JSONB | Data used to make decision |
| `output` | JSONB | The decision result |
| `reasoning` | TEXT | Human-readable explanation |
| `algorithmVersion` | VARCHAR(20) | Engine version |

**Decision Types:**

| Type | Description |
|------|-------------|
| `load_progression` | Increase/decrease/maintain weight |
| `volume_adjustment` | Add/remove sets |
| `exercise_rotation` | Swap exercises |
| `deload_recommendation` | Suggest recovery week |
| `session_recovery` | Modify session based on readiness |
| `missed_session` | Handle skipped workouts |
| `weekly_plan_update` | Adjust upcoming week |
| `quick_workout` | Generate standalone workout exercises |

---

### 12. Decision Outcome

Tracks what users did with decisions (feedback loop for engine improvement).

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | Outcome ID |
| `decisionId` | VARCHAR(64) | FK → decisions.id |
| `userId` | VARCHAR(64) | FK → users.id |
| `outcome` | VARCHAR(20) | followed / overridden / ignored |
| `success` | BOOLEAN | Was the decision successful? |
| `overrideReason` | VARCHAR(50) | Why user overrode decision |
| `expectedValue` | JSONB | What was predicted |
| `actualValue` | JSONB | What actually happened |

**Override Reasons:**
- `felt_too_heavy`
- `felt_too_light`
- `equipment_unavailable`
- `time_constraint`
- `injury_concern`
- `other`

---

### 13. Readiness Check

Pre-workout assessment of user recovery status.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | Check ID |
| `userId` | VARCHAR(64) | FK → users.id |
| `workoutLogId` | VARCHAR(64) | FK → workout_logs.id (nullable) |
| `sleepQuality` | INTEGER | 1-5 rating |
| `muscleSoreness` | INTEGER | 1-5 rating |
| `stressLevel` | INTEGER | 1-5 rating |
| `energyLevel` | INTEGER | 1-5 rating |
| `score` | INTEGER | Calculated readiness score |
| `recommendation` | VARCHAR(20) | proceed / modify / rest |

---

### 14. Exercise (Exercise Library)

Canonical exercise definitions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | Semantic ID (e.g., "barbell-back-squat") |
| `name` | VARCHAR(255) | Display name |
| `aliases` | JSONB[] | Alternative names |
| `equipment` | JSONB[] | Required equipment |
| `movementPatterns` | JSONB[] | Movement pattern classification |
| `primaryMuscles` | JSONB[] | Primary muscles targeted |
| `secondaryMuscles` | JSONB[] | Secondary muscles |
| `isCompound` | BOOLEAN | Multi-joint movement |
| `isUnilateral` | BOOLEAN | Single-sided movement |
| `difficulty` | VARCHAR(20) | beginner / intermediate / advanced |
| `constraints` | JSONB[] | Physical constraints needed |

**Movement Patterns (12 types):**
```
squat, hinge, lunge, push_horizontal, push_vertical,
pull_horizontal, pull_vertical, carry, core_anti,
isolation_upper, isolation_lower, conditioning
```

**Muscle Groups (12 groups):**
```
quads, hamstrings, glutes, calves, chest, lats,
upper_back, shoulders, biceps, triceps, forearms, core
```

---

## Entity Relationships

### Complete Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXERCISE_LIB SCHEMA                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────────┐                                                   │
│   │     exercises        │◄──── Soft references from training schema         │
│   │  (canonical library) │                                                   │
│   └──────────────────────┘                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ (soft FK via exerciseId)
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                            TRAINING SCHEMA                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌────────────────────────── PROGRAM PATH ───────────────────────────────┐   │
│ │                                                                        │   │
│ │  ┌──────────────┐                    ┌──────────────┐                  │   │
│ │  │   programs   │                    │    users     │                  │   │
│ │  │  (templates) │                    │   (people)   │                  │   │
│ │  └──────────────┘                    └──────────────┘                  │   │
│ │         │                                   │                          │   │
│ │         │ (1)                               │ (1)                      │   │
│ │         │                                   │                          │   │
│ │         ▼ (N)                               ▼ (N)                      │   │
│ │  ┌─────────────────────────────────────────────────────┐              │   │
│ │  │               training_blocks                        │              │   │
│ │  │     (user's instance of a program with dates)       │              │   │
│ │  └─────────────────────────────────────────────────────┘              │   │
│ │                        │                                               │   │
│ │                        │ (1)                                           │   │
│ │                        │                                               │   │
│ │                        ▼ (N)                                           │   │
│ │  ┌─────────────────────────────────────────────────────┐              │   │
│ │  │                   workouts                           │              │   │
│ │  │        (scheduled workout instances)                 │──────┐      │   │
│ │  └─────────────────────────────────────────────────────┘      │      │   │
│ │                                                                │      │   │
│ └────────────────────────────────────────────────────────────────┼──────┘   │
│                                                                  │          │
│ ┌──────────────────────── STANDALONE PATH ──────────────────────┼──────┐   │
│ │                                                                │      │   │
│ │  ┌──────────────────┐                                          │      │   │
│ │  │ workout_templates│                                          │      │   │
│ │  │ (reusable        │                                          │      │   │
│ │  │  blueprints)     │                                          │      │   │
│ │  │  userId → users  │                                          │      │   │
│ │  └────────┬─────────┘                                          │      │   │
│ │           │ (0..1)                                             │      │   │
│ │           ▼                                                    │      │   │
│ │  ┌───────────────────────────────────────────────┐             │      │   │
│ │  │          standalone_workouts                   │             │      │   │
│ │  │    (single workouts, not program-based)       │─────────────┼──┐   │   │
│ │  │         userId → users                        │             │  │   │   │
│ │  │       templateId → workout_templates          │             │  │   │   │
│ │  │      weeklyPlanId → weekly_plans             │             │  │   │   │
│ │  └───────────────────────────────────────────────┘             │  │   │   │
│ │           ▲                                                    │  │   │   │
│ │           │ (N)                                                │  │   │   │
│ │           │                                                    │  │   │   │
│ │  ┌────────┴─────────┐                                          │  │   │   │
│ │  │   weekly_plans   │                                          │  │   │   │
│ │  │ (standalone week)│                                          │  │   │   │
│ │  │  userId → users  │                                          │  │   │   │
│ │  └──────────────────┘                                          │  │   │   │
│ │                                                                │  │   │   │
│ └────────────────────────────────────────────────────────────────┼──┼───┘   │
│                                                                  │  │       │
│                     ┌────────────────────────────────────────────┘  │       │
│                     │                                               │       │
│                     ▼ (0..1)                               (0..1)  ▼       │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                         workout_logs                                 │  │
│   │                  (actual workout execution)                          │  │
│   │                      userId → users                                  │  │
│   │                   workoutId → workouts (nullable)                    │  │
│   │           standaloneWorkoutId → standalone_workouts (nullable)       │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                         │                                                   │
│                         │ (1)                                               │
│                         │                                                   │
│                         ▼ (N)                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                        logged_sets                                   │  │
│   │                  (individual set data)                               │  │
│   │               exerciseId → exercise_lib.exercises                    │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                                                                             │
│   ┌───────────────────┐     ┌────────────────────┐                         │
│   │   user_baselines  │     │  readiness_checks  │                         │
│   │ (starting points) │     │ (pre-workout)      │                         │
│   │   userId → users  │     │   userId → users   │                         │
│   │ exerciseId → ex.  │     │   logId → logs     │                         │
│   └───────────────────┘     └────────────────────┘                         │
│                                                                             │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                         decisions                                    │  │
│   │              (engine decision audit trail)                           │  │
│   │                    userId → users                                    │  │
│   │                 workoutId → workouts                                 │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                         │                                                   │
│                         │ (1)                                               │
│                         │                                                   │
│                         ▼ (N)                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                     decision_outcomes                                │  │
│   │                 (feedback loop for engine)                           │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Relationship Summary

| Parent | Child | Cardinality | Description |
|--------|-------|-------------|-------------|
| User | Training Block | 1:N | User can have multiple training blocks |
| Program | Training Block | 1:N | Program can be used by multiple users |
| Training Block | Workout | 1:N | Block generates multiple workouts |
| User | Workout Template | 1:N | User owns multiple templates |
| User | Weekly Plan | 1:N | User can have multiple weekly plans |
| User | Standalone Workout | 1:N | User can create many standalone workouts |
| Weekly Plan | Standalone Workout | 1:N | Plan contains multiple workouts |
| Workout Template | Standalone Workout | 1:N | Template can spawn many workouts |
| Workout | Workout Log | 0..1:N | Program workout may have logs |
| Standalone Workout | Workout Log | 0..1:N | Standalone workout may have logs |
| Workout Log | Logged Set | 1:N | Log contains multiple sets |
| User | User Baseline | 1:N | User has baselines for each exercise |
| User | Readiness Check | 1:N | User can have multiple checks |
| User | Decision | 1:N | User receives multiple decisions |
| Decision | Decision Outcome | 1:N | Decision can have multiple outcomes |

---

## User Flows

### Flow 1: New User Onboarding

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NEW USER ONBOARDING                          │
└─────────────────────────────────────────────────────────────────────┘

1. ACCOUNT CREATION
   ┌──────────────────┐
   │ User signs up    │
   │ via Clerk        │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ User record      │
   │ created with:    │
   │ • clerkId        │
   │ • email          │
   │ • onboardingComplete: false
   │ • baselineComplete: false
   └────────┬─────────┘
            │
2. PREFERENCE COLLECTION
            │
            ▼
   ┌──────────────────┐
   │ User sets:       │
   │ • trainingLevel  │
   │ • primaryGoal    │
   │ • preferences    │
   │   - focusAreas   │
   │   - equipment    │
   │   - daysPerWeek  │
   │   - duration     │
   └────────┬─────────┘
            │
3. BASELINE ESTABLISHMENT
            │
            ▼
   ┌──────────────────┐
   │ Calibration:     │
   │ User performs    │
   │ baseline tests   │
   │ for key lifts    │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ UserBaseline     │
   │ records created: │
   │ • exerciseId     │
   │ • baselineWeight │
   │ • baselineReps   │
   │ • estimatedE1RM  │
   │ • source: "calibration"
   └────────┬─────────┘
            │
4. TRAINING PATH SELECTION
            │
            ▼
   ┌─────────────────────────────────────────────────┐
   │           Choose Training Style:                │
   │                                                 │
   │  ┌───────────────┐      ┌───────────────────┐  │
   │  │   PROGRAMS    │  OR  │   FLEXIBLE        │  │
   │  │ (Multi-week)  │      │ (Weekly/Ad-hoc)   │  │
   │  └───────┬───────┘      └─────────┬─────────┘  │
   │          │                        │            │
   └──────────┼────────────────────────┼────────────┘
              │                        │
              ▼                        ▼
   ┌──────────────────┐     ┌──────────────────┐
   │ TrainingBlock    │     │ Create Templates │
   │ created from     │     │ or Weekly Plans  │
   │ selected Program │     │ or Quick Workouts│
   └──────────────────┘     └──────────────────┘
```

---

### Flow 2: Performing a Program Workout

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PROGRAM WORKOUT EXECUTION                         │
└─────────────────────────────────────────────────────────────────────┘

1. PRE-WORKOUT (OPTIONAL)
   ┌──────────────────┐
   │ ReadinessCheck   │
   │ • sleepQuality   │
   │ • muscleSoreness │
   │ • stressLevel    │
   │ • energyLevel    │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ Score calculated │
   │ Recommendation:  │
   │ proceed/modify/  │
   │ rest             │
   └────────┬─────────┘
            │
2. START WORKOUT
            │
            ▼
   ┌──────────────────┐
   │ Workout status   │
   │ → "in_progress"  │
   │                  │
   │ WorkoutLog       │
   │ created:         │
   │ • workoutId      │
   │ • userId         │
   │ • startedAt      │
   └────────┬─────────┘
            │
3. PERFORM SETS
            │
            ▼
   ┌────────────────────────────────────────────┐
   │ For each exercise in plannedExercises:     │
   │                                            │
   │   For each set:                            │
   │   ┌────────────────────────────────────┐   │
   │   │ LoggedSet created:                 │   │
   │   │ • exerciseId                       │   │
   │   │ • setNumber                        │   │
   │   │ • weight (actual)                  │   │
   │   │ • reps (actual)                    │   │
   │   │ • rpe (how hard it felt)           │   │
   │   │ • notes (optional)                 │   │
   │   └────────────────────────────────────┘   │
   │                                            │
   │   Decision engine may suggest:             │
   │   • "Increase weight next set" (rpe < 6)   │
   │   • "Good effort, maintain" (rpe 6-8)      │
   │   • "Consider reducing" (rpe > 9)          │
   │                                            │
   └────────────────┬───────────────────────────┘
                    │
4. COMPLETE WORKOUT
                    │
                    ▼
   ┌──────────────────┐
   │ WorkoutLog       │
   │ updated:         │
   │ • completedAt    │
   │ • overallRpe     │
   │ • notes          │
   │                  │
   │ Workout status   │
   │ → "completed"    │
   └────────┬─────────┘
            │
5. POST-WORKOUT ANALYSIS
            │
            ▼
   ┌──────────────────┐
   │ Engine analyzes: │
   │ • Set performance│
   │ • RPE trends     │
   │ • Volume totals  │
   │ • Progressive    │
   │   overload?      │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ Decisions        │
   │ generated for    │
   │ next workout:    │
   │ • load_progression
   │ • volume_adjustment
   │ • exercise_rotation
   └──────────────────┘
```

---

### Flow 3: Creating a Quick Workout (NEW)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    QUICK WORKOUT GENERATION                          │
└─────────────────────────────────────────────────────────────────────┘

User wants to train today without following a program

                    ┌───────────────────────┐
                    │  User opens app       │
                    │  "Quick Workout"      │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Select focus muscles:│
                    │  • chest              │
                    │  • triceps            │
                    │  • shoulders          │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Optional settings:   │
                    │  • Duration (45 min)  │
                    │  • Save as template?  │
                    └───────────┬───────────┘
                                │
                                ▼
         ┌──────────────────────────────────────────────┐
         │           generateQuickWorkout()              │
         │                                              │
         │  1. Query exercises targeting muscles        │
         │  2. Fetch user's exercise history            │
         │  3. Score exercises by:                      │
         │     • Muscle match                           │
         │     • User history (preferred)               │
         │     • Equipment preference                   │
         │     • Compound vs isolation                  │
         │  4. Select balanced set of exercises         │
         │  5. Set reps/sets based on goal              │
         │  6. Return workout with reasoning            │
         └──────────────────┬───────────────────────────┘
                            │
                            ▼
                    ┌───────────────────────┐
                    │  StandaloneWorkout    │
                    │  created:             │
                    │  • name: "Push Day"   │
                    │  • scheduledDate      │
                    │  • plannedExercises   │
                    │  • focusMuscles       │
                    │  • status: pending    │
                    └───────────┬───────────┘
                                │
                         (Optional)
                                │
                                ▼
                    ┌───────────────────────┐
                    │  WorkoutTemplate      │
                    │  saved if requested   │
                    │  (reuse later)        │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  User starts workout  │
                    │  Same logging flow    │
                    │  as program workouts  │
                    └───────────────────────┘
```

---

### Flow 4: Weekly Plan Management (NEW)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      WEEKLY PLAN CREATION                            │
└─────────────────────────────────────────────────────────────────────┘

User wants structured training without multi-week commitment

                    ┌───────────────────────┐
                    │  User creates plan    │
                    │  "This Week's Training"│
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Plan settings:       │
                    │  • startDate: Monday  │
                    │  • daysPerWeek: 4     │
                    │  • goal: hypertrophy  │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Define workouts:     │
                    │                       │
                    │  Day 1: Push          │
                    │  Day 2: Pull          │
                    │  Day 4: Legs          │
                    │  Day 5: Upper         │
                    └───────────┬───────────┘
                                │
                                ▼
         ┌──────────────────────────────────────────────┐
         │            WeeklyPlan created                 │
         │                                              │
         │  For each workout day:                       │
         │  ┌────────────────────────────────────────┐  │
         │  │  StandaloneWorkout created:            │  │
         │  │  • weeklyPlanId → plan                 │  │
         │  │  • dayOfWeek: 1, 2, 4, 5               │  │
         │  │  • scheduledDate: calculated           │  │
         │  │  • plannedExercises                    │  │
         │  │  • status: pending                     │  │
         │  └────────────────────────────────────────┘  │
         │                                              │
         └──────────────────────────────────────────────┘
                                │
                                ▼
                    WEEK EXECUTION
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     ┌─────────┐   ┌─────────┐   ┌─────────┐
     │ Day 1   │   │ Day 2   │   │ Day 4   │  ...
     │ Push    │   │ Pull    │   │ Legs    │
     └────┬────┘   └────┬────┘   └────┬────┘
          │             │             │
          ▼             ▼             ▼
     ┌─────────┐   ┌─────────┐   ┌─────────┐
     │ Log via │   │ Log via │   │ Log via │
     │ WorkoutLog  │ WorkoutLog  │ WorkoutLog
     │ (standalone │ (standalone │ (standalone
     │ WorkoutId)  │ WorkoutId)  │ WorkoutId)
     └─────────┘   └─────────┘   └─────────┘
          │             │             │
          └─────────────┴─────────────┘
                        │
                        ▼
              ┌───────────────────────┐
              │    END OF WEEK        │
              │                       │
              │  Plan status →        │
              │  "completed"          │
              │                       │
              │  User can create      │
              │  new plan for next    │
              │  week                 │
              └───────────────────────┘
```

---

### Flow 5: Using a Workout Template (NEW)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TEMPLATE-BASED WORKOUT                            │
└─────────────────────────────────────────────────────────────────────┘

User has saved templates for common workout types

                    ┌───────────────────────┐
                    │  User's Templates:    │
                    │                       │
                    │  • "Back Day"         │
                    │  • "Push Day"         │
                    │  • "Leg Day"          │
                    │  • "Full Body"        │
                    └───────────┬───────────┘
                                │
                    User selects "Back Day"
                                │
                                ▼
                    ┌───────────────────────┐
                    │  POST /templates/:id/ │
                    │  use                  │
                    │                       │
                    │  { scheduledDate:     │
                    │    "2024-01-15" }     │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  StandaloneWorkout    │
                    │  created from template│
                    │                       │
                    │  • templateId → tmpl  │
                    │  • name: "Back Day"   │
                    │  • exercises copied   │
                    │  • focusMuscles copied│
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  User performs workout│
                    │  (same as any other   │
                    │   workout flow)       │
                    └───────────────────────┘
```

---

### Flow 6: Decision Engine Feedback Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│                   DECISION ENGINE FEEDBACK LOOP                      │
└─────────────────────────────────────────────────────────────────────┘

                    ┌───────────────────────┐
                    │   HISTORICAL DATA     │
                    │   • Logged sets       │
                    │   • User baselines    │
                    │   • Previous decisions│
                    │   • Readiness checks  │
                    │                       │
                    │   FROM ALL SOURCES:   │
                    │   • Program workouts  │
                    │   • Standalone workouts│
                    │   • Retrospective logs│
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   DECISION ENGINE     │
                    │   (pure functions)    │
                    │                       │
                    │   Input → Output      │
                    │   + Reasoning         │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   DECISION CREATED    │
                    │   • type              │
                    │   • input (JSONB)     │
                    │   • output (JSONB)    │
                    │   • reasoning (text)  │
                    │   • algorithmVersion  │
                    └───────────┬───────────┘
                                │
                                ▼
              ┌─────────────────┴─────────────────┐
              │         USER RESPONSE             │
              │                                   │
              ▼                 ▼                 ▼
        ┌──────────┐     ┌──────────┐     ┌──────────┐
        │ FOLLOWED │     │ OVERRODE │     │ IGNORED  │
        │          │     │          │     │          │
        └────┬─────┘     └────┬─────┘     └────┬─────┘
             │                │                │
             │                ▼                │
             │    ┌──────────────────┐         │
             │    │ Override reason: │         │
             │    │ • felt_too_heavy │         │
             │    │ • felt_too_light │         │
             │    │ • equipment_unavailable    │
             │    │ • time_constraint│         │
             │    │ • injury_concern │         │
             │    └────────┬─────────┘         │
             │             │                   │
             └─────────────┴───────────────────┘
                           │
                           ▼
              ┌───────────────────────┐
              │  DECISION_OUTCOME     │
              │  recorded:            │
              │  • outcome            │
              │  • overrideReason     │
              │  • expectedValue      │
              │  • actualValue        │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  LATER: EVALUATION    │
              │                       │
              │  Was the decision     │
              │  successful?          │
              │                       │
              │  success: true/false  │
              │  evaluatedAt: now()   │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  ANALYTICS & ENGINE   │
              │  IMPROVEMENT          │
              │                       │
              │  • Decision accuracy  │
              │  • Override patterns  │
              │  • Algorithm tuning   │
              └───────────────────────┘
```

---

### Flow 7: Ad-Hoc / Retrospective Workout Logging

```
┌─────────────────────────────────────────────────────────────────────┐
│                   AD-HOC WORKOUT LOGGING                             │
└─────────────────────────────────────────────────────────────────────┘

User performs workout outside of any scheduled context
(e.g., at different gym, spontaneous session, logging past workout)

                    ┌───────────────────────┐
                    │   User opens app      │
                    │   "Log workout"       │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   WorkoutLog created  │
                    │   • workoutId: NULL   │  ← Not program-based
                    │   • standaloneWorkoutId: NULL │ ← Not standalone
                    │   • userId            │
                    │   • startedAt         │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   User logs sets:     │
                    │   • Select exercise   │
                    │   • Enter weight      │
                    │   • Enter reps        │
                    │   • (optional) RPE    │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   LoggedSets created  │
                    │   • workoutLogId      │
                    │   • exerciseId        │
                    │   • weight, reps, rpe │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Data feeds into     │
                    │   decision engine     │
                    │   for ALL workouts:   │
                    │   • Program workouts  │
                    │   • Standalone workouts│
                    │   • Future quick      │
                    │     workout generation│
                    └───────────────────────┘

Benefits:
• Maintains complete training history
• Engine has accurate data for ALL decisions
• User flexibility without data loss
• Unified exercise history regardless of workout type
```

---

## Data Flow Diagrams

### Complete Data Flow: User → Workout History

```
                              TRAINING PATH SELECTION
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
            PROGRAM-BASED                    STANDALONE
                    │                                 │
                    ▼                                 ▼
┌──────────┐    ┌──────────────┐    ┌───────────────┐    ┌────────────────────┐
│          │    │              │    │               │    │                    │
│   USER   │───▶│  TRAINING    │───▶│   WORKOUTS    │    │  WORKOUT TEMPLATES │
│          │    │    BLOCK     │    │  (scheduled)  │    │  (reusable)        │
│          │    │              │    │               │    │                    │
└──────────┘    └──────────────┘    └───────┬───────┘    └─────────┬──────────┘
      │                                     │                      │
      │                                     │                      ▼
      │                                     │        ┌─────────────────────────┐
      │                                     │        │  STANDALONE WORKOUTS    │
      │                                     │        │  (or WEEKLY PLANS)      │
      │                                     │        └────────────┬────────────┘
      │                                     │                     │
      │                                     └──────────┬──────────┘
      │                                                │
      │                                                ▼
      │                                         ┌────────────┐
      │                                         │            │
      │                                         │  WORKOUT   │
      │                                         │    LOGS    │
      │                                         │ (executed) │
      │                                         └─────┬──────┘
      │                                               │
      │                                               ▼
      │                                         ┌────────────┐
      │                                         │            │
      │                                         │  LOGGED    │
      │                                         │   SETS     │
      │                                         │            │
      │                                         └─────┬──────┘
      │                                               │
      │              ┌────────────────────────────────┘
      │              │
      │              ▼
      │       ┌────────────┐    ┌────────────┐    ┌────────────┐
      │       │            │    │            │    │            │
      └──────▶│  DECISION  │───▶│  DECISION  │───▶│  UPDATED   │
              │   ENGINE   │    │  OUTCOMES  │    │  WORKOUTS  │
              │            │    │            │    │            │
              └────────────┘    └────────────┘    └────────────┘
                    ▲
                    │
             ┌──────┴──────┐
             │             │
      ┌──────┴───┐   ┌─────┴─────┐
      │          │   │           │
      │ BASELINES│   │ READINESS │
      │          │   │  CHECKS   │
      └──────────┘   └───────────┘
```

### Exercise Reference Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EXERCISE REFERENCE PATTERNS                       │
└─────────────────────────────────────────────────────────────────────┘

exercise_lib.exercises (canonical source)
         │
         │ Referenced by (soft FK):
         │
         ├──▶ programs.template.sessions[].exercises[].exerciseId
         │    (JSONB - copied at program creation)
         │
         ├──▶ workouts.plannedExercises[].exerciseId
         │    (JSONB - copied from program template)
         │
         ├──▶ workout_templates.exercises[].exerciseId
         │    (JSONB - user-created template)
         │
         ├──▶ standalone_workouts.plannedExercises[].exerciseId
         │    (JSONB - copied from template or generated)
         │
         ├──▶ logged_sets.exerciseId
         │    (VARCHAR - actual performance data)
         │
         ├──▶ user_baselines.exerciseId
         │    (VARCHAR - user's baseline for exercise)
         │
         └──▶ users.preferences.avoidExercises[]
              (JSONB - exercises user wants to skip)
```

---

## Design Patterns

### 1. Soft Foreign Keys

Exercise references across schemas are **NOT database foreign keys**:

```sql
-- NOT FK constraints
logged_sets.exerciseId → exercise_lib.exercises.id
user_baselines.exerciseId → exercise_lib.exercises.id
workout_templates.exercises[].exerciseId → exercise_lib.exercises.id
standalone_workouts.plannedExercises[].exerciseId → exercise_lib.exercises.id
```

**Benefits:**
- Independent schema evolution
- Exercise library as standalone product
- Easier testing and mocking
- Schema flexibility

---

### 2. Immutable Workout Data

When workouts are created, `plannedExercises` is **copied** from the source:

```
Program Template (source of truth for new blocks)
       │
       │ COPY at block creation
       ▼
Training Block → Workouts.plannedExercises (immutable snapshot)

Workout Template (source of truth for template-based workouts)
       │
       │ COPY when used
       ▼
Standalone Workout.plannedExercises (immutable snapshot)
```

**Benefits:**
- Historical accuracy preserved
- Template updates don't affect existing workouts
- Decision engine can modify future workouts

---

### 3. Nullable Foreign Keys for Flexibility

```typescript
// workout_logs supports multiple sources
WorkoutLog {
  workoutId: string | null              // Program workout
  standaloneWorkoutId: string | null    // Standalone workout
  // Both null = retrospective/ad-hoc
}

// standalone_workouts can be independent or grouped
StandaloneWorkout {
  templateId: string | null    // From template
  weeklyPlanId: string | null  // Part of weekly plan
  // Both null = truly ad-hoc
}
```

**Benefits:**
- Ad-hoc workout logging
- Retrospective logging
- Flexible workout organization
- Multiple workout "sources" in one table

---

### 4. JSONB for Structured Data

Complex nested data stored as JSONB:

| Table | Column | Contents |
|-------|--------|----------|
| users | preferences | User configuration |
| programs | template | Complete program structure |
| workouts | plannedExercises | Exercise prescription |
| workout_templates | exercises | Template exercise list |
| standalone_workouts | plannedExercises | Workout exercises |
| standalone_workouts | focusMuscles | Target muscle groups |
| decisions | input/output | Decision-specific data |

**Benefits:**
- Schema flexibility
- Reduced table proliferation
- Type-safe with TypeScript interfaces

---

### 5. Audit Trail Pattern

Every decision is recorded with full context:

```
Decision:
├── input (what data was used)
├── output (what was decided)
├── reasoning (human-readable explanation)
├── algorithmVersion (engine version)
└── DecisionOutcome:
    ├── outcome (followed/overridden/ignored)
    ├── overrideReason (if applicable)
    ├── expectedValue (prediction)
    ├── actualValue (reality)
    └── success (was it correct?)
```

**Benefits:**
- Complete audit trail
- Engine improvement feedback loop
- Decision accuracy analytics
- Explainable AI

---

### 6. Unified Exercise History

All logged sets feed into the decision engine regardless of workout type:

```
┌─────────────────────┐  ┌──────────────────────┐  ┌─────────────────┐
│ Program Workouts    │  │ Standalone Workouts  │  │ Retrospective   │
│ workout_logs.       │  │ workout_logs.        │  │ workout_logs    │
│ workoutId           │  │ standaloneWorkoutId  │  │ (both null)     │
└─────────┬───────────┘  └──────────┬───────────┘  └────────┬────────┘
          │                         │                       │
          └─────────────────────────┴───────────────────────┘
                                    │
                                    ▼
                          ┌─────────────────┐
                          │  logged_sets    │
                          │  (exerciseId)   │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │ Decision Engine │
                          │ uses ALL data   │
                          │ for progression │
                          └─────────────────┘
```

**Benefits:**
- Accurate progression recommendations
- No data silos between workout types
- Consistent experience across training styles

---

### 7. Readiness-Informed Decisions

Pre-workout readiness checks influence session modifications:

```
ReadinessCheck (sleep, soreness, stress, energy)
        │
        ▼
    score + recommendation
        │
        ▼
    Decision.type = "session_recovery"
        │
        ▼
    Modified workout (reduced volume, lighter weights, etc.)
```

---

## Summary

The relationship between a User and their Workout in Lifters Club is a **rich, multi-layered system** designed to:

1. **Support multiple training styles** - Programs, weekly plans, templates, and ad-hoc workouts
2. **Track everything** - From high-level programs down to individual sets
3. **Learn and adapt** - Decision engine uses ALL exercise history regardless of source
4. **Stay flexible** - Support both structured and spontaneous training
5. **Explain itself** - Every decision has reasoning
6. **Respect boundaries** - Exercise library is independent product

The core flows are:

**Program Path:**
```
User → Training Block → Workouts → Workout Logs → Logged Sets
                                         ↓
                                  Decision Engine
                                         ↓
                                  Better Workouts
```

**Standalone Path:**
```
User → Templates/Weekly Plans → Standalone Workouts → Workout Logs → Logged Sets
                                                              ↓
                                                       Decision Engine
                                                              ↓
                                                    Better Recommendations
```

Every interaction feeds back into the system, making each subsequent workout more personalized and effective - regardless of which path the user chooses.
