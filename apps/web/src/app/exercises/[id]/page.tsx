"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { DashboardLayout } from "@/components/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Dumbbell,
  Target,
  Zap,
  Info,
  RefreshCw,
  Loader2,
  TrendingUp,
  Calendar,
} from "lucide-react";
import type { Exercise, ScoredSubstitute } from "@/lib/api";
import { useAppUser } from "@/providers/user-provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ExerciseHistory {
  date: string;
  bestWeight: number;
  bestReps: number;
  totalSets: number;
  avgRpe: number | null;
}

export default function ExerciseDetailPage() {
  const params = useParams();
  const exerciseId = params.id as string;
  const { getToken } = useAuth();
  const { appUser } = useAppUser();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [substitutes, setSubstitutes] = useState<ScoredSubstitute[]>([]);
  const [history, setHistory] = useState<ExerciseHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch exercise details
        const exerciseRes = await fetch(`${API_URL}/api/exercises/${exerciseId}`);
        if (!exerciseRes.ok) {
          throw new Error("Exercise not found");
        }
        const exerciseData = await exerciseRes.json();
        setExercise(exerciseData.data);

        // Fetch substitutes
        const subsRes = await fetch(
          `${API_URL}/api/exercises/${exerciseId}/substitutes?limit=5`
        );
        if (subsRes.ok) {
          const subsData = await subsRes.json();
          setSubstitutes(subsData.data?.substitutes || []);
        }

        // Fetch personal history if logged in
        if (appUser?.id) {
          const token = await getToken();
          const historyRes = await fetch(
            `${API_URL}/api/analytics/exercise/${exerciseId}/progress?userId=${appUser.id}&limit=10`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (historyRes.ok) {
            const historyData = await historyRes.json();
            setHistory(historyData.data?.sessions || []);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load exercise");
      } finally {
        setIsLoading(false);
      }
    }

    if (exerciseId) {
      fetchData();
    }
  }, [exerciseId, appUser?.id, getToken]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !exercise) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Link href="/exercises">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Exercises
            </Button>
          </Link>
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">{error || "Exercise not found"}</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "intermediate":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "advanced":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Link href="/exercises">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Exercises
          </Button>
        </Link>

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{exercise.name}</h1>
            <Badge variant="outline" className={getDifficultyColor(exercise.difficulty)}>
              {exercise.difficulty}
            </Badge>
          </div>
          {exercise.aliases.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Also known as: {exercise.aliases.join(", ")}
            </p>
          )}
        </div>

        {/* Main Info Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Equipment & Type */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Dumbbell className="h-5 w-5" />
                Equipment & Type
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Equipment</p>
                <div className="flex flex-wrap gap-2">
                  {exercise.equipment.map((eq) => (
                    <Badge key={eq} variant="secondary">
                      {eq}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Type</p>
                  <Badge variant="outline">
                    {exercise.isCompound ? "Compound" : "Isolation"}
                  </Badge>
                </div>
                {exercise.isUnilateral && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Execution</p>
                    <Badge variant="outline">Unilateral</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Movement Patterns */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5" />
                Movement Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {exercise.movementPatterns.map((pattern) => (
                  <Badge key={pattern} variant="secondary" className="capitalize">
                    {pattern.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Muscles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5" />
              Target Muscles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Primary Muscles</p>
              <div className="flex flex-wrap gap-2">
                {exercise.primaryMuscles.map((muscle) => (
                  <Badge key={muscle} className="bg-primary/20 text-primary border-primary/30">
                    {muscle}
                  </Badge>
                ))}
              </div>
            </div>
            {exercise.secondaryMuscles.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Secondary Muscles</p>
                <div className="flex flex-wrap gap-2">
                  {exercise.secondaryMuscles.map((muscle) => (
                    <Badge key={muscle} variant="outline">
                      {muscle}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Constraints/Notes */}
        {exercise.constraints.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Info className="h-5 w-5" />
                Notes & Considerations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {exercise.constraints.map((constraint, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-muted-foreground">•</span>
                    {constraint}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Personal History */}
        {appUser && history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5" />
                Your History
              </CardTitle>
              <CardDescription>Last {history.length} sessions with this exercise</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {history.slice(0, 5).map((session, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-secondary/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {new Date(session.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span>
                        <span className="font-medium">{session.bestWeight}</span> lbs
                      </span>
                      <span>
                        <span className="font-medium">{session.bestReps}</span> reps
                      </span>
                      <span>
                        <span className="font-medium">{session.totalSets}</span> sets
                      </span>
                      {session.avgRpe && (
                        <span className="text-muted-foreground">
                          RPE {session.avgRpe.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Substitutes */}
        {substitutes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <RefreshCw className="h-5 w-5" />
                Alternative Exercises
              </CardTitle>
              <CardDescription>
                Similar exercises you can substitute based on movement patterns and muscles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {substitutes.map((sub) => (
                  <Link
                    key={sub.exercise.id}
                    href={`/exercises/${sub.exercise.id}`}
                    className="block"
                  >
                    <Card className="hover:border-primary/50 transition-colors h-full">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{sub.exercise.name}</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {sub.score}% match
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {sub.exercise.primaryMuscles.slice(0, 2).map((m) => (
                              <Badge key={m} variant="secondary" className="text-xs">
                                {m}
                              </Badge>
                            ))}
                          </div>
                          {sub.reasons.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {sub.reasons[0]}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
