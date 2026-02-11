import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { workoutLogs, loggedSets } from "@gymapp/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import type { Env } from "../types";
import { getAuthenticatedUserFromContext } from "../middleware/authorize";
import {
  MS_PER_DAY,
  MS_PER_WEEK,
  VOLUME_HIGHLIGHT_THRESHOLD,
  SETS_HIGHLIGHT_THRESHOLD,
  OPTIMAL_RPE_MIN,
  OPTIMAL_RPE_MAX,
} from "../constants";

const analyticsRoutes = new Hono<Env>();

// userId is now optional - if not provided, use authenticated user's ID
const userQuerySchema = z.object({
  userId: z.string().min(1).optional(),
});

// GET /analytics/exercise/:exerciseId/progress - Get exercise progress over time (requires ownership)
analyticsRoutes.get(
  "/exercise/:exerciseId/progress",
  zValidator("query", userQuerySchema.extend({
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })),
  async (c) => {
    const exerciseId = c.req.param("exerciseId");
    const { userId: queryUserId, limit } = c.req.valid("query");

    // Get authenticated user - use query userId if provided and valid, otherwise use authenticated user
    const authResult = await getAuthenticatedUserFromContext(c);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // If userId provided in query, verify it matches authenticated user
    if (queryUserId && queryUserId !== authResult.user.id) {
      return c.json({ error: "Forbidden: You can only access your own data" }, 403);
    }

    const userId = authResult.user.id;

    // Get all sets for this exercise, grouped by workout date
    const sets = await db
      .select({
        weight: loggedSets.weight,
        reps: loggedSets.reps,
        rpe: loggedSets.rpe,
        date: workoutLogs.startedAt,
        logId: workoutLogs.id,
      })
      .from(loggedSets)
      .innerJoin(workoutLogs, eq(loggedSets.workoutLogId, workoutLogs.id))
      .where(and(
        eq(loggedSets.exerciseId, exerciseId),
        eq(workoutLogs.userId, userId)
      ))
      .orderBy(desc(workoutLogs.startedAt));

    // Group by workout session and calculate best set per session
    const sessionMap = new Map<string, {
      date: Date;
      bestWeight: number;
      bestVolume: number;
      totalSets: number;
      rpeSum: number;
      rpeCount: number;
    }>();

    for (const set of sets) {
      const existing = sessionMap.get(set.logId);
      const volume = set.weight * set.reps;

      if (!existing) {
        sessionMap.set(set.logId, {
          date: set.date,
          bestWeight: set.weight,
          bestVolume: volume,
          totalSets: 1,
          rpeSum: set.rpe ?? 0,
          rpeCount: set.rpe !== null ? 1 : 0,
        });
      } else {
        existing.bestWeight = Math.max(existing.bestWeight, set.weight);
        existing.bestVolume = Math.max(existing.bestVolume, volume);
        existing.totalSets += 1;
        if (set.rpe !== null) {
          existing.rpeSum += set.rpe;
          existing.rpeCount += 1;
        }
      }
    }

    // Convert to array and limit
    const progress = Array.from(sessionMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-limit);

    return c.json({
      data: {
        exerciseId,
        sessions: progress.map(s => ({
          date: s.date.toISOString(),
          bestWeight: s.bestWeight,
          bestVolume: s.bestVolume,
          totalSets: s.totalSets,
          avgRpe: s.rpeCount > 0 ? Number((s.rpeSum / s.rpeCount).toFixed(1)) : null,
        })),
      },
    });
  }
);

