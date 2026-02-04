import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Vibration,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import {
  Check,
  Plus,
  Minus,
  ChevronRight,
  Timer,
  TrendingUp,
  X,
  RefreshCw,
  MoreHorizontal,
} from "lucide-react-native";
import { useAppUser } from "../../providers/user-provider";
import { useWorkoutOffline, type LoggedSet as ApiLoggedSet } from "../../hooks";
import { OfflineIndicator } from "../../components/OfflineIndicator";
import { ExerciseActionsSheet } from "../../components/ExerciseActionsSheet";
import { DecisionBadge } from "../../components/workout/DecisionBadge";
import { DecisionExplanationModal } from "../../components/workout/DecisionExplanationModal";
import type { DecisionType, OverrideReason } from "@gymapp/types";

type ExerciseAction = "info" | "alternatives" | "skip" | "mark_done";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repRange: [number, number];
  restSeconds: number;
}

interface LoggedSet {
  id?: string;
  setNumber: number;
  weight: string;
  reps: string;
  rpe: string;
  completed: boolean;
}

interface ExerciseProgress {
  exerciseId: string;
  exerciseName: string;
  plannedSets: number;
  repRange: [number, number];
  restSeconds: number;
  sets: LoggedSet[];
  lastPerformance?: {
    weight: number;
    reps: number;
    rpe?: number;
  };
}

interface SubstituteExercise {
  exercise: {
    id: string;
    name: string;
    equipment: string[];
    difficulty: string;
  };
  score: number;
  matchReasons: string[];
}

interface ReadinessResult {
  readinessScore: number;
  recommendation: "proceed" | "light_session" | "rest_day";
  volumeModifier: number;
  intensityModifier: number;
  adjustments: string[];
  reason: string;
}

interface LoadRecommendation {
  exerciseId: string;
  action: "increase" | "maintain" | "decrease";
  newWeight: number;
  reason: string;
}

interface ExerciseDecision {
  id: string; // decision ID
  exerciseId: string;
  type: DecisionType;
  summary: string;
  reasoning: string;
  confidence: "low" | "medium" | "high";
  recommendedValue: Record<string, unknown>;
}

