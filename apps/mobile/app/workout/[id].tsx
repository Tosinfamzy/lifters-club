import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppUser } from "../../providers/user-provider";
import { useWorkoutOffline } from "../../hooks";
import { useApi } from "../../hooks/use-api";
import { useRestTimer } from "../../hooks/use-rest-timer";
import { useReadinessCheck } from "../../hooks/use-readiness-check";
import { useExerciseDecisions } from "../../hooks/use-exercise-decisions";
import { useWorkoutCompletion } from "../../hooks/use-workout-completion";
import { OfflineIndicator } from "../../components/OfflineIndicator";
import { ExerciseActionsSheet } from "../../components/ExerciseActionsSheet";
import { DecisionExplanationModal } from "../../components/workout/DecisionExplanationModal";
import { ReadinessCheckView } from "../../components/workout/ReadinessCheckView";
import { ExerciseSetLogger } from "../../components/workout/ExerciseSetLogger";
import { RestTimerOverlay } from "../../components/workout/RestTimerOverlay";
import { LoadRecommendationModal } from "../../components/workout/LoadRecommendationModal";
import { WorkoutCompletionView } from "../../components/workout/WorkoutCompletionView";
import { WithinSessionCoachCard } from "../../components/workout/WithinSessionCoachCard";
import { buildWithinSessionInput } from "../../components/workout/within-session";
import { styles } from "../../components/workout/workout.styles";
import type {
  ExerciseProgress,
  LoadRecommendation,
  WithinSessionSuggestion,
} from "../../components/workout/workout.types";

type ExerciseAction = "info" | "alternatives" | "skip" | "mark_done";

