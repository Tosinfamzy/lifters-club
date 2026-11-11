import { z } from "zod";
import { db } from "@gymapp/db";
import { trainingBlocks, workouts, programs, standaloneWorkouts, workoutLogs, loggedSets } from "@gymapp/db/schema";
import { and, eq, gte, lte, inArray, isNotNull, sql } from "drizzle-orm";
import type { WorkoutStatus } from "@gymapp/types";

/** Max inclusive span of a calendar request; two months covers any month view plus padding. */
export const MAX_CALENDAR_RANGE_DAYS = 62;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Blocks whose workouts still belong on the user's calendar. */
const CALENDAR_BLOCK_STATUSES = ["active", "paused"] as const;

// Region/City style names only. This rejects UTC offsets like "+05:00", which
// Postgres reads as POSIX offsets (inverted sign) while ICU reads them as ISO.
const IANA_TIME_ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;

const SUPPORTED_TIME_ZONES = new Set(Intl.supportedValuesOf("timeZone"));

/**
 * True for IANA zone names, including the aliases that devices commonly report.
 * Intl.supportedValuesOf lists only ICU's canonical names, which omits zones
 * like "UTC", "Asia/Kolkata" and "Europe/Kyiv". So it is only the fast path,
 * and the DateTimeFormat constructor is the real check.
 */
export function isValidTimeZone(tz: string): boolean {
  if (!IANA_TIME_ZONE_PATTERN.test(tz)) return false;
  if (SUPPORTED_TIME_ZONES.has(tz)) return true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function parseIsoDate(value: string): number {
  return Date.parse(`${value}T00:00:00Z`);
}

/** True when the string is a real calendar date (rejects e.g. 2026-02-30). */
function isRealDate(value: string): boolean {
  const ms = parseIsoDate(value);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine(isRealDate, "Invalid calendar date");

export const calendarQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    tz: z.string().min(1).max(64).refine(isValidTimeZone, "Unknown IANA time zone"),
  })
  .refine((q) => q.from <= q.to, { message: "from must be on or before to", path: ["from"] })
  .refine((q) => countDaysInclusive(q.from, q.to) <= MAX_CALENDAR_RANGE_DAYS, {
    message: `Range must not exceed ${MAX_CALENDAR_RANGE_DAYS} days`,
    path: ["to"],
  });

export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

export interface ScheduledCalendarWorkout {
  kind: "program" | "standalone";
  id: string;
  name: string;
  status: WorkoutStatus;
  weekNumber?: number;
  dayNumber?: number;
}

export interface CalendarDay {
  date: string;
  scheduled: ScheduledCalendarWorkout[];
  completedCount: number;
  durationSeconds: number;
  volume: number;
}

export function countDaysInclusive(from: string, to: string): number {
  return Math.round((parseIsoDate(to) - parseIsoDate(from)) / MS_PER_DAY) + 1;
}

/** Every YYYY-MM-DD from `from` to `to`, inclusive. */
export function enumerateDates(from: string, to: string): string[] {
  const start = parseIsoDate(from);
  return Array.from({ length: countDaysInclusive(from, to) }, (_, i) =>
    new Date(start + i * MS_PER_DAY).toISOString().slice(0, 10)
  );
}

/** Session name from a program template, falling back to "Day N". */
export function resolveSessionName(template: Record<string, unknown>, dayNumber: number): string {
  const sessions: unknown[] = Array.isArray(template.sessions) ? template.sessions : [];
  for (const session of sessions) {
    if (typeof session !== "object" || session === null) continue;
    const { dayNumber: sessionDay, name } = session as { dayNumber?: unknown; name?: unknown };
    if (sessionDay === dayNumber && typeof name === "string" && name.length > 0) return name;
  }
  return `Day ${dayNumber}`;
}

async function fetchProgramWorkouts(userId: string, from: string, to: string) {
  const rows = await db
    .select({
      id: workouts.id,
      scheduledDate: workouts.scheduledDate,
      status: workouts.status,
      weekNumber: workouts.weekNumber,
      dayNumber: workouts.dayNumber,
      template: programs.template,
    })
    .from(workouts)
    .innerJoin(trainingBlocks, eq(workouts.trainingBlockId, trainingBlocks.id))
    .innerJoin(programs, eq(trainingBlocks.programId, programs.id))
    .where(and(
      eq(trainingBlocks.userId, userId),
      inArray(trainingBlocks.status, [...CALENDAR_BLOCK_STATUSES]),
      gte(workouts.scheduledDate, from),
      lte(workouts.scheduledDate, to)
    ))
    .orderBy(workouts.scheduledDate, workouts.dayNumber);

  return rows.map((w) => ({
    date: w.scheduledDate,
    workout: {
      kind: "program" as const,
      id: w.id,
      name: resolveSessionName(w.template, w.dayNumber),
      status: w.status as WorkoutStatus,
      weekNumber: w.weekNumber,
      dayNumber: w.dayNumber,
    },
  }));
}