// GET /analytics/volume - Get weekly volume data (requires ownership)
analyticsRoutes.get(
  "/volume",
  zValidator("query", userQuerySchema.extend({
    weeks: z.coerce.number().int().min(1).max(52).default(8),
  })),
  async (c) => {
    const { userId: queryUserId, weeks } = c.req.valid("query");

    // Get authenticated user
    const authResult = await getAuthenticatedUserFromContext(c);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // If userId provided in query, verify it matches authenticated user
    if (queryUserId && queryUserId !== authResult.user.id) {
      return c.json({ error: "Forbidden: You can only access your own data" }, 403);
    }

    const userId = authResult.user.id;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);

    const logs = await db
      .select({
        date: workoutLogs.startedAt,
        logId: workoutLogs.id,
      })
      .from(workoutLogs)
      .where(and(
        eq(workoutLogs.userId, userId),
        gte(workoutLogs.startedAt, startDate)
      ))
      .orderBy(workoutLogs.startedAt);

    // Get all sets for these logs
    const logIds = logs.map(l => l.logId);

    if (logIds.length === 0) {
      return c.json({
        data: {
          weeks: [],
        },
      });
    }

    const sets = await db
      .select({
        workoutLogId: loggedSets.workoutLogId,
        weight: loggedSets.weight,
        reps: loggedSets.reps,
      })
      .from(loggedSets)
      .where(sql`${loggedSets.workoutLogId} IN ${logIds}`);

    // Build volume per log
    const volumeByLog = new Map<string, number>();
    for (const set of sets) {
      const current = volumeByLog.get(set.workoutLogId) || 0;
      volumeByLog.set(set.workoutLogId, current + set.weight * set.reps);
    }

    // Group by week
    const weeklyData = new Map<string, {
      weekStart: Date;
      totalVolume: number;
      workoutCount: number;
      setCount: number;
    }>();

    // Pre-build set count map to avoid O(n*m) filtering
    const setCountByLog = new Map<string, number>();
    for (const set of sets) {
      setCountByLog.set(set.workoutLogId, (setCountByLog.get(set.workoutLogId) ?? 0) + 1);
    }

    for (const log of logs) {
      const date = new Date(log.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      const weekKey = weekStart.toISOString().split("T")[0]!;

      const existing = weeklyData.get(weekKey);
      const volume = volumeByLog.get(log.logId) || 0;
      const logSets = setCountByLog.get(log.logId) ?? 0;

      if (!existing) {
        weeklyData.set(weekKey, {
          weekStart,
          totalVolume: volume,
          workoutCount: 1,
          setCount: logSets,
        });
      } else {
        existing.totalVolume += volume;
        existing.workoutCount += 1;
        existing.setCount += logSets;
      }
    }

    const weeksArray = Array.from(weeklyData.values())
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

    return c.json({
      data: {
        weeks: weeksArray.map(w => ({
          weekStart: w.weekStart.toISOString().split("T")[0],
          totalVolume: Math.round(w.totalVolume),
          workoutCount: w.workoutCount,
          setCount: w.setCount,
        })),
      },
    });
  }
);

// GET /analytics/personal-records - Get personal records for each exercise (requires ownership)
analyticsRoutes.get(
  "/personal-records",
  zValidator("query", userQuerySchema),
  async (c) => {
    const { userId: queryUserId } = c.req.valid("query");

    // Get authenticated user
    const authResult = await getAuthenticatedUserFromContext(c);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // If userId provided in query, verify it matches authenticated user
    if (queryUserId && queryUserId !== authResult.user.id) {
      return c.json({ error: "Forbidden: You can only access your own data" }, 403);
    }

    const userId = authResult.user.id;

    // Compute weight PRs and volume PRs per exercise using SQL
    const weightPRs = await db.execute<{
      exercise_id: string;
      max_weight: number;
      max_weight_reps: number;
      max_weight_date: Date;
    }>(sql`
      SELECT DISTINCT ON (ls.exercise_id)
        ls.exercise_id,
        ls.weight AS max_weight,
        ls.reps AS max_weight_reps,
        wl.started_at AS max_weight_date
      FROM training.logged_sets ls
      INNER JOIN training.workout_logs wl ON ls.workout_log_id = wl.id
      WHERE wl.user_id = ${userId}
      ORDER BY ls.exercise_id, ls.weight DESC, ls.reps DESC
    `);

    const volumePRs = await db.execute<{
      exercise_id: string;
      max_volume: number;
      max_volume_weight: number;
      max_volume_reps: number;
      max_volume_date: Date;
    }>(sql`
      SELECT DISTINCT ON (ls.exercise_id)
        ls.exercise_id,
        (ls.weight * ls.reps) AS max_volume,
        ls.weight AS max_volume_weight,
        ls.reps AS max_volume_reps,
        wl.started_at AS max_volume_date
      FROM training.logged_sets ls
      INNER JOIN training.workout_logs wl ON ls.workout_log_id = wl.id
      WHERE wl.user_id = ${userId}
      ORDER BY ls.exercise_id, (ls.weight * ls.reps) DESC
    `);

    // Merge weight and volume PRs
    const volumeMap = new Map(volumePRs.map(v => [v.exercise_id, v]));

    const records = weightPRs.map(w => {
      const v = volumeMap.get(w.exercise_id);
      return {
        exerciseId: w.exercise_id,
        weightPR: {
          weight: Number(w.max_weight),
          reps: Number(w.max_weight_reps),
          date: new Date(w.max_weight_date).toISOString(),
        },
        volumePR: v ? {
          weight: Number(v.max_volume_weight),
          reps: Number(v.max_volume_reps),
          volume: Number(v.max_volume),
          date: new Date(v.max_volume_date).toISOString(),
        } : {
          weight: Number(w.max_weight),
          reps: Number(w.max_weight_reps),
          volume: Number(w.max_weight) * Number(w.max_weight_reps),
          date: new Date(w.max_weight_date).toISOString(),
        },
      };
    });

    return c.json({
      data: {
        records: records.sort((a, b) => a.exerciseId.localeCompare(b.exerciseId)),
      },
    });
  }
);

