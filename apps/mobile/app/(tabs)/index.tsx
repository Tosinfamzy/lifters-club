import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Play, Calendar, Target } from "lucide-react-native";
import { useAppUser } from "../../providers/user-provider";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repRange: [number, number];
  restSeconds: number;
  notes?: string;
}

interface Workout {
  id: string;
  scheduledDate: string;
  weekNumber: number;
  dayNumber: number;
  plannedExercises: PlannedExercise[];
  status: string;
}

export default function TodayScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { appUser } = useAppUser();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTodaysWorkout = useCallback(async () => {
    if (!appUser) return;

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/workouts/today`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWorkout(data.data);
      } else {
        setWorkout(null);
      }
    } catch {
      setError("Could not connect to server");
    } finally {
      setIsLoading(false);
    }
  }, [appUser, getToken]);

  useEffect(() => {
    if (appUser) {
      fetchTodaysWorkout();
    }
  }, [appUser, fetchTodaysWorkout]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    await fetchTodaysWorkout();
    setRefreshing(false);
  }, [fetchTodaysWorkout]);

  const handleStartWorkout = () => {
    if (workout) {
      router.push(`/workout/${workout.id}`);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchTodaysWorkout}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={styles.centered}>
        <Calendar size={64} color="#94A3B8" />
        <Text style={styles.noWorkoutTitle}>No Workout Today</Text>
        <Text style={styles.noWorkoutText}>
          Start a program to get scheduled workouts
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
      }
    >
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Today&apos;s Workout</Text>
            <Text style={styles.headerSubtitle}>
              Week {workout.weekNumber} • Day {workout.dayNumber}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {workout.status === "pending" ? "Ready" : workout.status}
            </Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Target size={16} color="#94A3B8" />
            <Text style={styles.statText}>
              {workout.plannedExercises.length} exercises
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statText}>
              {workout.plannedExercises.reduce((sum, ex) => sum + ex.sets, 0)} total sets
            </Text>
          </View>
        </View>
      </View>

      {/* Exercise List */}
      <Text style={styles.sectionTitle}>Exercises</Text>
      {workout.plannedExercises.map((exercise, index) => (
        <View key={index} style={styles.exerciseCard}>
          <View style={styles.exerciseNumber}>
            <Text style={styles.exerciseNumberText}>{index + 1}</Text>
          </View>
          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseName}>{exercise.exerciseId}</Text>
            <Text style={styles.exerciseDetails}>
              {exercise.sets} sets × {exercise.repRange[0]}-{exercise.repRange[1]} reps
            </Text>
            <Text style={styles.exerciseRest}>
              Rest: {Math.floor(exercise.restSeconds / 60)}:{(exercise.restSeconds % 60).toString().padStart(2, "0")}
            </Text>
          </View>
        </View>
      ))}

      {/* Start Button */}
      <TouchableOpacity style={styles.startButton} onPress={handleStartWorkout}>
        <Play size={24} color="#FFFFFF" fill="#FFFFFF" />
        <Text style={styles.startButtonText}>Start Workout</Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
    padding: 24,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  noWorkoutTitle: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
  },
  noWorkoutText: {
    color: "#94A3B8",
    fontSize: 16,
    marginTop: 8,
    textAlign: "center",
  },
  headerCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerTitle: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  statsRow: {
    flexDirection: "row",
    gap: 24,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    color: "#94A3B8",
    fontSize: 14,
  },
  sectionTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  exerciseNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  exerciseNumberText: {
    color: "#F8FAFC",
    fontWeight: "600",
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  exerciseDetails: {
    color: "#3B82F6",
    fontSize: 14,
  },
  exerciseRest: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },
  startButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  bottomPadding: {
    height: 32,
  },
});
