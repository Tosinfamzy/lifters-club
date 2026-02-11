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
import { type Exercise, type ExerciseProgressSession } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useAppUser } from "@/providers/user-provider";

interface StrengthProgressProps {
  exercises: Exercise[];
}

export function StrengthProgress({
  exercises,
}: StrengthProgressProps) {
  const api = useApi();
  const { appUser } = useAppUser();
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [metric, setMetric] = useState<"weight" | "volume">("weight");
  const [sessions, setSessions] = useState<ExerciseProgressSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const userId = appUser?.id;

  useEffect(() => {
    if (!selectedExercise || !userId) return;

    async function fetchProgress() {
      setIsLoading(true);
      try {
        const response = await api.getExerciseProgress(selectedExercise, userId!);
        setSessions(response.data?.sessions || []);
      } catch {
        setSessions([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProgress();
  }, [selectedExercise, userId, api]);

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
