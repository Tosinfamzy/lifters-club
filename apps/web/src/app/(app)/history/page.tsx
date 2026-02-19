"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Dumbbell, ArrowRight, Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAppUser } from "@/providers/user-provider";
import { useApi } from "@/lib/use-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type { WorkoutLog, WorkoutLogWithSets } from "@/lib/api";
import {
  WorkoutDrawer,
  HistoryFilters,
  type HistoryFiltersType,
  ExportDialog,
  LogWorkoutDialog,
} from "@/components/history";
import { formatRelativeDate } from "@/lib/format";

function calculateDuration(startedAt: string, completedAt?: string): number | null {
  if (!completedAt) return null;
  const start = new Date(startedAt);
  const end = new Date(completedAt);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

export default function HistoryPage() {
  const { appUser, isLoading: isUserLoading } = useAppUser();
  const api = useApi();
  const queryClient = useQueryClient();

  const userId = appUser?.id;

  // Initial data load via React Query
  const { data: initialLogs, isLoading } = useQuery({
    queryKey: queryKeys.history.logs(userId ?? ""),
    queryFn: async () => {
      const response = await api.getWorkoutLogs({
        userId: userId!,
        limit: DEFAULT_PAGE_SIZE,
      });
      return response.data || [];
    },
    enabled: !!userId,
  });

  // Local state for pagination beyond the initial query
  const [extraLogs, setExtraLogs] = useState<WorkoutLog[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WorkoutLogWithSets | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<HistoryFiltersType>({
    sortBy: "date",
    sortOrder: "desc",
  });

  // Set hasMore based on initial data length
  useEffect(() => {
    if (initialLogs && initialLogs.length === DEFAULT_PAGE_SIZE) {
      setHasMore(true);
    }
  }, [initialLogs]);

  // Combine initial (cached) logs with any extra pages
  const workoutLogs = useMemo(() => {
    return [...(initialLogs || []), ...extraLogs];
  }, [initialLogs, extraLogs]);

  const handleLoadMore = useCallback(async () => {
    if (!userId || isLoadingMore) return;

    setIsLoadingMore(true);
    const newOffset = offset === 0 ? DEFAULT_PAGE_SIZE : offset + DEFAULT_PAGE_SIZE;
    try {
      const response = await api.getWorkoutLogs({
        userId,
        limit: DEFAULT_PAGE_SIZE,
        offset: newOffset,
      });
      const results = response.data || [];
      setExtraLogs((prev) => [...prev, ...results]);
      setOffset(newOffset);
      setHasMore(results.length === DEFAULT_PAGE_SIZE);
    } catch (error) {
      console.error("Failed to load more workouts:", error);
      toast.error("Failed to load more workouts");
    } finally {
      setIsLoadingMore(false);
    }
  }, [userId, api, offset, isLoadingMore]);

  const refreshLogs = useCallback(() => {
    if (!userId) return;
    setExtraLogs([]);
    setOffset(0);
    setHasMore(false);
    queryClient.invalidateQueries({ queryKey: queryKeys.history.logs(userId) });
  }, [userId, queryClient]);

  const handleViewWorkout = async (log: WorkoutLog) => {
    try {
      const response = await api.getWorkoutLog(log.id);
      setSelectedLog(response.data);
      setDrawerOpen(true);
    } catch (error) {
      console.error("Failed to fetch workout details:", error);
      toast.error("Failed to load workout details");
    }
  };

  const handleUpdate = async () => {
    if (selectedLog) {
      try {
        const response = await api.getWorkoutLog(selectedLog.id);
        setSelectedLog(response.data);
      } catch (error) {
        console.error("Failed to refresh workout details:", error);
      }
    }
    refreshLogs();
  };

  const completedLogs = workoutLogs.filter((log) => log.completedAt);

  // Apply filters
  const filteredAndSortedLogs = useMemo(() => {
    let filtered = [...completedLogs];

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(
        (log) => new Date(log.completedAt!) >= fromDate
      );
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (log) => new Date(log.completedAt!) <= toDate
      );
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case "date":
          comparison =
            new Date(a.completedAt!).getTime() -
            new Date(b.completedAt!).getTime();
          break;
        case "duration": {
          const durationA = calculateDuration(a.startedAt, a.completedAt) || 0;
          const durationB = calculateDuration(b.startedAt, b.completedAt) || 0;
          comparison = durationA - durationB;
          break;
        }
        case "rpe":
          comparison = (a.overallRpe || 0) - (b.overallRpe || 0);
          break;
      }
      return filters.sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [completedLogs, filters]);

  // Stats calculations
  const stats = useMemo(() => {
    const thisWeek = completedLogs.filter((log) => {
      const date = new Date(log.completedAt!);
      const now = new Date();
      const diffDays = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays < 7;
    });

    const logsWithRpe = completedLogs.filter((log) => log.overallRpe);
    const avgRpe =
      logsWithRpe.length > 0
        ? logsWithRpe.reduce((sum, log) => sum + (log.overallRpe || 0), 0) /
          logsWithRpe.length
        : null;

    return {
      total: completedLogs.length,
      thisWeek: thisWeek.length,
      avgRpe,
    };
  }, [completedLogs]);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Workout History</h1>
            <p className="text-muted-foreground">
              Review and edit your past training sessions
            </p>
          </div>
          <div className="flex gap-2">
            <LogWorkoutDialog onSuccess={refreshLogs} />
            <ExportDialog workouts={filteredAndSortedLogs} />
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Workouts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">completed sessions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.thisWeek}</div>
              <p className="text-xs text-muted-foreground">workouts this week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Average RPE</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.avgRpe?.toFixed(1) || "\u2014"}
              </div>
              <p className="text-xs text-muted-foreground">average intensity</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <HistoryFilters onFiltersChange={setFilters} />
          </CardContent>
        </Card>

        {/* Workout List */}
        <Card>
          <CardHeader>
            <CardTitle>Workout Sessions</CardTitle>
            <CardDescription>
              {filteredAndSortedLogs.length > 0
                ? `Showing ${filteredAndSortedLogs.length} workout${filteredAndSortedLogs.length !== 1 ? "s" : ""}`
                : "No workouts match your filters"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {completedLogs.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="font-medium">No workout history yet</p>
                  <p className="text-sm text-muted-foreground">
                    Start a program to begin tracking your workouts
                  </p>
                </div>
                <Button asChild>
                  <Link href="/programs">
                    Browse Programs
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : filteredAndSortedLogs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No workouts match your current filters
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAndSortedLogs.map((log) => {
                  const duration = calculateDuration(log.startedAt, log.completedAt);
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between rounded-lg bg-secondary p-4 transition-colors hover:bg-secondary/80"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">Workout Session</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatRelativeDate(log.completedAt!)}
                          </span>
                          {duration && <span>{duration} min</span>}
                          {log.overallRpe && (
                            <span className="text-primary">RPE {log.overallRpe}</span>
                          )}
                        </div>
                        {log.notes && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {log.notes}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewWorkout(log)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View & Edit
                      </Button>
                    </div>
                  );
                })}

                {/* Load More */}
                {hasMore && (
                  <div className="pt-4 text-center">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load More"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workout Detail Drawer */}
        <WorkoutDrawer
          log={selectedLog}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onUpdate={handleUpdate}
        />
      </div>
  );
}