async function fetchStandaloneWorkouts(userId: string, from: string, to: string) {
  const rows = await db
    .select({
      id: standaloneWorkouts.id,
      name: standaloneWorkouts.name,
      scheduledDate: standaloneWorkouts.scheduledDate,
      status: standaloneWorkouts.status,
    })
    .from(standaloneWorkouts)
    .where(and(
      eq(standaloneWorkouts.userId, userId),
      gte(standaloneWorkouts.scheduledDate, from),
      lte(standaloneWorkouts.scheduledDate, to)
    ))
    .orderBy(standaloneWorkouts.scheduledDate, standaloneWorkouts.createdAt);

  return rows.map((w) => ({
    date: w.scheduledDate,
    workout: { kind: "standalone" as const, id: w.id, name: w.name, status: w.status as WorkoutStatus },
  }));
}

/**
 * The user's completed logs in range, tagged with their local completion date.
 * completed_at is `timestamp without time zone` holding UTC wall-clock time, so
 * it is first marked as UTC and then converted to the user's zone. `tz` is a
 * bound parameter, never interpolated.
 */
function completedLogsInRange({ userId, from, to, tz }: CalendarQuery & { userId: string }) {
  const localDay = sql`((${workoutLogs.completedAt} AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date`;
  return db
    .select({
      id: workoutLogs.id,
      day: sql<string>`${localDay}::text`.as("day"),
      // Clamped at 0: a skewed device clock (e.g. an offline replay) can put
      // completedAt before startedAt, which would subtract from the day's total.
      durationSeconds: sql<number>`greatest(extract(epoch from (${workoutLogs.completedAt} - ${workoutLogs.startedAt})), 0)`
        .as("duration_seconds"),
    })
    .from(workoutLogs)
    .where(and(
      eq(workoutLogs.userId, userId),
      isNotNull(workoutLogs.completedAt),
      sql`${localDay} between ${from}::date and ${to}::date`
    ))
    .as("completed_logs");
}

/**
 * Per-day completion stats. Duration and volume are aggregated in separate
 * queries: joining sets before summing duration would count each log's
 * duration once per set.
 */
async function fetchCompletionStats(query: CalendarQuery & { userId: string }) {
  const logs = completedLogsInRange(query);

  const [durationRows, volumeRows] = await Promise.all([
    db
      .select({
        day: logs.day,
        completedCount: sql<number>`count(*)::int`,
        durationSeconds: sql<number>`coalesce(round(sum(${logs.durationSeconds})), 0)::int`,
      })
      .from(logs)
      .groupBy(logs.day),
    db
      .select({
        day: logs.day,
        volume: sql<number>`coalesce(sum(${loggedSets.weight} * ${loggedSets.reps}), 0)::float8`,
      })
      .from(loggedSets)
      .innerJoin(logs, eq(loggedSets.workoutLogId, logs.id))
      .groupBy(logs.day),
  ]);

  return { durationRows, volumeRows };
}

/**
 * Builds one entry per local date in [from, to]: scheduled workouts from the
 * user's active and paused blocks plus standalone workouts, and the stats of
 * logs completed that day. Days with nothing are zero-filled.
 */
export async function getCalendar(userId: string, query: CalendarQuery): Promise<CalendarDay[]> {
  const { from, to } = query;
  const [programItems, standaloneItems, stats] = await Promise.all([
    fetchProgramWorkouts(userId, from, to),
    fetchStandaloneWorkouts(userId, from, to),
    fetchCompletionStats({ ...query, userId }),
  ]);

  const days = new Map<string, CalendarDay>(
    enumerateDates(from, to).map((date) => [
      date,
      { date, scheduled: [], completedCount: 0, durationSeconds: 0, volume: 0 },
    ])
  );

  for (const { date, workout } of [...programItems, ...standaloneItems]) {
    days.get(date)?.scheduled.push(workout);
  }
  for (const row of stats.durationRows) {
    const day = days.get(row.day);
    if (!day) continue;
    day.completedCount = row.completedCount;
    day.durationSeconds = row.durationSeconds;
  }
  for (const row of stats.volumeRows) {
    const day = days.get(row.day);
    if (day) day.volume = row.volume;
  }

  return [...days.values()];
}