export default function WorkoutScreen() {
  const { id, substitutedExerciseId, substitutedExerciseName, originalExerciseId } =
    useLocalSearchParams<{
      id: string;
      substitutedExerciseId?: string;
      substitutedExerciseName?: string;
      originalExerciseId?: string;
    }>();
  const router = useRouter();
  const api = useApi();
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

  // Core workout state
  const [isLoading, setIsLoading] = useState(true);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [exercises, setExercises] = useState<ExerciseProgress[]>([]);
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null);
  const [showExerciseActions, setShowExerciseActions] = useState(false);

  // Load progression recommendations
  const [loadRecommendations, setLoadRecommendations] = useState<Map<string, LoadRecommendation>>(new Map());
  const [showRecommendation, setShowRecommendation] = useState<string | null>(null);
  // Live per-set coaching shown in the rest overlay (cleared when the next set starts).
  const [activeSuggestion, setActiveSuggestion] = useState<WithinSessionSuggestion | null>(null);

  // Extracted hooks
  const { restTimeRemaining, isResting, targetRestTime, startRest, skipRest, addTime } =
    useRestTimer();

  const {
    showReadinessCheck, readinessResult, readinessInputs, isSubmittingReadiness,
    setReadinessInputs, submitReadinessCheck, skipReadiness,
  } = useReadinessCheck(appUser?.id, id || "");

  const {
    exerciseDecisions, selectedDecision, showDecisionModal, setShowDecisionModal,
    fetchExerciseDecisions, openDecisionModal, handleAcceptDecision, handleOverrideDecision,
    recordDecisionOutcome,
  } = useExerciseDecisions(workout, isOnline);

  const { recentlyCompleted, countdownSeconds, finishWorkout, undoCompletion } =
    useWorkoutCompletion(completeWorkoutAction, router);

  // Initialize workout data from cached/fetched workout
  const initializeWorkout = useCallback(async () => {
    if (!appUser || !workout) return;

    try {
      const plannedExercises = workout.plannedExercises;

      const exerciseProgress: ExerciseProgress[] = plannedExercises.map((ex) => {
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
          lastPerformance: undefined,
        };
      });

      setExercises(exerciseProgress);

      if (existingLog) {
        setWorkoutLogId(existingLog.id);

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

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (appUser && workout && !isWorkoutLoading && !hasInitialized.current) {
      hasInitialized.current = true;
      initializeWorkout();
      fetchExerciseDecisions();
    }
  }, [appUser, workout, isWorkoutLoading, initializeWorkout, fetchExerciseDecisions]);

  // Handle exercise substitution from alternative exercises screen
  useEffect(() => {
    if (substitutedExerciseId && substitutedExerciseName && originalExerciseId) {
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

        router.setParams({
          substitutedExerciseId: undefined,
          substitutedExerciseName: undefined,
          originalExerciseId: undefined,
        });

        Alert.alert("Exercise Swapped", `Switched to ${substitutedExerciseName}`);
      }
    }
  }, [substitutedExerciseId, substitutedExerciseName, originalExerciseId, exercises, router]);

  const fetchLoadRecommendation = async (exercise: ExerciseProgress) => {
    const completedSets = exercise.sets.filter((s) => s.completed && s.weight && s.reps);
    if (completedSets.length === 0) return;

    const recentSets = completedSets.map((s) => ({
      reps: parseInt(s.reps),
      rpe: s.rpe ? parseFloat(s.rpe) : undefined,
      weight: parseFloat(s.weight),
    }));

    const avgWeight = recentSets.reduce((sum, s) => sum + s.weight, 0) / recentSets.length;

    try {
      const response = await api.getLoadProgression({
        exerciseId: exercise.exerciseId,
        recentSets,
        currentWeight: avgWeight,
        targetRepRange: exercise.repRange,
      });

      const recommendation: LoadRecommendation = {
        exerciseId: exercise.exerciseId,
        action: response.data.action,
        newWeight: response.data.recommendedWeight,
        reason: response.data.reason,
      };

      setLoadRecommendations((prev) => {
        const updated = new Map(prev);
        updated.set(exercise.exerciseId, recommendation);
        return updated;
      });

      setShowRecommendation(exercise.exerciseId);
    } catch (error) {
      console.error("Failed to fetch load recommendation:", error);
    }
  };

  // Fetch a live next-set suggestion from the set just completed. Non-blocking:
  // the rest timer starts regardless; the card pops into the overlay when this
  // lands. Only meaningful when another set follows (caller guards on that).
  const fetchWithinSessionSuggestion = async (
    exercise: ExerciseProgress,
    exerciseIndex: number,
    setIndex: number
  ) => {
    const input = buildWithinSessionInput(exercise, setIndex);
    if (!input) return;

    try {
      const response = await api.getWithinSessionAdjustment({
        ...input,
        userId: appUser?.id,
        workoutId: id,
      });

      setActiveSuggestion({
        exerciseId: exercise.exerciseId,
        exerciseIndex,
        setIndex,
        action: response.data.action,
        nextSetWeight: response.data.nextSetWeight,
        previousWeight: input.completedSet.weight,
        reason: response.data.reason,
        decisionId: response.data.decisionId,
        newBaselineIfConfirmed: response.data.newBaselineIfConfirmed,
      });
    } catch (error) {
      console.error("Failed to fetch within-session suggestion:", error);
    }
  };

  // Accept the live suggestion: record it as followed and pre-fill the next
  // (uncompleted) set's weight so the athlete starts from the prescribed load.
  const handleAcceptSuggestion = () => {
    const s = activeSuggestion;
    if (!s) return;
    if (s.decisionId) recordDecisionOutcome(s.decisionId, "followed");

    const nextSetIndex = s.setIndex + 1;
    const nextSet = exercises[s.exerciseIndex]?.sets[nextSetIndex];
    if (nextSet && !nextSet.completed) {
      updateSet(s.exerciseIndex, nextSetIndex, "weight", String(s.nextSetWeight));
    }
    setActiveSuggestion(null);
  };

  // Dismiss the suggestion: record it as overridden (feeds self-tuning).
  const handleDismissSuggestion = () => {
    const s = activeSuggestion;
    if (!s) return;
    if (s.decisionId) recordDecisionOutcome(s.decisionId, "overridden");
    setActiveSuggestion(null);
  };

  const handleExerciseAction = useCallback(
    (action: ExerciseAction) => {
      setShowExerciseActions(false);
      const exercise = exercises[currentExerciseIndex];
      if (!exercise) return;

      switch (action) {
        case "info":
          router.push({
            pathname: "/exercise-info/[exerciseId]",
            params: { exerciseId: exercise.exerciseId },
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

            if (currentExerciseIndex < exercises.length - 1) {
              setCurrentExerciseIndex((prev) => prev + 1);
            }
          },
        },
      ]
    );
  }, [currentExerciseIndex, exercises.length]);

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
                  : { ...set, weight: lastSet.weight, reps: lastSet.reps, rpe: lastSet.rpe || "", completed: true }
              );
              return updated;
            });
          },
        },
      ]
    );
  }, [currentExerciseIndex, exercises]);

  const updateSet = (exerciseIndex: number, setIndex: number, field: "weight" | "reps" | "rpe", value: string) => {
    setExercises((prev) => {
      const updated = [...prev];
      updated[exerciseIndex]!.sets[setIndex]![field] = value;
      return updated;
    });
  };

  const completeSetAction = async (exerciseIndex: number, setIndex: number) => {
    const exercise = exercises[exerciseIndex]!;
    const set = exercise.sets[setIndex]!;

    if (!set.weight || !set.reps) {
      Alert.alert("Missing Info", "Please enter weight and reps");
      return;
    }

    // Clear any prior suggestion as this set is logged; a fresh one is fetched below.
    setActiveSuggestion(null);

    setExercises((prev) => {
      const updated = [...prev];
      updated[exerciseIndex]!.sets[setIndex]!.completed = true;
      return updated;
    });

    if (workoutLogId) {
      try {
        const loggedSet = await logSetAction(
          exercise.exerciseId,
          set.setNumber,
          parseFloat(set.weight),
          parseInt(set.reps),
          set.rpe ? parseFloat(set.rpe) : undefined
        );

        if (loggedSet) {
          setExercises((prev) => {
            const updated = [...prev];
            updated[exerciseIndex]!.sets[setIndex]!.id = loggedSet.id;
            return updated;
          });
        }
      } catch (error) {
        console.error("Failed to log set:", error);
      }
    }

    const updatedExercise = {
      ...exercise,
      sets: exercise.sets.map((s, i) => (i === setIndex ? { ...s, completed: true } : s)),
    };
    const allSetsCompleted = updatedExercise.sets.every((s) => s.completed);

    if (allSetsCompleted && isOnline) {
      fetchLoadRecommendation(updatedExercise);
    }

    const hasMoreSetsInExercise = exercise.sets.some((s, i) => i > setIndex && !s.completed);
    const hasMoreExercises = exerciseIndex < exercises.length - 1;

    if (hasMoreSetsInExercise || hasMoreExercises) {
      startRest(exercise.restSeconds);
    }

    // Live coaching for the next set of this exercise. Online-only (the engine is
    // server-side; a stale prescription is useless) and non-blocking — the card
    // pops into the rest overlay when it lands.
    if (hasMoreSetsInExercise && isOnline) {
      void fetchWithinSessionSuggestion(updatedExercise, exerciseIndex, setIndex);
    }
  };

  const handleFinishWorkout = () => finishWorkout(workoutLogId, exercises);

  // --- Render ---

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

  if (showReadinessCheck) {
    return (
      <ReadinessCheckView
        readinessResult={readinessResult}
        readinessInputs={readinessInputs}
        isSubmittingReadiness={isSubmittingReadiness}
        onInputChange={setReadinessInputs}
        onSubmit={submitReadinessCheck}
        onSkip={skipReadiness}
        onGoBack={() => router.back()}
      />
    );
  }

  const currentExercise = exercises[currentExerciseIndex]!;
  const totalSetsCompleted = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
    0
  );
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  const activeRecommendation = showRecommendation ? loadRecommendations.get(showRecommendation) : undefined;
  const activeRecommendationName = showRecommendation
    ? exercises.find((e) => e.exerciseId === showRecommendation)?.exerciseName || "Exercise"
    : "";

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <OfflineIndicator />

        {isResting && (
          <RestTimerOverlay
            timeRemaining={restTimeRemaining}
            targetTime={targetRestTime}
            onAddTime={addTime}
            onSkip={skipRest}
            coach={
              activeSuggestion ? (
                <WithinSessionCoachCard
                  suggestion={activeSuggestion}
                  onAccept={handleAcceptSuggestion}
                  onDismiss={handleDismissSuggestion}
                />
              ) : null
            }
          />
        )}

        <ExerciseActionsSheet
          visible={showExerciseActions}
          onClose={() => setShowExerciseActions(false)}
          exerciseId={currentExercise.exerciseId}
          exerciseName={currentExercise.exerciseName}
          onSelectAction={handleExerciseAction}
        />

        {selectedDecision && (
          <DecisionExplanationModal
            visible={showDecisionModal}
            decision={selectedDecision}
            onAccept={handleAcceptDecision}
            onOverride={handleOverrideDecision}
            onClose={() => setShowDecisionModal(false)}
          />
        )}

        {recentlyCompleted && (
          <WorkoutCompletionView
            countdownSeconds={countdownSeconds}
            onUndo={undoCompletion}
          />
        )}

        {activeRecommendation && (
          <LoadRecommendationModal
            recommendation={activeRecommendation}
            exerciseName={activeRecommendationName}
            onDismiss={() => setShowRecommendation(null)}
          />
        )}

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

        {/* Current Exercise Sets */}
        <ExerciseSetLogger
          exercise={currentExercise}
          exerciseIndex={currentExerciseIndex}
          isLastExercise={currentExerciseIndex >= exercises.length - 1}
          exerciseDecision={exerciseDecisions.get(currentExercise.exerciseId)}
          onUpdateSet={(setIndex, field, value) =>
            updateSet(currentExerciseIndex, setIndex, field, value)
          }
          onCompleteSet={(setIndex) =>
            completeSetAction(currentExerciseIndex, setIndex)
          }
          onNextExercise={() => setCurrentExerciseIndex(currentExerciseIndex + 1)}
          onFinishWorkout={handleFinishWorkout}
          onShowActions={() => setShowExerciseActions(true)}
          onOpenDecision={() => openDecisionModal(currentExercise.exerciseId)}
        />
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