// GET /analytics/summary - Get overall training summary (requires ownership)
analyticsRoutes.get(
  "/summary",
  zValidator("query", userQuerySchema),
  async (c) => {
    const { userId: queryUserId } = c.req.valid("query");

    // Get authenticated user
    const authResult = await getAuthenticatedUserFromContext(c);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // If userId provided in query, verify it matches authenticated user
    if (queryUserId && queryUserId !== authResult.user.id) {
      return c.json({ error: "Forbidden: You can only access your own data" }, 403);
    }

    const userId = authResult.user.id;

    // Calculate stats
    const now = new Date();

    // Efficient aggregate for total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(workoutLogs)
      .where(and(eq(workoutLogs.userId, userId), sql`${workoutLogs.completedAt} IS NOT NULL`));
    const totalWorkouts = Number(countResult[0]?.count ?? 0);

    // Only fetch recent logs for weekly/monthly counts and streak calculation
    const ninetyDaysAgo = new Date(now.getTime() - 90 * MS_PER_DAY);
    const logs = await db
      .select({
        id: workoutLogs.id,
        startedAt: workoutLogs.startedAt,
        completedAt: workoutLogs.completedAt,
        overallRpe: workoutLogs.overallRpe,
      })
      .from(workoutLogs)
      .where(and(eq(workoutLogs.userId, userId), gte(workoutLogs.startedAt, ninetyDaysAgo)))
      .orderBy(desc(workoutLogs.startedAt));

    const completedLogs = logs.filter(l => l.completedAt);
    const oneWeekAgo = new Date(now.getTime() - MS_PER_WEEK);
    const oneMonthAgo = new Date(now.getTime() - 30 * MS_PER_DAY);

    const workoutsThisWeek = completedLogs.filter(l =>
      l.completedAt && new Date(l.completedAt) >= oneWeekAgo
    ).length;

    const workoutsThisMonth = completedLogs.filter(l =>
      l.completedAt && new Date(l.completedAt) >= oneMonthAgo
    ).length;

    const logsWithRpe = completedLogs.filter(l => l.overallRpe !== null);
    const avgRpe = logsWithRpe.length > 0
      ? logsWithRpe.reduce((sum, l) => sum + (l.overallRpe || 0), 0) / logsWithRpe.length
      : null;

    // Calculate average duration
    const durations = completedLogs
      .filter(l => l.completedAt)
      .map(l => {
        const start = new Date(l.startedAt);
        const end = new Date(l.completedAt!);
        return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
      });

    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : null;

    // Current streak
    let currentStreak = 0;
    const sortedLogs = [...completedLogs].sort((a, b) =>
      new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
    );

    if (sortedLogs.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let checkDate = today;
      for (const log of sortedLogs) {
        const logDate = new Date(log.completedAt!);
        logDate.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((checkDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 1) {
          currentStreak++;
          checkDate = logDate;
        } else {
          break;
        }
      }
    }

    return c.json({
      data: {
        totalWorkouts,
        workoutsThisWeek,
        workoutsThisMonth,
        averageRpe: avgRpe ? Number(avgRpe.toFixed(1)) : null,
        averageDuration: avgDuration ? Math.round(avgDuration) : null,
        currentStreak,
        lastWorkout: completedLogs[0]?.completedAt?.toISOString() || null,
      },
    });
  }
);

// GET /analytics/weekly-summary - Get detailed weekly training summary (requires ownership)
analyticsRoutes.get(
  "/weekly-summary",
  zValidator("query", userQuerySchema.extend({
    weekOffset: z.coerce.number().int().min(0).max(52).default(0), // 0 = current week, 1 = last week, etc.
  })),
  async (c) => {
    const { userId: queryUserId, weekOffset } = c.req.valid("query");

    // Get authenticated user
    const authResult = await getAuthenticatedUserFromContext(c);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // If userId provided in query, verify it matches authenticated user
    if (queryUserId && queryUserId !== authResult.user.id) {
      return c.json({ error: "Forbidden: You can only access your own data" }, 403);
    }

    const userId = authResult.user.id;

    // Calculate week boundaries
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() - (weekOffset * 7)); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Get workout logs for this week
    const logs = await db
      .select({
        id: workoutLogs.id,
        startedAt: workoutLogs.startedAt,
        completedAt: workoutLogs.completedAt,
        overallRpe: workoutLogs.overallRpe,
      })
      .from(workoutLogs)
      .where(and(
        eq(workoutLogs.userId, userId),
        gte(workoutLogs.startedAt, startOfWeek),
        lte(workoutLogs.startedAt, endOfWeek)
      ))
      .orderBy(workoutLogs.startedAt);

    const completedLogs = logs.filter(l => l.completedAt);

    if (completedLogs.length === 0) {
      return c.json({
        data: {
          weekStart: startOfWeek.toISOString().split("T")[0],
          weekEnd: endOfWeek.toISOString().split("T")[0],
          workoutCount: 0,
          totalVolume: 0,
          totalSets: 0,
          averageRpe: null,
          averageDuration: null,
          exerciseBreakdown: [],
          dayBreakdown: [],
          highlights: [],
        },
      });
    }

    // Get all sets for these logs
    const logIds = completedLogs.map(l => l.id);
    const sets = await db
      .select({
        workoutLogId: loggedSets.workoutLogId,
        exerciseId: loggedSets.exerciseId,
        weight: loggedSets.weight,
        reps: loggedSets.reps,
        rpe: loggedSets.rpe,
      })
      .from(loggedSets)
      .where(sql`${loggedSets.workoutLogId} IN ${logIds}`);

    // Calculate total volume and sets
    let totalVolume = 0;
    const exerciseVolume = new Map<string, { volume: number; sets: number; maxWeight: number }>();

    for (const set of sets) {
      const volume = set.weight * set.reps;
      totalVolume += volume;

      const existing = exerciseVolume.get(set.exerciseId);
      if (!existing) {
        exerciseVolume.set(set.exerciseId, {
          volume,
          sets: 1,
          maxWeight: set.weight,
        });
      } else {
        existing.volume += volume;
        existing.sets += 1;
        existing.maxWeight = Math.max(existing.maxWeight, set.weight);
      }
    }

    // Calculate average RPE
    const logsWithRpe = completedLogs.filter(l => l.overallRpe !== null);
    const averageRpe = logsWithRpe.length > 0
      ? logsWithRpe.reduce((sum, l) => sum + (l.overallRpe || 0), 0) / logsWithRpe.length
      : null;

    // Calculate average duration
    const durations = completedLogs
      .filter(l => l.completedAt)
      .map(l => {
        const start = new Date(l.startedAt);
        const end = new Date(l.completedAt!);
        return (end.getTime() - start.getTime()) / (1000 * 60);
      });

    const averageDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : null;

    // Day breakdown
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayBreakdown = dayNames.map((name, index) => {
      const dayLogs = completedLogs.filter(l => {
        const logDate = new Date(l.completedAt!);
        return logDate.getDay() === index;
      });
      return {
        day: name,
        workouts: dayLogs.length,
        trained: dayLogs.length > 0,
      };
    });

    // Exercise breakdown (top 5 by volume)
    const exerciseBreakdown = Array.from(exerciseVolume.entries())
      .map(([exerciseId, data]) => ({
        exerciseId,
        totalVolume: Math.round(data.volume),
        totalSets: data.sets,
        maxWeight: data.maxWeight,
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 5);

    // Generate highlights
    const highlights: string[] = [];

    if (completedLogs.length >= 3) {
      highlights.push(`Completed ${completedLogs.length} workouts this week!`);
    }

    if (totalVolume > VOLUME_HIGHLIGHT_THRESHOLD) {
      highlights.push(`Moved over ${Math.round(totalVolume / 1000)}k lbs total volume`);
    }

    if (sets.length > SETS_HIGHLIGHT_THRESHOLD) {
      highlights.push(`Logged ${sets.length} sets this week`);
    }

    if (averageRpe && averageRpe >= OPTIMAL_RPE_MIN && averageRpe <= OPTIMAL_RPE_MAX) {
      highlights.push("Training intensity in optimal range");
    }

    return c.json({
      data: {
        weekStart: startOfWeek.toISOString().split("T")[0],
        weekEnd: endOfWeek.toISOString().split("T")[0],
        workoutCount: completedLogs.length,
        totalVolume: Math.round(totalVolume),
        totalSets: sets.length,
        averageRpe: averageRpe ? Number(averageRpe.toFixed(1)) : null,
        averageDuration: averageDuration ? Math.round(averageDuration) : null,
        exerciseBreakdown,
        dayBreakdown,
        highlights,
      },
    });
  }
);

export { analyticsRoutes };
