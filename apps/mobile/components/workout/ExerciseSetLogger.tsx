import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { TrendingUp, MoreHorizontal, ChevronRight } from "lucide-react-native";
import type { ExerciseDecision } from "../../hooks/use-exercise-decisions";
import { styles } from "./workout.styles";
import { SetInputRow } from "./SetInputRow";
import { DecisionBadge } from "./DecisionBadge";
import type { ExerciseProgress } from "./workout.types";

interface ExerciseSetLoggerProps {
  exercise: ExerciseProgress;
  exerciseIndex: number;
  isLastExercise: boolean;
  exerciseDecision?: ExerciseDecision;
  onUpdateSet: (setIndex: number, field: "weight" | "reps" | "rpe", value: string) => void;
  onCompleteSet: (setIndex: number) => void;
  onNextExercise: () => void;
  onFinishWorkout: () => void;
  onShowActions: () => void;
  onOpenDecision: () => void;
}

export function ExerciseSetLogger({
  exercise,
  isLastExercise,
  exerciseDecision,
  onUpdateSet,
  onCompleteSet,
  onNextExercise,
  onFinishWorkout,
  onShowActions,
  onOpenDecision,
}: ExerciseSetLoggerProps) {
  return (
    <ScrollView
      style={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseTitleContainer}>
          <View style={styles.exerciseTitleRow}>
            <Text style={styles.exerciseTitle}>{exercise.exerciseName}</Text>
            {exerciseDecision && (
              <DecisionBadge
                type={exerciseDecision.type}
                summary={exerciseDecision.summary}
                confidence={exerciseDecision.confidence}
                onPress={onOpenDecision}
              />
            )}
          </View>
          <Text style={styles.exerciseTarget}>
            Target: {exercise.repRange[0]}-{exercise.repRange[1]} reps
          </Text>
        </View>
        <TouchableOpacity style={styles.swapButton} onPress={onShowActions}>
          <MoreHorizontal size={16} color="#3B82F6" />
          <Text style={styles.swapButtonText}>Actions</Text>
        </TouchableOpacity>
      </View>

      {exercise.lastPerformance && (
        <View style={styles.lastPerformance}>
          <TrendingUp size={14} color="#10B981" />
          <Text style={styles.lastPerformanceText}>
            Last: {exercise.lastPerformance.weight}lbs ×{" "}
            {exercise.lastPerformance.reps} reps
            {exercise.lastPerformance.rpe &&
              ` @ RPE ${exercise.lastPerformance.rpe}`}
          </Text>
        </View>
      )}

      {exercise.sets.map((set, setIndex) => (
        <SetInputRow
          key={setIndex}
          set={set}
          setIndex={setIndex}
          onUpdateField={(field, value) => onUpdateSet(setIndex, field, value)}
          onComplete={() => onCompleteSet(setIndex)}
        />
      ))}

      <View style={styles.bottomActions}>
        {!isLastExercise ? (
          <TouchableOpacity style={styles.nextButton} onPress={onNextExercise}>
            <Text style={styles.nextButtonText}>Next Exercise</Text>
            <ChevronRight size={20} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextButton, styles.finishButton]}
            onPress={onFinishWorkout}
          >
            <Text style={styles.nextButtonText}>Finish Workout</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}
