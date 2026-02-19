"use client";

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
import { useUser } from "@clerk/nextjs";
import { useAppUser } from "@/providers/user-provider";
import {
  WeeklySummary,
  TodaysWorkoutCard,
  RecentWorkoutsCard,
} from "@/components/dashboard";
import { TrainingBlockProgress } from "@/components/programs/training-block-progress";
import { formatRelativeDate } from "@/lib/format";
import {
  useTrainingBlocks,
  useRecentDecisions,
  useTodaysWorkout,
  useRecentWorkouts,
  useAnalyticsSummary,
  queryKeys,
} from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";

export default function DashboardPage() {
  const { appUser, isLoading: isUserLoading } = useAppUser();
  const { user: clerkUser } = useUser();
  const queryClient = useQueryClient();

  const { data: blockData, isLoading: isBlockLoading } = useTrainingBlocks();
  const { data: decisions = [], isLoading: isDecisionsLoading } = useRecentDecisions();
  const { data: todaysWorkout, isLoading: isTodayLoading } = useTodaysWorkout();
  const { data: recentWorkouts = [], isLoading: isRecentLoading } = useRecentWorkouts();
  const { data: summary, isLoading: isSummaryLoading } = useAnalyticsSummary();

  const trainingBlock = blockData?.block ?? null;
  const blockProgram = blockData?.program ?? null;
  const blockWorkouts = blockData?.workouts ?? [];

  const isLoading = isBlockLoading || isDecisionsLoading || isSummaryLoading;

  const refreshDashboard = () => {
    if (!appUser?.id) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.trainingBlocks(appUser.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.todaysWorkout(appUser.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.recentWorkouts(appUser.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary(appUser.id) });
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

      {/* Today's Workout - Prominent */}
      <TodaysWorkoutCard data={todaysWorkout ?? null} isLoading={isTodayLoading} />

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
