"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dumbbell,
  TrendingUp,
  Calendar,
  Target,
  ArrowRight,
  BarChart3,
  History,
  Brain,
  Loader2,
  CheckCircle,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import { useAppUser } from "@/providers/user-provider";
import { useApi } from "@/lib/use-api";
import {
  WeeklySummary,
  TodaysWorkoutCard,
  RecentWorkoutsCard,
} from "@/components/dashboard";
import { TrainingBlockProgress } from "@/components/programs/training-block-progress";
import type {
  Workout,
  TrainingBlock,
  Program,
  Decision,
  TodaysWorkoutResponse,
} from "@/lib/api";

interface SummaryData {
  totalWorkouts: number;
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  averageRpe: number | null;
  averageDuration: number | null;
  currentStreak: number;
  lastWorkout: string | null;
}

export default function DashboardPage() {
  const { appUser, isLoading: isUserLoading } = useAppUser();
  const { user: clerkUser } = useUser();
  const api = useApi();

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [trainingBlock, setTrainingBlock] = useState<TrainingBlock | null>(null);
  const [blockProgram, setBlockProgram] = useState<Program | null>(null);
  const [blockWorkouts, setBlockWorkouts] = useState<Workout[]>([]);
  const [todaysWorkout, setTodaysWorkout] = useState<TodaysWorkoutResponse | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTodayLoading, setIsTodayLoading] = useState(true);
  const [isRecentLoading, setIsRecentLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState(true);

  const fetchDashboardData = useCallback(async (cancelled: { current: boolean }) => {
    if (!appUser?.id) {
      setIsLoading(false);
      setIsTodayLoading(false);
      setIsRecentLoading(false);
      return;
    }

    setIsLoading(true);
    setIsTodayLoading(true);
    setIsRecentLoading(true);

    try {
      // Fetch all data in parallel
      const [
        blocksResult,
        decisionsResult,
        todayResult,
        recentResult,
      ] = await Promise.allSettled([
        api.getTrainingBlocks(appUser.id, "active"),
        api.getDecisionHistory({ userId: appUser.id, limit: 3 }),
        api.getTodaysWorkout(appUser.id),
        api.getRecentWorkouts(appUser.id, 5),
      ]);

      if (cancelled.current) return;

      // Handle training blocks
      if (blocksResult.status === "fulfilled") {
        const blocks = blocksResult.value.data || [];
        if (blocks.length > 0) {
          const block = blocks[0] ?? null;
          setTrainingBlock(block);

          // Fetch program and workouts for the training block
          if (block) {
            try {
              const [blockDetails, workoutsResult] = await Promise.all([
                api.getTrainingBlock(block.id),
                api.getWorkouts({ trainingBlockId: block.id }),
              ]);

              if (cancelled.current) return;

              if (blockDetails.data.program) {
                setBlockProgram(blockDetails.data.program);
              }
              if (workoutsResult.data) {
                setBlockWorkouts(workoutsResult.data);
              }
            } catch {
              // Continue without block details
            }
          }
        }
        setApiConnected(true);
      }

      if (cancelled.current) return;

      // Handle decisions
      if (decisionsResult.status === "fulfilled") {
        setDecisions(decisionsResult.value.data || []);
      }

      // Handle today's workout
      if (todayResult.status === "fulfilled") {
        setTodaysWorkout(todayResult.value.data || null);
      }
      setIsTodayLoading(false);

      // Handle recent workouts
      if (recentResult.status === "fulfilled") {
        setRecentWorkouts(recentResult.value.data || []);
      }
      setIsRecentLoading(false);

      // Fetch summary using the API client
      try {
        const summaryResponse = await api.getAnalyticsSummary(appUser.id);
        if (!cancelled.current) {
          setSummary(summaryResponse.data || null);
        }
      } catch {
        // Summary fetch failed, continue without it
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      if (!cancelled.current) {
        setApiConnected(false);
        toast.error("Failed to load dashboard data");
      }
    } finally {
      if (!cancelled.current) {
        setIsLoading(false);
        setIsTodayLoading(false);
        setIsRecentLoading(false);
      }
    }
  }, [appUser?.id, api]);

  useEffect(() => {
    const cancelled = { current: false };
    fetchDashboardData(cancelled);
    return () => {
      cancelled.current = true;
    };
  }, [fetchDashboardData]);

  // Wrapper for external callers (e.g., onWeekGenerated) that don't manage cancellation
  const refreshDashboard = useCallback(() => {
    fetchDashboardData({ current: false });
  }, [fetchDashboardData]);

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getDecisionIcon = (type: string) => {
    switch (type) {
      case "load_progression":
        return <TrendingUp className="h-4 w-4" />;
      case "volume":
      case "volume_adjustment":
        return <BarChart3 className="h-4 w-4" />;
      case "recovery":
      case "session_recovery":
        return <Clock className="h-4 w-4" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };

  const getDecisionTitle = (type: string) => {
    switch (type) {
      case "load_progression":
        return "Weight Adjustment";
      case "volume":
      case "volume_adjustment":
        return "Volume Change";
      case "recovery":
      case "session_recovery":
        return "Recovery Adjustment";
      case "deload":
      case "deload_recommendation":
        return "Deload Recommendation";
      case "rotation":
      case "exercise_rotation":
        return "Exercise Rotation";
      default:
        return type.replace(/_/g, " ");
    }
  };

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
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          {`Welcome back, ${clerkUser?.firstName || appUser?.email?.split("@")[0] || "lifter"}. Ready to train?`}
        </p>
      </div>

      {/* API Status */}
      {!apiConnected && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="py-4">
            <p className="text-sm text-yellow-400">
              API server not connected. Start it with:{" "}
              <code className="bg-secondary px-1 rounded">
                make dev-server
              </code>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Today's Workout - Prominent */}
      <TodaysWorkoutCard data={todaysWorkout} isLoading={isTodayLoading} />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.workoutsThisWeek || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              workouts completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Current Streak
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.currentStreak || 0}
            </div>
            <p className="text-xs text-muted-foreground">consecutive days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.averageDuration ? `${summary.averageDuration}m` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">per workout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average RPE</CardTitle>
            <Dumbbell className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.averageRpe?.toFixed(1) || "—"}
            </div>
            <p className="text-xs text-muted-foreground">training intensity</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Summary */}
      <WeeklySummary />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Decisions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Recent Decisions
            </CardTitle>
            <CardDescription>
              AI-powered training adjustments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {decisions.length === 0 ? (
              <div className="text-center py-6">
                <Brain className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No decisions yet. Complete workouts to see AI recommendations.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {decisions.map((decision) => (
                  <Link
                    key={decision.id}
                    href={`/decisions?id=${decision.id}`}
                    className="block"
                  >
                    <div className="flex items-center gap-3 rounded-lg bg-secondary p-3 hover:bg-secondary/80 transition-colors">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {getDecisionIcon(decision.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {getDecisionTitle(decision.type)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeDate(decision.createdAt)}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/decisions">
                    View All Decisions
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Workouts */}
        <RecentWorkoutsCard workouts={recentWorkouts} isLoading={isRecentLoading} />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Jump to key features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/analytics" className="block">
              <div className="flex items-center gap-3 rounded-lg bg-secondary p-4 hover:bg-secondary/80 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Analytics</p>
                  <p className="text-sm text-muted-foreground">
                    View progress
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/history" className="block">
              <div className="flex items-center gap-3 rounded-lg bg-secondary p-4 hover:bg-secondary/80 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
                  <History className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">History</p>
                  <p className="text-sm text-muted-foreground">
                    Past sessions
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/programs" className="block">
              <div className="flex items-center gap-3 rounded-lg bg-secondary p-4 hover:bg-secondary/80 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                  <Target className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Programs</p>
                  <p className="text-sm text-muted-foreground">
                    Browse & start
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/decisions" className="block">
              <div className="flex items-center gap-3 rounded-lg bg-secondary p-4 hover:bg-secondary/80 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                  <Brain className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Decisions</p>
                  <p className="text-sm text-muted-foreground">
                    AI insights
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Current Training Block or Getting Started */}
      {trainingBlock && blockProgram ? (
        <TrainingBlockProgress
          block={trainingBlock}
          program={blockProgram}
          workouts={blockWorkouts}
          onWeekGenerated={refreshDashboard}
        />
      ) : trainingBlock ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Active Training Block
            </CardTitle>
            <CardDescription>
              Week {trainingBlock.currentWeek} • Started{" "}
              {formatRelativeDate(trainingBlock.startDate)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium capitalize">
                  {trainingBlock.programId.replace(/-/g, " ")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {trainingBlock.status}
                </p>
              </div>
              <Button asChild>
                <Link href={`/programs/${trainingBlock.programId}`}>
                  View Program
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Choose a program to begin your training journey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
              <div>
                <p className="font-medium">No active program</p>
                <p className="text-sm text-muted-foreground">
                  Start a program to track your progress
                </p>
              </div>
              <Button asChild>
                <Link href="/programs">
                  Browse Programs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
