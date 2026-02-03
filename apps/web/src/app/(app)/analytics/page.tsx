"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  VolumeChart,
  FrequencyHeatmap,
  RpeTrendsChart,
  PersonalRecords,
  StrengthProgress,
} from "@/components/charts";
import { useAppUser } from "@/providers/user-provider";
import { TrendingUp, Dumbbell, Clock, BarChart3, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface WeekData {
  weekStart: string;
  totalVolume: number;
  workoutCount: number;
  setCount: number;
}

interface SummaryData {
  totalWorkouts: number;
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  averageRpe: number | null;
  averageDuration: number | null;
  currentStreak: number;
  lastWorkout: string | null;
}

interface WorkoutDay {
  date: string;
  workoutCount: number;
}

interface RpeDataPoint {
  date: string;
  rpe: number;
}

interface PersonalRecord {
  exerciseId: string;
  exerciseName?: string;
  weightPR: {
    weight: number;
    reps: number;
    date: string;
  } | null;
  volumePR: {
    weight: number;
    reps: number;
    volume: number;
    date: string;
  } | null;
}

interface Exercise {
  id: string;
  name: string;
}

export default function AnalyticsPage() {
  const { appUser, isLoading: isUserLoading } = useAppUser();
  const { getToken } = useAuth();

  const [volumeData, setVolumeData] = useState<WeekData[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [rpeData, setRpeData] = useState<RpeDataPoint[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!appUser?.id) return;

    const userId = appUser.id;

    async function fetchAllAnalytics() {
      setIsLoading(true);

      try {
        const token = await getToken();
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        // Fetch all analytics data in parallel
        const [volumeRes, summaryRes, logsRes, prsRes, exercisesRes] =
          await Promise.all([
            fetch(
              `${API_URL}/api/analytics/volume?userId=${userId}&weeks=12`,
              { headers }
            ),
            fetch(`${API_URL}/api/analytics/summary?userId=${userId}`, {
              headers,
            }),
            fetch(
              `${API_URL}/api/logs?userId=${userId}&limit=50`,
              { headers }
            ),
            fetch(
              `${API_URL}/api/analytics/personal-records?userId=${userId}`,
              { headers }
            ),
            fetch(`${API_URL}/api/exercises?limit=50`), // Public endpoint
          ]);

        // Process volume data
        if (volumeRes.ok) {
          const data = await volumeRes.json();
          setVolumeData(data.data?.weeks || []);

          // Convert to workout days for heatmap
          const days: WorkoutDay[] = (data.data?.weeks || []).flatMap(
            (week: WeekData) => {
              // Create days for this week based on workout count
              // This is a simplified approach - ideally we'd have daily data
              const weekDays: WorkoutDay[] = [];
              if (week.workoutCount > 0) {
                const startDate = new Date(week.weekStart);
                for (let i = 0; i < week.workoutCount && i < 7; i++) {
                  const dayDate = new Date(startDate);
                  dayDate.setDate(startDate.getDate() + i * 2); // Spread workouts
                  weekDays.push({
                    date: dayDate.toISOString(),
                    workoutCount: 1,
                  });
                }
              }
              return weekDays;
            }
          );
          setWorkoutDays(days);
        }

        // Process summary
        if (summaryRes.ok) {
          const data = await summaryRes.json();
          setSummary(data.data || null);
        }

        // Process logs for RPE data
        if (logsRes.ok) {
          const data = await logsRes.json();
          const logs = data.data || [];
          const rpePoints: RpeDataPoint[] = logs
            .filter(
              (log: { completedAt?: string; overallRpe?: number }) =>
                log.completedAt && log.overallRpe
            )
            .map((log: { completedAt: string; overallRpe: number }) => ({
              date: log.completedAt,
              rpe: log.overallRpe,
            }))
            .reverse(); // Oldest first for chart
          setRpeData(rpePoints);
        }

        // Process personal records
        if (prsRes.ok) {
          const data = await prsRes.json();
          setPersonalRecords(data.data?.records || []);
        }

        // Process exercises for strength progress selector
        if (exercisesRes.ok) {
          const data = await exercisesRes.json();
          setExercises(data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAllAnalytics();
  }, [appUser?.id, getToken]);

  if (isUserLoading || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track your training progress and performance metrics
          </p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Current Streak
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.currentStreak}</div>
                <p className="text-xs text-muted-foreground">consecutive days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <Dumbbell className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.workoutsThisMonth}
                </div>
                <p className="text-xs text-muted-foreground">
                  workouts completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Duration
                </CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.averageDuration ? `${summary.averageDuration}m` : "—"}
                </div>
                <p className="text-xs text-muted-foreground">per workout</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Average RPE</CardTitle>
                <BarChart3 className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.averageRpe?.toFixed(1) || "—"}
                </div>
                <p className="text-xs text-muted-foreground">
                  training intensity
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Row 1 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <VolumeChart weeks={volumeData} />
          <FrequencyHeatmap workouts={workoutDays} weeks={12} />
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RpeTrendsChart data={rpeData} />
          <PersonalRecords records={personalRecords} />
        </div>

        {/* Strength Progress */}
        <StrengthProgress
          userId={appUser?.id || ""}
          exercises={exercises}
          getToken={getToken}
        />

        {/* All Time Stats */}
        {summary && (
          <Card>
            <CardHeader>
              <CardTitle>All Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {summary.totalWorkouts}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Workouts
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {summary.workoutsThisWeek}
                  </div>
                  <div className="text-sm text-muted-foreground">This Week</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {volumeData.reduce((sum, w) => sum + w.setCount, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Sets (12w)
                  </div>
                </div>
                {summary.lastWorkout && (
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      {formatRelativeDate(summary.lastWorkout)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Last Workout
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
  );
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
