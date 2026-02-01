"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Check, Dumbbell } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { Exercise, ScoredSubstitute } from "@/lib/api";

interface ExerciseAlternativesDialogProps {
  exerciseId: string;
  exerciseName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (exercise: Exercise) => void;
}

export function ExerciseAlternativesDialog({
  exerciseId,
  exerciseName,
  open,
  onOpenChange,
  onSelect,
}: ExerciseAlternativesDialogProps) {
  const api = useApi();
  const [isLoading, setIsLoading] = useState(false);
  const [substitutes, setSubstitutes] = useState<ScoredSubstitute[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && exerciseId) {
      fetchSubstitutes();
    }
  }, [open, exerciseId]);

  const fetchSubstitutes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getExerciseSubstitutes(exerciseId, { limit: 5 });
      setSubstitutes(response.data.substitutes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alternatives");
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 0.8) return "bg-green-500/10 text-green-400";
    if (score >= 0.6) return "bg-yellow-500/10 text-yellow-400";
    return "bg-orange-500/10 text-orange-400";
  };

  const handleSelect = (exercise: Exercise) => {
    onSelect(exercise);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Swap Exercise
          </DialogTitle>
          <DialogDescription>
            Find an alternative for <strong>{exerciseName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Finding alternatives...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-400">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchSubstitutes} className="mt-2">
                Try Again
              </Button>
            </div>
          ) : substitutes.length === 0 ? (
            <div className="text-center py-8">
              <Dumbbell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No similar exercises found. Try a different exercise.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {substitutes.map((sub) => (
                <div
                  key={sub.exercise.id}
                  className="flex items-start gap-3 rounded-lg bg-secondary p-4 hover:bg-secondary/80 transition-colors cursor-pointer"
                  onClick={() => handleSelect(sub.exercise)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{sub.exercise.name}</p>
                      <Badge className={getScoreBadgeVariant(sub.score)}>
                        {Math.round(sub.score * 100)}% match
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {sub.exercise.equipment.slice(0, 2).map((eq) => (
                        <Badge key={eq} variant="outline" className="text-xs">
                          {eq}
                        </Badge>
                      ))}
                      {sub.exercise.primaryMuscles.slice(0, 2).map((muscle) => (
                        <Badge key={muscle} variant="outline" className="text-xs">
                          {muscle}
                        </Badge>
                      ))}
                    </div>
                    {sub.reasons.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {sub.reasons.slice(0, 2).join(" • ")}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0">
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
