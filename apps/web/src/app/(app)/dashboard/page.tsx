"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
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
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { useAppUser } from "@/providers/user-provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface SummaryData {
  totalWorkouts: number;
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  averageRpe: number | null;
  averageDuration: number | null;
  currentStreak: number;
  lastWorkout: string | null;
}

interface Decision {
  id: string;
  userId: string;
  decisionType: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  createdAt: string;
}

interface TrainingBlock {
  id: string;
  programId: string;
  status: string;
  currentWeek: number;
  startDate: string;
}

export default function DashboardPage() {
  const { appUser, isLoading: isUserLoading } = useAppUser();
  const { getToken } = useAuth();

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [trainingBlock, setTrainingBlock] = useState<TrainingBlock | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!appUser?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const token = await getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [summaryRes, decisionsRes, blocksRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics/summary?userId=${appUser.id}`, {
          headers,
        }).catch(() => null),
        fetch(
          `${API_URL}/api/decisions/history?userId=${appUser.id}&limit=3`,
          { headers }
        ).catch(() => null),
        fetch(
          `${API_URL}/api/workouts/training-blocks?userId=${appUser.id}&status=active`,
          { headers }
        ).catch(() => null),
      ]);

      if (summaryRes?.ok) {
        const data = await summaryRes.json();
        setSummary(data.data || null);
        setApiConnected(true);
      } else if (summaryRes === null) {
        setApiConnected(false);
      }

      if (decisionsRes?.ok) {
        const data = await decisionsRes.json();
        setDecisions(data.data || []);
      }

      if (blocksRes?.ok) {
        const data = await blocksRes.json();
        const blocks = data.data || [];
        if (blocks.length > 0) {
          setTrainingBlock(blocks[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      setApiConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [appUser?.id, getToken]);

  useEffect(() => {
    fetchDashboardData();
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
        return <BarChart3 className="h-4 w-4" />;
      case "recovery":
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
        return "Volume Change";
      case "recovery":
        return "Recovery Adjustment";
      case "deload":
        return "Deload Recommendation";
      case "rotation":
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
          {appUser
            ? `Welcome back, ${appUser.email?.split("@")[0] || "lifter"}. Ready to train?`
            : "Welcome back. Ready to train?"}
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

      {/* Mobile App CTA */}
      <Card className="border-primary/30 bg-linear-to-r from-primary/5 to-transparent">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Smartphone className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Log Workouts on Mobile</p>
            <p className="text-sm text-muted-foreground">
              Use the Lifters Club app to log workouts with offline support, rest timers, and live progression recommendations.
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0">
            Coming Soon
          </Button>
        </CardContent>
      </Card>

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
                        {getDecisionIcon(decision.decisionType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {getDecisionTitle(decision.decisionType)}
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Jump to key features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/analytics" className="block">
              <div className="flex items-center gap-3 rounded-lg bg-secondary p-4 hover:bg-secondary/80 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Analytics</p>
                  <p className="text-sm text-muted-foreground">
                    View progress charts and PRs
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>

            <Link href="/history" className="block">
              <div className="flex items-center gap-3 rounded-lg bg-secondary p-4 hover:bg-secondary/80 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
                  <History className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Workout History</p>
                  <p className="text-sm text-muted-foreground">
                    Review and edit past sessions
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
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
                    Browse and customize programs
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>

            <Link href="/decisions" className="block">
              <div className="flex items-center gap-3 rounded-lg bg-secondary p-4 hover:bg-secondary/80 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                  <Brain className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Decision History</p>
                  <p className="text-sm text-muted-foreground">
                    Understand why your program changes
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Current Training Block or Getting Started */}
      {trainingBlock ? (
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
