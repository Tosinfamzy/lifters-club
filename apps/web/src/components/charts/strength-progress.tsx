"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExerciseProgressChart } from "./exercise-progress-chart";
import { Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Exercise {
  id: string;
  name: string;
}

interface ProgressSession {
  date: string;
  bestWeight: number;
  bestVolume: number;
  totalSets: number;
  avgRpe: number | null;
}

interface StrengthProgressProps {
  userId: string;
  exercises: Exercise[];
  getToken?: () => Promise<string | null>;
}

export function StrengthProgress({
  userId,
  exercises,
  getToken,
}: StrengthProgressProps) {
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [metric, setMetric] = useState<"weight" | "volume">("weight");
  const [sessions, setSessions] = useState<ProgressSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedExercise) return;

    async function fetchProgress() {
      setIsLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (getToken) {
          const token = await getToken();
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
        }

        const response = await fetch(
          `${API_URL}/api/analytics/exercise/${selectedExercise}/progress?userId=${userId}&limit=20`,
          { headers }
        );

        if (response.ok) {
          const data = await response.json();
          setSessions(data.data?.sessions || []);
        } else {
          setSessions([]);
        }
      } catch {
        setSessions([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProgress();
  }, [selectedExercise, userId, getToken]);

  const selectedExerciseName =
    exercises.find((e) => e.id === selectedExercise)?.name || "Exercise";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Strength Progress</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={selectedExercise} onValueChange={setSelectedExercise}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select exercise" />
              </SelectTrigger>
              <SelectContent>
                {exercises.map((exercise) => (
                  <SelectItem key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedExercise && (
              <Tabs
                value={metric}
                onValueChange={(v) => setMetric(v as "weight" | "volume")}
              >
                <TabsList>
                  <TabsTrigger value="weight">Weight</TabsTrigger>
                  <TabsTrigger value="volume">Volume</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedExercise ? (
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            Select an exercise to view progress
          </div>
        ) : isLoading ? (
          <div className="flex h-[250px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ExerciseProgressChart
            sessions={sessions}
            metric={metric}
            title={`${selectedExerciseName} - ${metric === "weight" ? "Best Weight" : "Volume"}`}
          />
        )}
      </CardContent>
    </Card>
  );
}
