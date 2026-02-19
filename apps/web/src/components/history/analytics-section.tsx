"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VolumeChart } from "@/components/charts";
import { TrendingUp, Dumbbell, Clock, BarChart3 } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { toast } from "sonner";
import { formatRelativeDate } from "@/lib/format";
import type { VolumeWeekData } from "@/lib/api";

interface SummaryData {
  totalWorkouts: number;
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  averageRpe: number | null;
  averageDuration: number | null;
  currentStreak: number;
  lastWorkout: string | null;
}

interface AnalyticsSectionProps {
  userId: string;
}

export function AnalyticsSection({ userId }: AnalyticsSectionProps) {
  const api = useApi();
  const [volumeData, setVolumeData] = useState<VolumeWeekData[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchAnalytics() {
      try {
        const [volumeResult, summaryResult] = await Promise.allSettled([
          api.getVolumeAnalytics(userId, 8),
          api.getAnalyticsSummary(userId),
        ]);

        if (cancelled) return;

        if (volumeResult.status === "fulfilled") {
          setVolumeData(volumeResult.value.data?.weeks || []);
        }

        if (summaryResult.status === "fulfilled") {
          setSummary(summaryResult.value.data || null);
        }
      } catch {
        if (!cancelled) {
          toast.error("Failed to load analytics");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchAnalytics();
    return () => { cancelled = true; };
  }, [userId, api]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-20 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
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
              <div className="text-2xl font-bold">{summary.workoutsThisMonth}</div>
              <p className="text-xs text-muted-foreground">workouts completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
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
              <p className="text-xs text-muted-foreground">training intensity</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Volume Chart */}
      <VolumeChart weeks={volumeData} />

      {/* All Time Stats */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>All Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold">{summary.totalWorkouts}</div>
                <div className="text-sm text-muted-foreground">Total Workouts</div>
              </div>
              {summary.lastWorkout && (
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {formatRelativeDate(summary.lastWorkout)}
                  </div>
                  <div className="text-sm text-muted-foreground">Last Workout</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