export default function WorkoutScreen() {
  const { id, substitutedExerciseId, substitutedExerciseName, originalExerciseId } =
    useLocalSearchParams<{
      id: string;
      substitutedExerciseId?: string;
      substitutedExerciseName?: string;
      originalExerciseId?: string;
    }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const { appUser } = useAppUser();

  // Offline-first workout data
  const {
    workout,
    workoutLog: existingLog,
    loggedSets: savedSets,
    isLoading: isWorkoutLoading,
    isOnline,
    startWorkout: startWorkoutLog,
    logSet: logSetAction,
    completeWorkout: completeWorkoutAction,
  } = useWorkoutOffline(id || "");

  const [isLoading, setIsLoading] = useState(true);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [exercises, setExercises] = useState<ExerciseProgress[]>([]);
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null);

  // Rest timer state
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [targetRestTime, setTargetRestTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Exercise actions state
  const [showExerciseActions, setShowExerciseActions] = useState(false);

  // UNDO workout completion state
  const [recentlyCompleted, setRecentlyCompleted] = useState<{
    workoutLogId: string;
    completedAt: Date;
  } | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(10);

  // Readiness check-in state
  const [showReadinessCheck, setShowReadinessCheck] = useState(true);
  const [readinessResult, setReadinessResult] = useState<ReadinessResult | null>(null);

  // Load progression recommendations state
  const [loadRecommendations, setLoadRecommendations] = useState<Map<string, LoadRecommendation>>(new Map());
  const [showRecommendation, setShowRecommendation] = useState<string | null>(null);

  // Inline exercise decisions state
  const [exerciseDecisions, setExerciseDecisions] = useState<Map<string, ExerciseDecision>>(new Map());
  const [selectedDecision, setSelectedDecision] = useState<ExerciseDecision | null>(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [readinessInputs, setReadinessInputs] = useState({
    sleepQuality: 7,
    muscleSoreness: 3,
    stressLevel: 4,
    energyLevel: 7,
  });
  const [isSubmittingReadiness, setIsSubmittingReadiness] = useState(false);

  // Initialize workout data from cached/fetched workout
  const initializeWorkout = useCallback(async () => {
    if (!appUser || !workout) return;

    try {
      const plannedExercises = workout.plannedExercises;

      // Build exercise progress from workout data
      const exerciseProgress: ExerciseProgress[] = plannedExercises.map((ex) => {
        // Get exercise name from embedded exercise or fallback to ID
        const exerciseName = ex.exercise?.name ||
          ex.exerciseId.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

        return {
          exerciseId: ex.exerciseId,
          exerciseName,
          plannedSets: ex.sets,
          repRange: ex.repRange,
          restSeconds: ex.restSeconds,
          sets: Array.from({ length: ex.sets }, (_, i) => ({
            setNumber: i + 1,
            weight: "",
            reps: "",
            rpe: "",
            completed: false,
          })),
          lastPerformance: undefined, // TODO: Could fetch from API
        };
      });

      setExercises(exerciseProgress);

      // Check if workout log already exists (resuming workout)
      if (existingLog) {
        setWorkoutLogId(existingLog.id);

        // Restore logged sets from cached data
        if (savedSets.length > 0) {
          const updatedExercises = [...exerciseProgress];

          for (const savedSet of savedSets) {
            const exerciseIndex = updatedExercises.findIndex(
              (ex) => ex.exerciseId === savedSet.exerciseId
            );
            if (exerciseIndex >= 0) {
              const setIndex = savedSet.setNumber - 1;
              if (updatedExercises[exerciseIndex]!.sets[setIndex]) {
                updatedExercises[exerciseIndex]!.sets[setIndex] = {
                  id: savedSet.id,
                  setNumber: savedSet.setNumber,
                  weight: savedSet.weight.toString(),
                  reps: savedSet.reps.toString(),
                  rpe: savedSet.rpe?.toString() || "",
                  completed: true,
                };
              }
            }
          }
          setExercises(updatedExercises);
        }
      } else {
        // Create new workout log
        const newLog = await startWorkoutLog(appUser.id);
        if (newLog) {
          setWorkoutLogId(newLog.id);
        }
      }
    } catch (error) {
      console.error("Failed to initialize workout:", error);
      Alert.alert("Error", "Failed to load workout");
    } finally {
      setIsLoading(false);
    }
  }, [workout, appUser, existingLog, savedSets, startWorkoutLog]);

  // Fetch exercise decisions from the API
  const fetchExerciseDecisions = useCallback(async () => {
    if (!appUser || !workout || !isOnline) return;

    try {
      const token = await getToken();
      const exerciseIds = (workout.plannedExercises as PlannedExercise[])
        .map((ex) => ex.exerciseId)
        .filter(Boolean);

      if (exerciseIds.length === 0) return;

      // Fetch decisions for each exercise from recent decisions
      const res = await fetch(`${API_URL}/api/decisions?userId=${appUser.id}&limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const decisionsMap = new Map<string, ExerciseDecision>();

        for (const decision of data.data || []) {
          const input = decision.input as { exerciseId?: string };
          if (input.exerciseId && exerciseIds.includes(input.exerciseId)) {
            // Only keep the most recent decision per exercise
            if (!decisionsMap.has(input.exerciseId)) {
              const output = decision.output as Record<string, unknown>;
              decisionsMap.set(input.exerciseId, {
                exerciseId: input.exerciseId,
                id: decision.id,
                type: decision.type as DecisionType,
                summary: generateDecisionSummary(decision.type, output),
                reasoning: decision.reasoning,
                confidence: "medium", // Default confidence
                recommendedValue: output,
              });
            }
          }
        }

        setExerciseDecisions(decisionsMap);
      }
    } catch (error) {
      console.error("Failed to fetch exercise decisions:", error);
    }
  }, [appUser, workout, isOnline, getToken]);

  // Helper to generate summary from decision output
  function generateDecisionSummary(type: string, output: Record<string, unknown>): string {
    switch (type) {
      case "load_progression": {
        const action = output.action as string;
        const newWeight = output.newWeight as number;
        if (action === "increase") return `↑ ${newWeight}lbs`;
        if (action === "decrease") return `↓ ${newWeight}lbs`;
        return `${newWeight}lbs`;
      }
      case "volume_adjustment": {
        const action = output.action as string;
        const newSetCount = output.newSetCount as number;
        if (action === "add_set") return `+1 set (${newSetCount})`;
        if (action === "reduce_set") return `${newSetCount} sets`;
        return `${newSetCount} sets`;
      }
      case "exercise_rotation":
        return "Swap suggested";
      case "deload_recommendation":
        return (output.recommended as boolean) ? "Deload" : "Continue";
      default:
        return "Adjustment";
    }
  }

  useEffect(() => {
    if (appUser && workout && !isWorkoutLoading) {
      initializeWorkout();
      fetchExerciseDecisions();
    }
  }, [appUser, workout, isWorkoutLoading, initializeWorkout, fetchExerciseDecisions]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Handle exercise substitution from alternative exercises screen
  useEffect(() => {
    if (substitutedExerciseId && substitutedExerciseName && originalExerciseId) {
      // Find the exercise to substitute
      const exerciseIndex = exercises.findIndex(
        (ex) => ex.exerciseId === originalExerciseId
      );

      if (exerciseIndex >= 0) {
        setExercises((prev) => {
          const updated = [...prev];
          updated[exerciseIndex] = {
            ...updated[exerciseIndex]!,
            exerciseId: substitutedExerciseId,
            exerciseName: substitutedExerciseName,
            lastPerformance: undefined,
            sets: updated[exerciseIndex]!.sets.map((set) => ({
              ...set,
              completed: false,
              weight: "",
              reps: "",
              rpe: "",
            })),
          };
          return updated;
        });

        // Clear the params by navigating to the same route without substitution params
        router.setParams({
          substitutedExerciseId: undefined,
          substitutedExerciseName: undefined,
          originalExerciseId: undefined,
        });

        Alert.alert("Exercise Swapped", `Switched to ${substitutedExerciseName}`);
      }
    }
  }, [substitutedExerciseId, substitutedExerciseName, originalExerciseId, exercises, router]);

  // Record decision outcome (accept or override)
  const recordDecisionOutcome = useCallback(
    async (
      decisionId: string,
      outcome: "followed" | "overridden",
      overrideReason?: OverrideReason
    ) => {
      if (!isOnline) return;

      try {
        const token = await getToken();
        await fetch(`${API_URL}/api/decisions/${decisionId}/outcome`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            outcome,
            overrideReason,
          }),
        });
      } catch (error) {
        console.error("Failed to record decision outcome:", error);
      }
    },
    [isOnline, getToken]
  );

  // Handle accepting a decision
  const handleAcceptDecision = useCallback(() => {
    if (selectedDecision) {
      recordDecisionOutcome(selectedDecision.id, "followed");
      setShowDecisionModal(false);
      setSelectedDecision(null);
    }
  }, [selectedDecision, recordDecisionOutcome]);

  // Handle overriding a decision
  const handleOverrideDecision = useCallback(
    (reason: OverrideReason) => {
      if (selectedDecision) {
        recordDecisionOutcome(selectedDecision.id, "overridden", reason);
        setShowDecisionModal(false);
        setSelectedDecision(null);
      }
    },
    [selectedDecision, recordDecisionOutcome]
  );

  // Open decision modal
  const openDecisionModal = useCallback((exerciseId: string) => {
    const decision = exerciseDecisions.get(exerciseId);
    if (decision) {
      setSelectedDecision(decision);
      setShowDecisionModal(true);
    }
  }, [exerciseDecisions]);

  // Readiness check still uses API (server-side decision engine)
  const submitReadinessCheck = async () => {
    if (!appUser) return;

    setIsSubmittingReadiness(true);

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/users/readiness`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: appUser.id,
          workoutId: id,
          ...readinessInputs,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReadinessResult(data.data);
      }
    } catch {
      // Continue without readiness data when offline
      setShowReadinessCheck(false);
    } finally {
      setIsSubmittingReadiness(false);
    }
  };

  const proceedWithWorkout = () => {
    setShowReadinessCheck(false);
  };

  // Load recommendations still use API (server-side decision engine)
  const fetchLoadRecommendation = async (exercise: ExerciseProgress) => {
    if (!appUser) return;

    const completedSets = exercise.sets.filter((s) => s.completed && s.weight && s.reps);
    if (completedSets.length === 0) return;

    const recentSets = completedSets.map((s) => ({
      reps: parseInt(s.reps),
      rpe: s.rpe ? parseFloat(s.rpe) : undefined,
      weight: parseFloat(s.weight),
    }));

    const avgWeight = recentSets.reduce((sum, s) => sum + s.weight, 0) / recentSets.length;

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/decisions/load-progression`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: appUser.id,
          exerciseId: exercise.exerciseId,
          recentSets,
          currentWeight: avgWeight,
          targetRepRange: exercise.repRange,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const recommendation: LoadRecommendation = {
          exerciseId: exercise.exerciseId,
          action: data.data.action,
          newWeight: data.data.newWeight,
          reason: data.data.reason,
        };

        setLoadRecommendations((prev) => {
          const updated = new Map(prev);
          updated.set(exercise.exerciseId, recommendation);
          return updated;
        });

        setShowRecommendation(exercise.exerciseId);
      }
    } catch {
      // Continue without recommendation when offline
    }
  };

  // Handle exercise actions from action sheet
  const handleExerciseAction = useCallback(
    (action: ExerciseAction) => {
      setShowExerciseActions(false);
      const exercise = exercises[currentExerciseIndex];
      if (!exercise) return;

      switch (action) {
        case "info":
          router.push({
            pathname: "/exercise-info/[exerciseId]",
            params: {
              exerciseId: exercise.exerciseId,
            },
          });
          break;
        case "alternatives":
          router.push({
            pathname: "/exercise-alternatives/[exerciseId]",
            params: {
              exerciseId: exercise.exerciseId,
              workoutLogId: workoutLogId || "",
              currentExercise: JSON.stringify({
                name: exercise.exerciseName,
                sets: exercise.plannedSets,
                repRange: exercise.repRange,
              }),
            },
          });
          break;
        case "skip":
          skipExercise();
          break;
        case "mark_done":
          markExerciseDone();
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exercises, currentExerciseIndex, workoutLogId, router]
  );

  // Skip exercise - mark all sets as skipped
  const skipExercise = useCallback(() => {
    Alert.alert(
      "Skip Exercise?",
      "You won't do this exercise today. It will be marked as skipped.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Skip",
          style: "destructive",
          onPress: () => {
            setExercises((prev) => {
              const updated = [...prev];
              updated[currentExerciseIndex]!.sets = updated[
                currentExerciseIndex
              ]!.sets.map((set) => ({ ...set, completed: true, skipped: true }));
              return updated;
            });

            // Move to next exercise
            if (currentExerciseIndex < exercises.length - 1) {
              setCurrentExerciseIndex((prev) => prev + 1);
            }
          },
        },
      ]
    );
  }, [currentExerciseIndex, exercises.length]);

  // Mark exercise done - auto-complete remaining sets with last values
  const markExerciseDone = useCallback(() => {
    const exercise = exercises[currentExerciseIndex]!;
    const completedSets = exercise.sets.filter((s) => s.completed);
    const lastSet = completedSets[completedSets.length - 1];

    if (!lastSet || !lastSet.weight || !lastSet.reps) {
      Alert.alert("Error", "Please complete at least one set first.");
      return;
    }

    Alert.alert(
      "Auto-Complete Remaining Sets?",
      "This will fill remaining sets with your last used values (weight, reps, RPE).",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Done",
          style: "default",
          onPress: () => {
            setExercises((prev) => {
              const updated = [...prev];
              updated[currentExerciseIndex]!.sets = updated[
                currentExerciseIndex
              ]!.sets.map((set) =>
                set.completed
                  ? set
                  : {
                      ...set,
                      weight: lastSet.weight,
                      reps: lastSet.reps,
                      rpe: lastSet.rpe || "",
                      completed: true,
                    }
              );
              return updated;
            });
          },
        },
      ]
    );
  }, [currentExerciseIndex, exercises]);

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: "weight" | "reps" | "rpe",
    value: string
  ) => {
    setExercises((prev) => {
      const updated = [...prev];
      updated[exerciseIndex]!.sets[setIndex]![field] = value;
      return updated;
    });
  };

  const startRestTimer = useCallback((seconds: number) => {
    setTargetRestTime(seconds);
    setRestTimeRemaining(seconds);
    setIsResting(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setRestTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          setIsResting(false);
          Vibration.vibrate([0, 200, 100, 200]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const skipRest = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsResting(false);
    setRestTimeRemaining(0);
  };

  const addRestTime = (seconds: number) => {
    setRestTimeRemaining((prev) => prev + seconds);
  };

  // Complete set - queues for sync when offline
  const completeSetAction = async (exerciseIndex: number, setIndex: number) => {
    const exercise = exercises[exerciseIndex]!;
    const set = exercise.sets[setIndex]!;

    if (!set.weight || !set.reps) {
      Alert.alert("Missing Info", "Please enter weight and reps");
      return;
    }

    // Mark as completed locally in state
    setExercises((prev) => {
      const updated = [...prev];
      updated[exerciseIndex]!.sets[setIndex]!.completed = true;
      return updated;
    });

    // Log the set (works offline - queues for sync)
    if (workoutLogId) {
      try {
        const loggedSet = await logSetAction(
          exercise.exerciseId,
          set.setNumber,
          parseFloat(set.weight),
          parseInt(set.reps),
          set.rpe ? parseFloat(set.rpe) : undefined
        );

        // Update state with the new ID
        if (loggedSet) {
          setExercises((prev) => {
            const updated = [...prev];
            updated[exerciseIndex]!.sets[setIndex]!.id = loggedSet.id;
            return updated;
          });
        }
      } catch (error) {
        console.error("Failed to log set:", error);
        // Still keep it marked as completed - will be saved on retry
      }
    }

    // Check if all sets in this exercise are now completed
    const updatedExercise = {
      ...exercise,
      sets: exercise.sets.map((s, i) =>
        i === setIndex ? { ...s, completed: true } : s
      ),
    };
    const allSetsCompleted = updatedExercise.sets.every((s) => s.completed);

    // Fetch load recommendation when exercise is complete (online only)
    if (allSetsCompleted && isOnline) {
      fetchLoadRecommendation(updatedExercise);
    }

    // Start rest timer if there are more sets
    const hasMoreSetsInExercise = exercise.sets.some(
      (s, i) => i > setIndex && !s.completed
    );
    const hasMoreExercises = exerciseIndex < exercises.length - 1;

    if (hasMoreSetsInExercise || hasMoreExercises) {
      startRestTimer(exercise.restSeconds);
    }
  };

  const finishWorkout = async () => {
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
        ? completedSetsWithRpe.reduce((sum, s) => sum + parseFloat(s.rpe), 0) /
          completedSetsWithRpe.length
        : undefined;

    try {
      // Complete the workout (works offline - queues for sync)
      await completeWorkoutAction(
        avgRpe ? Math.round(avgRpe * 10) / 10 : undefined
      );

      // Store completion temporarily for UNDO
      setRecentlyCompleted({
        workoutLogId: workoutLogId,
        completedAt: new Date(),
      });

      // Set 10-second countdown
      setCountdownSeconds(10);
      const timeout = setTimeout(() => {
        setRecentlyCompleted(null);
        router.back();
      }, 10000);
      setUndoTimeout(timeout);

      // Countdown timer
      const countdownInterval = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Haptic feedback
      Vibration.vibrate([0, 50, 100, 50]);
    } catch (error) {
      console.error("Failed to complete workout:", error);
      router.back();
    }
  };

  // UNDO workout completion
  const undoCompletion = useCallback(async () => {
    if (!recentlyCompleted || !undoTimeout) return;

    clearTimeout(undoTimeout);
    setUndoTimeout(null);
    setRecentlyCompleted(null);

    Alert.alert("Workout Uncompleted", "You can continue logging sets.");
  }, [recentlyCompleted, undoTimeout]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading || isWorkoutLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading workout...</Text>
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Workout not found</Text>
      </View>
    );
  }

  // Readiness Check-in Screen
  if (showReadinessCheck) {
    const ReadinessSlider = ({
      label,
      value,
      onValueChange,
      lowLabel,
      highLabel,
      inverted = false,
    }: {
      label: string;
      value: number;
      onValueChange: (v: number) => void;
      lowLabel: string;
      highLabel: string;
      inverted?: boolean;
    }) => (
      <View style={styles.readinessSlider}>
        <Text style={styles.readinessLabel}>{label}</Text>
        <View style={styles.readinessButtons}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
            const isSelected = value === num;
            const colorValue = inverted ? 11 - num : num;
            const bgColor = isSelected
              ? colorValue <= 3
                ? "#EF4444"
                : colorValue <= 6
                  ? "#F59E0B"
                  : "#22C55E"
              : "#334155";

            return (
              <TouchableOpacity
                key={num}
                style={[styles.readinessButton, { backgroundColor: bgColor }]}
                onPress={() => onValueChange(num)}
              >
                <Text
                  style={[
                    styles.readinessButtonText,
                    isSelected && styles.readinessButtonTextActive,
                  ]}
                >
                  {num}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.readinessLabels}>
          <Text style={styles.readinessLabelSmall}>{lowLabel}</Text>
          <Text style={styles.readinessLabelSmall}>{highLabel}</Text>
        </View>
      </View>
    );

    if (readinessResult) {
      const resultColor =
        readinessResult.recommendation === "proceed"
          ? "#22C55E"
          : readinessResult.recommendation === "light_session"
            ? "#F59E0B"
            : "#EF4444";

      return (
        <View style={styles.readinessContainer}>
          <Text style={styles.readinessTitle}>Ready to Train?</Text>

          <View style={styles.readinessScoreCard}>
            <Text style={[styles.readinessScore, { color: resultColor }]}>
              {readinessResult.readinessScore}%
            </Text>
            <Text style={styles.readinessRecommendation}>
              {readinessResult.recommendation === "proceed"
                ? "You're good to go!"
                : readinessResult.recommendation === "light_session"
                  ? "Consider a lighter session"
                  : "Rest day recommended"}
            </Text>
          </View>

          <View style={styles.readinessAdjustments}>
            {readinessResult.adjustments.map((adjustment, i) => (
              <View key={i} style={styles.readinessAdjustmentItem}>
                <View style={[styles.readinessAdjustmentDot, { backgroundColor: resultColor }]} />
                <Text style={styles.readinessAdjustmentText}>{adjustment}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.readinessProceedButton, { backgroundColor: resultColor }]}
            onPress={proceedWithWorkout}
          >
            <Text style={styles.readinessProceedText}>
              {readinessResult.recommendation === "rest_day"
                ? "Continue Anyway"
                : "Start Workout"}
            </Text>
          </TouchableOpacity>

          {readinessResult.recommendation === "rest_day" && (
            <TouchableOpacity
              style={styles.readinessSkipButton}
              onPress={() => router.back()}
            >
              <Text style={styles.readinessSkipText}>Take Rest Day</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <ScrollView style={styles.readinessContainer}>
        <Text style={styles.readinessTitle}>Pre-Workout Check-in</Text>
        <Text style={styles.readinessSubtitle}>
          How are you feeling today?
        </Text>

        <ReadinessSlider
          label="Sleep Quality"
          value={readinessInputs.sleepQuality}
          onValueChange={(v) =>
            setReadinessInputs((prev) => ({ ...prev, sleepQuality: v }))
          }
          lowLabel="Poor"
          highLabel="Great"
        />

        <ReadinessSlider
          label="Muscle Soreness"
          value={readinessInputs.muscleSoreness}
          onValueChange={(v) =>
            setReadinessInputs((prev) => ({ ...prev, muscleSoreness: v }))
          }
          lowLabel="None"
          highLabel="Severe"
          inverted
        />

        <ReadinessSlider
          label="Stress Level"
          value={readinessInputs.stressLevel}
          onValueChange={(v) =>
            setReadinessInputs((prev) => ({ ...prev, stressLevel: v }))
          }
          lowLabel="Low"
          highLabel="High"
          inverted
        />

        <ReadinessSlider
          label="Energy Level"
          value={readinessInputs.energyLevel}
          onValueChange={(v) =>
            setReadinessInputs((prev) => ({ ...prev, energyLevel: v }))
          }
          lowLabel="Exhausted"
          highLabel="Energized"
        />

        <TouchableOpacity
          style={[
            styles.readinessProceedButton,
            isSubmittingReadiness && styles.buttonDisabled,
          ]}
          onPress={submitReadinessCheck}
          disabled={isSubmittingReadiness}
        >
          {isSubmittingReadiness ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.readinessProceedText}>Check Readiness</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.readinessSkipButton}
          onPress={proceedWithWorkout}
        >
          <Text style={styles.readinessSkipText}>Skip Check-in</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    );
  }

  const currentExercise = exercises[currentExerciseIndex]!;
  const totalSetsCompleted = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
    0
  );
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  return (
    <View style={styles.container}>
      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Rest Timer Overlay */}
      {isResting && (
        <View style={styles.restOverlay}>
          <View style={styles.restCard}>
            <Timer size={32} color="#3B82F6" />
            <Text style={styles.restTitle}>Rest</Text>
            <Text style={styles.restTime}>{formatTime(restTimeRemaining)}</Text>
            <View style={styles.restProgress}>
              <View
                style={[
                  styles.restProgressFill,
                  {
                    width: `${((targetRestTime - restTimeRemaining) / targetRestTime) * 100}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.restActions}>
              <TouchableOpacity
                style={styles.restActionButton}
                onPress={() => addRestTime(30)}
              >
                <Plus size={16} color="#F8FAFC" />
                <Text style={styles.restActionText}>30s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.restActionButton, styles.skipButton]}
                onPress={skipRest}
              >
                <X size={16} color="#F8FAFC" />
                <Text style={styles.restActionText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Exercise Actions Sheet */}
      <ExerciseActionsSheet
        visible={showExerciseActions}
        onClose={() => setShowExerciseActions(false)}
        exerciseId={currentExercise.exerciseId}
        exerciseName={currentExercise.exerciseName}
        onSelectAction={handleExerciseAction}
      />

      {/* Decision Explanation Modal */}
      {selectedDecision && (
        <DecisionExplanationModal
          visible={showDecisionModal}
          decision={selectedDecision}
          onAccept={handleAcceptDecision}
          onOverride={handleOverrideDecision}
          onClose={() => {
            setShowDecisionModal(false);
            setSelectedDecision(null);
          }}
        />
      )}

      {/* Celebration Overlay (UNDO functionality) */}
      {recentlyCompleted && (
        <View style={styles.celebrationOverlay}>
          <View style={styles.celebrationCard}>
            <Text style={styles.celebrationTitle}>WORKOUT DONE 🎉</Text>
            <Text style={styles.celebrationSubtitle}>Great session!</Text>

            <TouchableOpacity
              style={styles.undoButton}
              onPress={undoCompletion}
            >
              <Text style={styles.undoButtonText}>UNDO</Text>
            </TouchableOpacity>

            <Text style={styles.undoTimer}>
              Redirecting in {countdownSeconds}s
            </Text>
          </View>
        </View>
      )}

      {/* Load Recommendation Modal */}
      {showRecommendation && loadRecommendations.has(showRecommendation) && (() => {
        const rec = loadRecommendations.get(showRecommendation)!;
        const exerciseName = exercises.find(
          (e) => e.exerciseId === showRecommendation
        )?.exerciseName || "Exercise";

        return (
          <View style={styles.restOverlay}>
            <View style={styles.recommendationCard}>
              <View style={styles.recommendationHeader}>
                <View
                  style={[
                    styles.recommendationIcon,
                    rec.action === "increase" && styles.recommendationIconIncrease,
                    rec.action === "decrease" && styles.recommendationIconDecrease,
                    rec.action === "maintain" && styles.recommendationIconMaintain,
                  ]}
                >
                  <TrendingUp
                    size={24}
                    color="#FFFFFF"
                    style={rec.action === "decrease" ? { transform: [{ rotate: "180deg" }] } : undefined}
                  />
                </View>
                <Text style={styles.recommendationTitle}>
                  {rec.action === "increase"
                    ? "Ready to Progress!"
                    : rec.action === "decrease"
                      ? "Reduce Load"
                      : "Maintain Weight"}
                </Text>
              </View>

              <Text style={styles.recommendationExercise}>{exerciseName}</Text>

              <View style={styles.recommendationWeight}>
                <Text style={styles.recommendationWeightLabel}>Next Session</Text>
                <Text style={styles.recommendationWeightValue}>
                  {rec.newWeight} lbs
                </Text>
              </View>

              <Text style={styles.recommendationReason}>{rec.reason}</Text>

              <TouchableOpacity
                style={styles.recommendationButton}
                onPress={() => setShowRecommendation(null)}
              >
                <Text style={styles.recommendationButtonText}>Got It</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      {/* Progress Header */}
      <View style={styles.progressHeader}>
        <Text style={styles.progressText}>
          {totalSetsCompleted} / {totalSets} sets completed
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(totalSetsCompleted / totalSets) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Exercise Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
      >
        {exercises.map((ex, index) => {
          const completedInExercise = ex.sets.filter((s) => s.completed).length;
          const allCompleted = completedInExercise === ex.sets.length;

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.tab,
                currentExerciseIndex === index && styles.tabActive,
                allCompleted && styles.tabCompleted,
              ]}
              onPress={() => setCurrentExerciseIndex(index)}
            >
              <Text
                style={[
                  styles.tabText,
                  currentExerciseIndex === index && styles.tabTextActive,
                ]}
                numberOfLines={1}
              >
                {ex.exerciseName.length > 15
                  ? ex.exerciseName.slice(0, 15) + "..."
                  : ex.exerciseName}
              </Text>
              <Text style={styles.tabProgress}>
                {completedInExercise}/{ex.sets.length}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Current Exercise */}
      <ScrollView style={styles.content}>
        <View style={styles.exerciseHeader}>
          <View style={styles.exerciseTitleContainer}>
            <View style={styles.exerciseTitleRow}>
              <Text style={styles.exerciseTitle}>{currentExercise.exerciseName}</Text>
              {exerciseDecisions.has(currentExercise.exerciseId) && (
                <DecisionBadge
                  type={exerciseDecisions.get(currentExercise.exerciseId)!.type}
                  summary={exerciseDecisions.get(currentExercise.exerciseId)!.summary}
                  confidence={exerciseDecisions.get(currentExercise.exerciseId)!.confidence}
                  onPress={() => openDecisionModal(currentExercise.exerciseId)}
                />
              )}
            </View>
            <Text style={styles.exerciseTarget}>
              Target: {currentExercise.repRange[0]}-{currentExercise.repRange[1]} reps
            </Text>
          </View>
          <TouchableOpacity
            style={styles.swapButton}
            onPress={() => setShowExerciseActions(true)}
          >
            <MoreHorizontal size={16} color="#3B82F6" />
            <Text style={styles.swapButtonText}>Actions</Text>
          </TouchableOpacity>
        </View>

        {/* Last Performance */}
        {currentExercise.lastPerformance && (
          <View style={styles.lastPerformance}>
            <TrendingUp size={14} color="#10B981" />
            <Text style={styles.lastPerformanceText}>
              Last: {currentExercise.lastPerformance.weight}lbs ×{" "}
              {currentExercise.lastPerformance.reps} reps
              {currentExercise.lastPerformance.rpe &&
                ` @ RPE ${currentExercise.lastPerformance.rpe}`}
            </Text>
          </View>
        )}

        {/* Sets */}
        {currentExercise.sets.map((set, setIndex) => (
          <View
            key={setIndex}
            style={[styles.setCard, set.completed && styles.setCardCompleted]}
          >
            <View style={styles.setHeader}>
              <Text style={styles.setNumber}>Set {set.setNumber}</Text>
              {set.completed && (
                <View style={styles.completedBadge}>
                  <Check size={14} color="#FFFFFF" />
                </View>
              )}
            </View>

            <View style={styles.inputsRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Weight (lbs)</Text>
                <View style={styles.inputWithButtons}>
                  <TouchableOpacity
                    style={styles.inputButton}
                    onPress={() => {
                      const current = parseFloat(set.weight) || 0;
                      updateSet(
                        currentExerciseIndex,
                        setIndex,
                        "weight",
                        String(Math.max(0, current - 5))
                      );
                    }}
                    disabled={set.completed}
                  >
                    <Minus size={16} color={set.completed ? "#475569" : "#94A3B8"} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.input}
                    value={set.weight}
                    onChangeText={(v) =>
                      updateSet(currentExerciseIndex, setIndex, "weight", v)
                    }
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#64748B"
                    editable={!set.completed}
                  />
                  <TouchableOpacity
                    style={styles.inputButton}
                    onPress={() => {
                      const current = parseFloat(set.weight) || 0;
                      updateSet(
                        currentExerciseIndex,
                        setIndex,
                        "weight",
                        String(current + 5)
                      );
                    }}
                    disabled={set.completed}
                  >
                    <Plus size={16} color={set.completed ? "#475569" : "#94A3B8"} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reps</Text>
                <View style={styles.inputWithButtons}>
                  <TouchableOpacity
                    style={styles.inputButton}
                    onPress={() => {
                      const current = parseInt(set.reps) || 0;
                      updateSet(
                        currentExerciseIndex,
                        setIndex,
                        "reps",
                        String(Math.max(0, current - 1))
                      );
                    }}
                    disabled={set.completed}
                  >
                    <Minus size={16} color={set.completed ? "#475569" : "#94A3B8"} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.input}
                    value={set.reps}
                    onChangeText={(v) =>
                      updateSet(currentExerciseIndex, setIndex, "reps", v)
                    }
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#64748B"
                    editable={!set.completed}
                  />
                  <TouchableOpacity
                    style={styles.inputButton}
                    onPress={() => {
                      const current = parseInt(set.reps) || 0;
                      updateSet(
                        currentExerciseIndex,
                        setIndex,
                        "reps",
                        String(current + 1)
                      );
                    }}
                    disabled={set.completed}
                  >
                    <Plus size={16} color={set.completed ? "#475569" : "#94A3B8"} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.inputGroup, styles.inputGroupSmall]}>
                <Text style={styles.inputLabel}>RPE</Text>
                <TextInput
                  style={[styles.input, styles.inputSmall]}
                  value={set.rpe}
                  onChangeText={(v) =>
                    updateSet(currentExerciseIndex, setIndex, "rpe", v)
                  }
                  keyboardType="numeric"
                  placeholder="7"
                  placeholderTextColor="#64748B"
                  editable={!set.completed}
                />
              </View>
            </View>

            {!set.completed && (
              <TouchableOpacity
                style={styles.completeSetButton}
                onPress={() => completeSetAction(currentExerciseIndex, setIndex)}
              >
                <Check size={18} color="#FFFFFF" />
                <Text style={styles.completeSetText}>Complete Set</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Next Exercise / Finish */}
        <View style={styles.bottomActions}>
          {currentExerciseIndex < exercises.length - 1 ? (
            <TouchableOpacity
              style={styles.nextButton}
              onPress={() => setCurrentExerciseIndex(currentExerciseIndex + 1)}
            >
              <Text style={styles.nextButtonText}>Next Exercise</Text>
              <ChevronRight size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextButton, styles.finishButton]}
              onPress={finishWorkout}
            >
              <Text style={styles.nextButtonText}>Finish Workout</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
  },
  loadingText: {
    color: "#94A3B8",
    marginTop: 12,
  },
  // Rest Timer Overlay
  restOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  restCard: {
    backgroundColor: "#1E293B",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "80%",
  },
  restTitle: {
    color: "#94A3B8",
    fontSize: 16,
    marginTop: 8,
  },
  restTime: {
    color: "#F8FAFC",
    fontSize: 64,
    fontWeight: "700",
    marginVertical: 16,
  },
  restProgress: {
    width: "100%",
    height: 6,
    backgroundColor: "#334155",
    borderRadius: 3,
    marginBottom: 24,
  },
  restProgressFill: {
    height: 6,
    backgroundColor: "#3B82F6",
    borderRadius: 3,
  },
  restActions: {
    flexDirection: "row",
    gap: 12,
  },
  restActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#334155",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  skipButton: {
    backgroundColor: "#475569",
  },
  restActionText: {
    color: "#F8FAFC",
    fontWeight: "600",
  },
  // Progress Header
  progressHeader: {
    padding: 16,
    backgroundColor: "#1E293B",
  },
  progressText: {
    color: "#F8FAFC",
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#334155",
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: "#3B82F6",
    borderRadius: 2,
  },
  // Tabs
  tabsContainer: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#334155",
    minWidth: 80,
  },
  tabActive: {
    backgroundColor: "#3B82F6",
  },
  tabCompleted: {
    backgroundColor: "#166534",
  },
  tabText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  tabProgress: {
    color: "#64748B",
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
  },
  // Content
  content: {
    flex: 1,
    padding: 16,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  exerciseTitleContainer: {
    flex: 1,
  },
  exerciseTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  exerciseTitle: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  exerciseTarget: {
    color: "#3B82F6",
    fontSize: 14,
  },
  swapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  swapButtonText: {
    color: "#3B82F6",
    fontSize: 14,
    fontWeight: "600",
  },
  // Substitution Modal
  substituteCard: {
    backgroundColor: "#1E293B",
    borderRadius: 24,
    padding: 24,
    width: "90%",
    maxHeight: "70%",
  },
  substituteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  substituteTitle: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "700",
  },
  closeButton: {
    padding: 4,
  },
  substituteSubtitle: {
    color: "#94A3B8",
    fontSize: 14,
    marginBottom: 20,
  },
  substituteLoader: {
    marginVertical: 40,
  },
  noSubstitutes: {
    color: "#64748B",
    textAlign: "center",
    marginVertical: 40,
  },
  substituteList: {
    maxHeight: 300,
  },
  substituteItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#334155",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  substituteInfo: {
    flex: 1,
  },
  substituteName: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
  },
  substituteMatch: {
    color: "#10B981",
    fontSize: 12,
    marginTop: 2,
  },
  substituteEquipment: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
    textTransform: "capitalize",
  },
  lastPerformance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  lastPerformanceText: {
    color: "#10B981",
    fontSize: 13,
  },
  // Set Card
  setCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  setCardCompleted: {
    opacity: 0.6,
  },
  setHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  setNumber: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
  },
  completedBadge: {
    backgroundColor: "#22C55E",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  inputsRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputGroupSmall: {
    flex: 0.6,
  },
  inputLabel: {
    color: "#94A3B8",
    fontSize: 12,
    marginBottom: 6,
  },
  inputWithButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  inputButton: {
    width: 32,
    height: 44,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#334155",
    borderRadius: 8,
    padding: 12,
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginHorizontal: 4,
  },
  inputSmall: {
    marginHorizontal: 0,
  },
  completeSetButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  completeSetText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  // Bottom Actions
  bottomActions: {
    marginTop: 12,
  },
  nextButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  finishButton: {
    backgroundColor: "#22C55E",
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  bottomPadding: {
    height: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Readiness Check-in
  readinessContainer: {
    flex: 1,
    backgroundColor: "#0F172A",
    padding: 24,
  },
  readinessTitle: {
    color: "#F8FAFC",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 40,
    marginBottom: 8,
  },
  readinessSubtitle: {
    color: "#94A3B8",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
  },
  readinessSlider: {
    marginBottom: 28,
  },
  readinessLabel: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  readinessButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  readinessButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  readinessButtonText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  readinessButtonTextActive: {
    color: "#FFFFFF",
  },
  readinessLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  readinessLabelSmall: {
    color: "#64748B",
    fontSize: 12,
  },
  readinessProceedButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  readinessProceedText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  readinessSkipButton: {
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  readinessSkipText: {
    color: "#64748B",
    fontSize: 14,
  },
  readinessScoreCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginVertical: 24,
  },
  readinessScore: {
    fontSize: 64,
    fontWeight: "700",
  },
  readinessRecommendation: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 8,
  },
  readinessAdjustments: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  readinessAdjustmentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  readinessAdjustmentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  readinessAdjustmentText: {
    color: "#F8FAFC",
    fontSize: 14,
  },
  // Load Recommendation Modal
  recommendationCard: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 24,
    width: "90%",
    alignItems: "center",
  },
  recommendationHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  recommendationIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  recommendationIconIncrease: {
    backgroundColor: "#22C55E",
  },
  recommendationIconDecrease: {
    backgroundColor: "#EF4444",
  },
  recommendationIconMaintain: {
    backgroundColor: "#3B82F6",
  },
  recommendationTitle: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  recommendationExercise: {
    color: "#94A3B8",
    fontSize: 14,
    marginBottom: 20,
  },
  recommendationWeight: {
    backgroundColor: "#334155",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  recommendationWeightLabel: {
    color: "#94A3B8",
    fontSize: 12,
    marginBottom: 4,
  },
  recommendationWeightValue: {
    color: "#F8FAFC",
    fontSize: 32,
    fontWeight: "700",
  },
  recommendationReason: {
    color: "#94A3B8",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  recommendationButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    alignItems: "center",
  },
  recommendationButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  celebrationOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  celebrationCard: {
    backgroundColor: "#1E293B",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    maxWidth: 320,
    width: "90%",
  },
  celebrationTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 8,
    textAlign: "center",
  },
  celebrationSubtitle: {
    fontSize: 16,
    color: "#94A3B8",
    marginBottom: 24,
    textAlign: "center",
  },
  undoButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  undoButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  undoTimer: {
    color: "#64748B",
    fontSize: 14,
  },
});
