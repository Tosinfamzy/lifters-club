import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { AlternativeExerciseCard } from "../../components";
import { offlineStorage } from "../../lib/offline/storage";
import { useApi } from "../../hooks/use-api";
import type { ScoredSubstitute } from "../../lib/api";

interface CurrentExerciseData {
  name: string;
  sets: number;
  repRange: [number, number];
}

export default function ExerciseAlternativesScreen() {
  const { exerciseId, workoutLogId, currentExercise } = useLocalSearchParams<{
    exerciseId: string;
    workoutLogId?: string;
    currentExercise?: string;
  }>();
  const router = useRouter();
  const api = useApi();

  const [substitutes, setSubstitutes] = useState<ScoredSubstitute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubstitute, setSelectedSubstitute] = useState<string | null>(null);
  const [rememberChoice, setRememberChoice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Safely parse current exercise data with try-catch
  let currentExerciseData: CurrentExerciseData | null = null;
  if (currentExercise) {
    try {
      currentExerciseData = JSON.parse(currentExercise);
    } catch {
      console.error("Failed to parse current exercise data");
    }
  }

  useEffect(() => {
    loadSubstitutes();
  }, [exerciseId]);

  const loadSubstitutes = async () => {
    if (!exerciseId) {
      setError("No exercise ID provided");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try cache first (24h TTL)
      const cachedSubstitutes = await offlineStorage.getCachedSubstitutes(exerciseId);

      if (cachedSubstitutes) {
        console.log("Using cached substitutes");
        setSubstitutes(cachedSubstitutes);
        setIsLoading(false);
        return;
      }

      // Fetch from API
      const data = await api.getExerciseSubstitutes(exerciseId, { limit: 5 });
      const substitutesData = data.data?.substitutes || [];

      // Cache for 24h
      await offlineStorage.setCachedSubstitutes(exerciseId, substitutesData);

      setSubstitutes(substitutesData);
    } catch (err) {
      console.error("Error loading substitutes:", err);
      setError("Failed to load alternative exercises");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSubstitute = (substituteId: string) => {
    setSelectedSubstitute(substituteId);
  };

  const handleSwitch = async () => {
    if (!selectedSubstitute) {
      Alert.alert("No Selection", "Please select an alternative exercise first.");
      return;
    }

    try {
      const selectedExercise = substitutes.find(s => s.exercise.id === selectedSubstitute);

      if (!selectedExercise) {
        Alert.alert("Error", "Selected exercise not found.");
        return;
      }

      // Store preference if "Remember My Choice" is checked
      if (rememberChoice && exerciseId) {
        await offlineStorage.storeExercisePreference({
          originalId: exerciseId,
          substituteId: selectedSubstitute,
          timestamp: new Date().toISOString(),
          reason: selectedExercise.reasons[0] || "User selected",
        });
      }

      // Navigate back to workout screen with selected exercise data
      if (workoutLogId) {
        router.push({
          pathname: "/workout/[id]",
          params: {
            id: workoutLogId,
            substitutedExerciseId: selectedSubstitute,
            substitutedExerciseName: selectedExercise.exercise.name,
            originalExerciseId: exerciseId,
          },
        });
      } else {
        router.back();
      }

    } catch (err) {
      console.error("Error switching exercise:", err);
      Alert.alert("Error", "Failed to switch exercise. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#F8FAFC" />
          </TouchableOpacity>
          <Text style={styles.title}>Alternative Exercises</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading alternatives...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#F8FAFC" />
          </TouchableOpacity>
          <Text style={styles.title}>Alternative Exercises</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSubstitutes}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.title}>Alternative Exercises</Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Original Exercise */}
        {currentExerciseData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Exercise</Text>
            <AlternativeExerciseCard
              exercise={{
                id: exerciseId || "",
                name: currentExerciseData.name,
                difficulty: "intermediate", // Placeholder
                equipment: [], // Placeholder
              }}
              matchScore={1}
              matchReasons={[]}
              sets={currentExerciseData.sets}
              repRange={currentExerciseData.repRange}
              isOriginal={true}
              isSelected={false}
            />
          </View>
        )}

        {/* Alternative Exercises */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alternatives</Text>
          {substitutes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No alternative exercises found
              </Text>
            </View>
          ) : (
            substitutes.map((substitute) => (
              <AlternativeExerciseCard
                key={substitute.exercise.id}
                exercise={substitute.exercise}
                matchScore={substitute.score}
                matchReasons={substitute.reasons}
                sets={currentExerciseData?.sets || 3}
                repRange={currentExerciseData?.repRange || [8, 12]}
                isOriginal={false}
                isSelected={selectedSubstitute === substitute.exercise.id}
                onPress={() => handleSelectSubstitute(substitute.exercise.id)}
              />
            ))
          )}
        </View>

        {/* Remember Choice Checkbox */}
        {selectedSubstitute && (
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setRememberChoice(!rememberChoice)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, rememberChoice && styles.checkboxChecked]}>
              {rememberChoice && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Remember My Choice</Text>
          </TouchableOpacity>
        )}

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          This change applies to the current workout only.
        </Text>

        {/* Spacer for button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Switch Button (Fixed at bottom) */}
      {selectedSubstitute && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.switchButton}
            onPress={handleSwitch}
            activeOpacity={0.8}
          >
            <Text style={styles.switchButtonText}>SWITCH</Text>
            <ArrowRight size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}
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
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#94A3B8",
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#94A3B8",
    textAlign: "center",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#94A3B8",
    borderRadius: 4,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  checkmark: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F8FAFC",
  },
  disclaimer: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 16,
    fontStyle: "italic",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#0F172A",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  switchButton: {
    backgroundColor: "#10B981",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  switchButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
});
