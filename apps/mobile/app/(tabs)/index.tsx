import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Play, Target, Dumbbell, BookOpen, History, TrendingUp, Sparkles, Check, Eye } from "lucide-react-native";
import { useAppUser } from "../../providers/user-provider";
import { useApi } from "../../hooks/use-api";
import type { Workout, AnalyticsSummary } from "../../lib/api";

export default function TodayScreen() {
  const router = useRouter();
  const api = useApi();
  const { appUser } = useAppUser();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [stats, setStats] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Use ref to store latest values without causing re-renders
  const appUserRef = useRef(appUser);
  appUserRef.current = appUser;

  const fetchTodaysWorkout = useCallback(async () => {
    const currentUser = appUserRef.current;
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch today's workout and stats in parallel
      const [workoutRes, statsRes] = await Promise.all([
        api.getTodaysWorkout(),
        api.getAnalyticsSummary(),
      ]);

      // API returns { programWorkout, standaloneWorkouts, decisions }
      const workoutData = workoutRes.data as Record<string, unknown> | null;
      setWorkout((workoutData?.programWorkout as Workout) ?? null);

      setStats(statsRes.data);
    } catch (err) {
      console.error("Failed to fetch today's workout:", err);
      setError("Could not connect to server");
    } finally {
      setIsLoading(false);
    }
  }, [api]); // No dependencies on appUser - uses refs

  // Fetch when tab comes into focus (handles both initial load and tab switches)
  useFocusEffect(
    useCallback(() => {
      fetchTodaysWorkout();
    }, [fetchTodaysWorkout])
  );

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
    const isNewUser = !stats || stats.totalWorkouts === 0;
    const daysSinceLastWorkout = stats?.lastWorkout
      ? Math.floor((Date.now() - new Date(stats.lastWorkout).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return (
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {/* Header */}
        <View style={styles.emptyHeader}>
          <Text style={styles.emptyGreeting}>
            {isNewUser ? "Welcome to Lifters Club!" : "Rest Day?"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {isNewUser
              ? "Let's get you started on your fitness journey"
              : "No scheduled workout today. Here's what you can do:"}
          </Text>
        </View>

        {/* Stats Card - only show for returning users */}
        {stats && stats.totalWorkouts > 0 && (
          <View style={styles.statsCard}>
            <View style={styles.statsCardHeader}>
              <TrendingUp size={20} color="#3B82F6" />
              <Text style={styles.statsCardTitle}>Your Progress</Text>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.totalWorkouts}</Text>
                <Text style={styles.statLabel}>Total Workouts</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.workoutsThisWeek}</Text>
                <Text style={styles.statLabel}>This Week</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.currentStreak}</Text>
                <Text style={styles.statLabel}>Day Streak</Text>
              </View>
            </View>
            {daysSinceLastWorkout !== null && daysSinceLastWorkout > 0 && (
              <Text style={styles.lastWorkoutText}>
                Last workout: {daysSinceLastWorkout === 1 ? "Yesterday" : `${daysSinceLastWorkout} days ago`}
              </Text>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push("/(tabs)/programs")}
        >
          <View style={[styles.actionIcon, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
            <BookOpen size={24} color="#3B82F6" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>
              {isNewUser ? "Browse Programs" : "Start a New Program"}
            </Text>
            <Text style={styles.actionDescription}>
              {isNewUser
                ? "Find a training program that matches your goals"
                : "Pick up a new program to follow"}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push("/quick-workout")}
        >
          <View style={[styles.actionIcon, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
            <Dumbbell size={24} color="#10B981" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Quick Workout</Text>
            <Text style={styles.actionDescription}>
              Generate an ad-hoc training session
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push("/(tabs)/exercises")}
        >
          <View style={[styles.actionIcon, { backgroundColor: "rgba(139, 92, 246, 0.15)" }]}>
            <History size={24} color="#8B5CF6" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Explore Exercises</Text>
            <Text style={styles.actionDescription}>
              Browse our library of {">"}100 exercises
            </Text>
          </View>
        </TouchableOpacity>

        {/* Tips for new users */}
        {isNewUser && (
          <View style={styles.tipCard}>
            <View style={styles.tipHeader}>
              <Sparkles size={16} color="#F59E0B" />
              <Text style={styles.tipTitle}>Getting Started</Text>
            </View>
            <Text style={styles.tipText}>
              1. Browse programs and find one that fits your schedule{"\n"}
              2. Start the program to get daily workouts{"\n"}
              3. Log your sets and the app will adjust weights for you
            </Text>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
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
          <View style={[
            styles.statusBadge,
            workout.status === "completed" && styles.statusBadgeCompleted,
            workout.status === "in_progress" && styles.statusBadgeInProgress,
            workout.status === "skipped" && styles.statusBadgeSkipped,
          ]}>
            {workout.status === "completed" && <Check size={12} color="#FFFFFF" />}
            <Text style={styles.statusText}>
              {workout.status === "pending"
                ? "Ready"
                : workout.status === "completed"
                ? "Done"
                : workout.status === "in_progress"
                ? "In Progress"
                : workout.status}
            </Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Target size={16} color="#94A3B8" />
            <Text style={styles.statText}>
              {workout.plannedExercises?.length ?? 0} exercises
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statText}>
              {(workout.plannedExercises ?? []).reduce((sum, ex) => sum + ex.sets, 0)} total sets
            </Text>
          </View>
        </View>
      </View>

      {/* Exercise List */}
      <Text style={styles.sectionTitle}>Exercises</Text>
      {(workout.plannedExercises ?? []).map((exercise, index) => (
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

      {/* Start/View Button */}
      <TouchableOpacity
        style={[
          styles.startButton,
          workout.status === "completed" && styles.viewButton,
        ]}
        onPress={handleStartWorkout}
      >
        {workout.status === "completed" ? (
          <>
            <Eye size={24} color="#FFFFFF" />
            <Text style={styles.startButtonText}>View Workout</Text>
          </>
        ) : (
          <>
            <Play size={24} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.startButtonText}>
              {workout.status === "in_progress" ? "Continue Workout" : "Start Workout"}
            </Text>
          </>
        )}
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
  emptyHeader: {
    marginBottom: 24,
  },
  emptyGreeting: {
    color: "#F8FAFC",
    fontSize: 28,
    fontWeight: "700",
  },
  emptySubtitle: {
    color: "#94A3B8",
    fontSize: 16,
    marginTop: 8,
    lineHeight: 22,
  },
  statsCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  statsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  statsCardTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    color: "#F8FAFC",
    fontSize: 32,
    fontWeight: "700",
  },
  statLabel: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 4,
  },
  lastWorkoutText: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
  },
  actionCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
  },
  actionDescription: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 2,
  },
  tipCard: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  tipTitle: {
    color: "#F59E0B",
    fontSize: 14,
    fontWeight: "600",
  },
  tipText: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 20,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusBadgeCompleted: {
    backgroundColor: "#10B981",
  },
  statusBadgeInProgress: {
    backgroundColor: "#F59E0B",
  },
  statusBadgeSkipped: {
    backgroundColor: "#64748B",
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
  viewButton: {
    backgroundColor: "#10B981",
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
