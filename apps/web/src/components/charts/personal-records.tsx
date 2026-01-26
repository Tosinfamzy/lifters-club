"use client";

import { Trophy, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

interface PersonalRecordsProps {
  records: PersonalRecord[];
}

export function PersonalRecords({ records }: PersonalRecordsProps) {
  if (records.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Personal Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[100px] items-center justify-center text-muted-foreground">
            No personal records yet. Start training to set some PRs!
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get top records by weight
  const topWeightPRs = records
    .filter((r) => r.weightPR)
    .sort((a, b) => (b.weightPR?.weight || 0) - (a.weightPR?.weight || 0))
    .slice(0, 5);

  const formatExerciseName = (id: string, name?: string): string => {
    if (name) return name;
    return id
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Personal Records
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topWeightPRs.map((record) => (
            <div
              key={record.exerciseId}
              className="flex items-center justify-between rounded-lg bg-secondary p-3"
            >
              <div className="space-y-1">
                <p className="font-medium">
                  {formatExerciseName(record.exerciseId, record.exerciseName)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(record.weightPR!.date)}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-lg font-bold text-primary">
                  <TrendingUp className="h-4 w-4" />
                  {record.weightPR!.weight} lbs
                </div>
                <p className="text-xs text-muted-foreground">
                  × {record.weightPR!.reps} reps
                </p>
              </div>
            </div>
          ))}

          {records.length > 5 && (
            <p className="text-center text-sm text-muted-foreground">
              +{records.length - 5} more exercises with PRs
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
