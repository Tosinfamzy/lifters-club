import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Zap,
  Clock,
  Dumbbell,
  ChevronRight,
  AlertCircle,
} from "lucide-react-native";
import { useApi } from "../hooks/use-api";
import type { GenerateStandaloneWorkoutResponse } from "../lib/api";

const MUSCLE_GROUPS = [
  { id: "chest", label: "Chest", icon: "💪" },
  { id: "back", label: "Back", icon: "🔙" },
  { id: "legs", label: "Legs", icon: "🦵" },
  { id: "shoulders", label: "Shoulders", icon: "🏋️" },
  { id: "arms", label: "Arms", icon: "💪" },
  { id: "core", label: "Core", icon: "🎯" },
] as const;

const DURATION_OPTIONS = [
  { value: 30, label: "30 min", description: "Quick session" },
  { value: 45, label: "45 min", description: "Standard" },
  { value: 60, label: "60 min", description: "Full session" },
  { value: 90, label: "90 min", description: "Extended" },
] as const;

type Step = "muscles" | "duration" | "generating" | "preview";

export default function QuickWorkoutScreen() {
  const router = useRouter();
  const api = useApi();

  const [step, setStep] = useState<Step>("muscles");
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [duration, setDuration] = useState(45);
  const [result, setResult] = useState<GenerateStandaloneWorkoutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleMuscle = (muscleId: string) => {
    setSelectedMuscles((prev) =>
      prev.includes(muscleId)
        ? prev.filter((m) => m !== muscleId)
        : [...prev, muscleId]
    );
  };

  const handleGenerate = useCallback(async () => {
    setStep("generating");
    setError(null);

    try {
      const response = await api.generateStandaloneWorkout({
        scheduledDate: new Date().toISOString().slice(0, 10),
        focusMuscles: selectedMuscles,
        sessionDurationMinutes: duration,
      });
      setResult(response.data);
      setStep("preview");
    } catch (err) {
      console.error("Failed to generate workout:", err);
      setError("Failed to generate workout. Please try again.");
      setStep("duration");
    }
  }, [api, selectedMuscles, duration]);

  const handleStartWorkout = useCallback(async () => {
    if (!result?.workout) return;

    try {
      await api.startStandaloneWorkout(result.workout.id);
      // Navigate to a workout detail/log screen
      // For now, go back to home — the workout will show as "in_progress"
      router.replace("/(tabs)");
    } catch (err) {
      console.error("Failed to start workout:", err);
      setError("Failed to start workout. Please try again.");
    }
  }, [api, result, router]);

  const formatExerciseName = (id: string): string => {
    return id
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (step === "duration") setStep("muscles");
            else if (step === "preview") setStep("duration");
            else router.back();
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.title}>Quick Workout</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 1: Muscle Group Selection */}
        {step === "muscles" && (
          <View>
            <View style={styles.stepHeader}>
              <Zap size={20} color="#3B82F6" />
              <Text style={styles.stepTitle}>Target Muscles</Text>
            </View>
            <Text style={styles.stepDescription}>
              Select one or more muscle groups to focus on
            </Text>

            <View style={styles.muscleGrid}>
              {MUSCLE_GROUPS.map((muscle) => {
                const isSelected = selectedMuscles.includes(muscle.id);
                return (
                  <TouchableOpacity
                    key={muscle.id}
                    style={[
                      styles.muscleCard,
                      isSelected && styles.muscleCardSelected,
                    ]}
                    onPress={() => toggleMuscle(muscle.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.muscleIcon}>{muscle.icon}</Text>
                    <Text
                      style={[
                        styles.muscleLabel,
                        isSelected && styles.muscleLabelSelected,
                      ]}
                    >
                      {muscle.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                selectedMuscles.length === 0 && styles.primaryButtonDisabled,
              ]}
              onPress={() => setStep("duration")}
              disabled={selectedMuscles.length === 0}
            >
              <Text style={styles.primaryButtonText}>Next</Text>
              <ChevronRight size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Duration Selection */}
        {step === "duration" && (
          <View>
            <View style={styles.stepHeader}>
              <Clock size={20} color="#3B82F6" />
              <Text style={styles.stepTitle}>Session Duration</Text>
            </View>
            <Text style={styles.stepDescription}>
              How much time do you have?
            </Text>

            <View style={styles.durationGrid}>
              {DURATION_OPTIONS.map((option) => {
                const isSelected = duration === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.durationCard,
                      isSelected && styles.durationCardSelected,
                    ]}
                    onPress={() => setDuration(option.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.durationValue,
                        isSelected && styles.durationValueSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.durationDescription}>
                      {option.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Workout Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Muscles:</Text>
                <Text style={styles.summaryValue}>
                  {selectedMuscles
                    .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
                    .join(", ")}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Duration:</Text>
                <Text style={styles.summaryValue}>{duration} minutes</Text>
              </View>
            </View>

            {error && (
              <View style={styles.errorCard}>
                <AlertCircle size={16} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleGenerate}
            >
              <Zap size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Generate Workout</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: Generating */}
        {step === "generating" && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.generatingText}>
              Building your workout...
            </Text>
            <Text style={styles.generatingSubtext}>
              Selecting exercises based on your history and goals
            </Text>
          </View>
        )}

        {/* Step 4: Workout Preview */}
        {step === "preview" && result && (
          <View>
            <View style={styles.stepHeader}>
              <Dumbbell size={20} color="#10B981" />
              <Text style={styles.stepTitle}>Your Workout</Text>
            </View>

            {/* Duration estimate */}
            <View style={styles.estimateCard}>
              <Clock size={16} color="#94A3B8" />
              <Text style={styles.estimateText}>
                ~{result.estimatedDuration} min estimated
              </Text>
            </View>

            {/* Exercises */}
            <View style={styles.exerciseList}>
              {result.workout.exercises.map((exercise, index) => (
                <View key={exercise.exerciseId} style={styles.exerciseCard}>
                  <View style={styles.exerciseNumber}>
                    <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.exerciseDetails}>
                    <Text style={styles.exerciseName}>
                      {formatExerciseName(exercise.exerciseId)}
                    </Text>
                    <Text style={styles.exerciseMeta}>
                      {exercise.sets} sets x {exercise.repRange[0]}-
                      {exercise.repRange[1]} reps
                      {exercise.targetWeight
                        ? ` @ ${exercise.targetWeight}lbs`
                        : ""}
                    </Text>
                    <Text style={styles.exerciseRest}>
                      Rest: {exercise.restSeconds}s
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Reasoning */}
            {result.reasoning.length > 0 && (
              <View style={styles.reasoningCard}>
                <Text style={styles.reasoningTitle}>Why these exercises?</Text>
                {result.reasoning.map((reason, index) => (
                  <Text key={index} style={styles.reasoningItem}>
                    • {reason}
                  </Text>
                ))}
              </View>
            )}

            {error && (
              <View style={styles.errorCard}>
                <AlertCircle size={16} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleStartWorkout}
            >
              <Zap size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Start Workout</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setResult(null);
                setStep("duration");
              }}
            >
              <Text style={styles.secondaryButtonText}>Regenerate</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  backButton: {
    marginRight: 12,
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  stepDescription: {
    color: "#94A3B8",
    fontSize: 14,
    marginBottom: 20,
  },
  muscleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  muscleCard: {
    width: "47%",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  muscleCardSelected: {
    borderColor: "#3B82F6",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  muscleIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  muscleLabel: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
  },
  muscleLabelSelected: {
    color: "#F8FAFC",
  },
  durationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  durationCard: {
    width: "47%",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  durationCardSelected: {
    borderColor: "#3B82F6",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  durationValue: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "700",
  },
  durationValueSelected: {
    color: "#3B82F6",
  },
  durationDescription: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryTitle: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    color: "#94A3B8",
    fontSize: 13,
  },
  summaryValue: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },
  primaryButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: "#334155",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  secondaryButtonText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "500",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  generatingText: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 24,
  },
  generatingSubtext: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  estimateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1E293B",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  estimateText: {
    color: "#94A3B8",
    fontSize: 13,
  },
  exerciseList: {
    gap: 8,
    marginBottom: 16,
  },
  exerciseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 14,
    gap: 14,
  },
  exerciseNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseNumberText: {
    color: "#3B82F6",
    fontSize: 14,
    fontWeight: "700",
  },
  exerciseDetails: {
    flex: 1,
  },
  exerciseName: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "600",
  },
  exerciseMeta: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 2,
  },
  exerciseRest: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  reasoningCard: {
    backgroundColor: "rgba(59, 130, 246, 0.05)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.15)",
  },
  reasoningTitle: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  reasoningItem: {
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    flex: 1,
  },
});
