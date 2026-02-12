import { useState, useCallback } from "react";
import { Alert, Vibration } from "react-native";
import type { Router } from "expo-router";

interface CompletionState {
  workoutLogId: string;
  completedAt: Date;
}

export function useWorkoutCompletion(
  completeWorkoutAction: (overallRpe?: number, notes?: string) => Promise<void>,
  router: Router
) {
  const [recentlyCompleted, setRecentlyCompleted] =
    useState<CompletionState | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(10);

  const finishWorkout = useCallback(
    async (
      workoutLogId: string | null,
      exercises: {
        sets: { completed: boolean; rpe: string }[];
      }[]
    ) => {
      if (!workoutLogId) {
        router.back();
        return;
      }

      // Calculate overall RPE as average
      const completedSetsWithRpe = exercises.flatMap((ex) =>
        ex.sets.filter((s) => s.completed && s.rpe)
      );
      const avgRpe =
        completedSetsWithRpe.length > 0
          ? completedSetsWithRpe.reduce(
              (sum, s) => sum + parseFloat(s.rpe),
              0
            ) / completedSetsWithRpe.length
          : undefined;

      try {
        await completeWorkoutAction(
          avgRpe ? Math.round(avgRpe * 10) / 10 : undefined
        );

        setRecentlyCompleted({
          workoutLogId,
          completedAt: new Date(),
        });

        setCountdownSeconds(10);
        const timeout = setTimeout(() => {
          setRecentlyCompleted(null);
          router.back();
        }, 10000);
        setUndoTimeout(timeout);

        const countdownInterval = setInterval(() => {
          setCountdownSeconds((prev) => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        Vibration.vibrate([0, 50, 100, 50]);
      } catch (error) {
        console.error("Failed to complete workout:", error);
        router.back();
      }
    },
    [completeWorkoutAction, router]
  );

  const undoCompletion = useCallback(() => {
    if (!recentlyCompleted || !undoTimeout) return;

    clearTimeout(undoTimeout);
    setUndoTimeout(null);
    setRecentlyCompleted(null);

    Alert.alert("Workout Uncompleted", "You can continue logging sets.");
  }, [recentlyCompleted, undoTimeout]);

  return {
    recentlyCompleted,
    countdownSeconds,
    finishWorkout,
    undoCompletion,
  };
}
