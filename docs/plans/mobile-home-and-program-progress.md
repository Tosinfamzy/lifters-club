# Plan: Mobile home (week strip) + program progress

> **Why:** The engine is strong, but the app doesn't *feel* like following a coach's plan. The user's
> inspiration (a screen recording of another training app, 2026-11-11) makes one point: the athlete
> should always see **where they are in their program and what's next**. We borrow the layout ideas,
> not the look. Audit: 2026-11-11 (mobile, data model, API).

**Prerequisite — shipped in PR #37:** the `GET /api/workouts` filter data leak and the internal-user-id
fix for standalone workouts, weekly plans and templates. Both were blockers for this work.

## Target UX

**Home tab (`app/(tabs)/index.tsx`):**
- Month header ("November 2026").
- A swipeable 7-day strip with dots: green = trained (completed log that day), grey = scheduled, none = rest.
- For the selected day: time trained and volume.
- The scheduled workout card shows the **session name** from the template (e.g. "Push Day 2") with
  "Week X · Day Y". Exercises show **names**, not raw ids.
- "Additional workouts" lists that day's standalone workouts (read-only for now; see Deferred).

**Program detail (new `app/program/[blockId].tsx`):**
- Header: program name, "N-week plan", **Following** / **Paused** badge.
- Tabs: Overview (description, goal, days/week, progress bar) · Workouts.
- Workouts tab: Week 1…N pills (defaults to the current week). Rows read "Week X – Day Y · <session name>"
  with a status tick (completed / skipped / in progress / pending). Tapping a row opens `/workout/[id]`.
- Weeks not generated yet (after `currentWeek`) are **built from `program.template`**. Their rows are
  greyed with no date and no tap, because the workout rows don't exist until `generate-week` runs.
- Sticky action: **Pause plan** / **Resume plan**. Generate-next-week moves here from the programs tab card.
- Entry points: the programs tab's active-block card, and the home card's "Week X" label.

## Signed-off decisions (2026-11-11)

| # | Decision | Outcome |
|---|---|---|
| 1 | Week start day | **User preference, default Sunday.** New `preferences.weekStartDay: "sunday" \| "monday"` (optional; absent = Sunday). Purely client-side: the calendar endpoint takes an arbitrary date range, so the server needs no week logic. |
| 2 | Units & display config | **Everything lives in `users.preferences`** (jsonb, validated by `userPreferencesSchema`), which already holds `weightUnit`. Mobile gets a **Settings → Units & display** section (weight unit + week start). Display stored weights with the `weightUnit` label; no conversion. |
| 3 | Day bucketing / timezone | Client sends its IANA `tz`; the server buckets by the user's local date. |
| 4 | Swipe implementation | Paging horizontal `FlatList` (`pagingEnabled`, 1 page = 1 week), **no new dependency**. If it feels janky on device, fall back to chevron buttons before adding a library. |
| 5 | Data fetching | React Query for the new screens only (`lib/queries.ts`, modelled on web). |
| 6 | Resume when another plan is active | 409, with an Alert offering to switch. |

## PR breakdown

### PR A — Server: calendar endpoint + pause/resume guard (M)
- `GET /api/workouts/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=<IANA>`. Range ≤ 62 days, zod-validated
  (tz validated with `Intl.supportedValuesOf("timeZone")`). Response:
  ```ts
  { data: { days: Array<{
      date: string;                       // local YYYY-MM-DD
      scheduled: Array<{ kind: "program" | "standalone"; id: string; name: string;
                         status: WorkoutStatus; weekNumber?: number; dayNumber?: number }>;
      completedCount: number;
      durationSeconds: number;            // Σ (completedAt − startedAt) of logs completed that day
      volume: number;                     // Σ weight × reps over those logs' sets
  }> } }
  ```
  - Program workouts come from the user's blocks (active + paused) by `scheduledDate`. Names come from
    `program.template.sessions` matched on `dayNumber`. Standalone workouts come by `scheduledDate`.
  - Logs come from **one aggregate query**: `workoutLogs` ⋈ `loggedSets` grouped by local completion date,
    using `AT TIME ZONE`. No N+1.
  - Put the logic in `services/calendar.ts`, with a thin route. Days with nothing return zeros, so the
    client always gets a full range.
- `PATCH /training-blocks/:id`: setting `status: "active"` returns **409** if another block is active.
- Tests: aggregation, tz day-boundary, range validation, ownership (another user's data never appears),
  resume guard.

### PR A2 — Display preferences (S)
- Add `weekStartDay` to `userPreferencesSchema`, the `UserPreferences` / `UpdateUserInput` types, and a
  shared `WEEK_START_DEFAULT = "sunday"`.
- Mobile **Settings → Units & display**: weight unit (lbs/kg) and week start (Sun/Mon), saved via
  `updateUser({ preferences })`. Add a `usePreferences()` hook with the defaults applied.
- Optional: a matching week-start control in web Settings, next to the existing weight-unit toggle.
- Tests: schema accepts and rejects values, hook defaults.

### PR B — Mobile home: week strip + day summary (M–L)
- Foundation: `lib/queries.ts` (query keys + `useCalendar(from, to)`, `useActiveBlock()`), and new API
  methods (`getCalendar`, `getTrainingBlocks({status})`). Also fix the mistyped `getTodaysWorkout`.
- Components: `MonthHeader`, `WeekStrip` (paging FlatList, dots, selected-day state), `DayStats`,
  `ScheduledWorkoutCard` (session name and exercise names via the existing exercise lookup),
  `AdditionalWorkoutsList`.
- Restructure `index.tsx` around the selected day. Keep the existing new-user / no-program state.
- Week boundaries come from `usePreferences().weekStartDay`.
- Tests: pure date helpers (`startOfWeek(date, weekStartDay)`, `weekDays`, local-date formatting) and component render tests
  (`WeekStrip` dots, `DayStats`). Extend the expo-router mock in `jest.setup.cjs` as needed.

### PR C — Mobile program detail (M–L)
- `app/program/[blockId].tsx`, registered in the root Stack.
- Pure `buildBlockSchedule(program, workouts, currentWeek)` → `Week[]` of `Day[]`. It merges real rows
  with template placeholders for future weeks. This is the unit-testable core.
- Components: `WeekPills`, `ProgramDayRow`, `ProgramOverview`, `PlanActionBar` (pause / resume /
  generate-next-week).
- Slim the programs tab's `TrainingBlockProgress` down to a summary card linking here.
- Tests: `buildBlockSchedule` (partial generation, skipped days, program complete) and row render.

## Deferred (tracked, not in this arc)
- **Additional workouts "+" (create and log a standalone workout on mobile).** `workout/[id]` only handles
  program workouts. This needs a standalone logging path; it's a separate arc.
- **Edit plan (per-user).** Today's only editor changes the *global* program template. Per-user edits need
  a block-level override model.
- **Date consistency (audit bug 3).** Week-1 dates use local time, week-2+ use UTC (`week-generation.ts`),
  and `/today` uses the server's date. Fix this alongside PR A if it's small; otherwise its own PR.
- Program cover images and a Resources/Equipment tab.
- Migrating older screens to React Query.

## Critical files
- `apps/server/src/routes/workouts.ts` · new `apps/server/src/services/calendar.ts`
- `apps/mobile/app/(tabs)/index.tsx` · `apps/mobile/app/(tabs)/programs.tsx` · new `apps/mobile/app/program/[blockId].tsx`
- `apps/mobile/components/TrainingBlockProgress.tsx` · `apps/mobile/lib/api.ts` · new `apps/mobile/lib/queries.ts`
- `apps/web/src/lib/queries.ts` (pattern reference)
