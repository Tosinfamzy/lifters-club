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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import {
  ArrowLeft,
  Clock,
  Calendar,
  Target,
  Dumbbell,
  TrendingUp,
} from "lucide-react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

interface LoggedSet {
  id: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rpe?: number;
  notes?: string;
}

interface WorkoutLogDetail {
  id: string;
  workoutId: string;
  startedAt: string;
  completedAt?: string;
  overallRpe?: number;
  notes?: string;
  sets: LoggedSet[];
}

interface GroupedExercise {
  exerciseId: string;
  sets: LoggedSet[];
}

export default function WorkoutDetailScreen() {
  const { logId } = useLocalSearchParams<{ logId: string }>();
  const router = useRouter();
  const { getToken } = useAuth();

  const [logDetail, setLogDetail] = useState<WorkoutLogDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogDetail = useCallback(async () => {
    if (!logId) return;

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/logs/${logId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLogDetail(data.data);
        setError(null);
      } else {
        setError("Workout not found");
      }
    } catch {
      setError("Failed to load workout details");
    } finally {
      setIsLoading(false);
    }
  }, [logId, getToken]);

  useEffect(() => {
    fetchLogDetail();
  }, [fetchLogDetail]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLogDetail();
    setRefreshing(false);
  }, [fetchLogDetail]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const calculateDuration = (startedAt: string, completedAt?: string): string => {
    if (!completedAt) return "In progress";
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const diffMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

    if (diffMinutes < 60) {
      return `${diffMinutes} min`;
    }
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatExerciseName = (exerciseId: string): string => {
    return exerciseId
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const groupSetsByExercise = (sets: LoggedSet[]): GroupedExercise[] => {
    const grouped: Record<string, LoggedSet[]> = {};

    sets.forEach((set) => {
      if (!grouped[set.exerciseId]) {
        grouped[set.exerciseId] = [];
      }
      grouped[set.exerciseId]!.push(set);
    });

    return Object.entries(grouped).map(([exerciseId, exerciseSets]) => ({
      exerciseId,
      sets: exerciseSets.sort((a, b) => a.setNumber - b.setNumber),
    }));
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#F8FAFC" />
          </TouchableOpacity>
          <Text style={styles.title}>Workout Details</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </View>
    );
  }

  if (error || !logDetail) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#F8FAFC" />
          </TouchableOpacity>
          <Text style={styles.title}>Workout Details</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || "Workout not found"}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchLogDetail}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const groupedExercises = groupSetsByExercise(logDetail.sets);
  const totalSets = logDetail.sets.length;
  const totalVolume = logDetail.sets.reduce((sum, set) => sum + set.weight * set.reps, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.title}>Workout Details</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {/* Date and Time */}
        <View style={styles.dateCard}>
          <Calendar size={20} color="#3B82F6" />
          <View style={styles.dateInfo}>
            <Text style={styles.dateText}>
              {formatDate(logDetail.completedAt || logDetail.startedAt)}
            </Text>
            <Text style={styles.timeText}>
              {formatTime(logDetail.startedAt)}
              {logDetail.completedAt && ` - ${formatTime(logDetail.completedAt)}`}
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Clock size={18} color="#3B82F6" />
            <Text style={styles.statValue}>
              {calculateDuration(logDetail.startedAt, logDetail.completedAt)}
            </Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>

          <View style={styles.statCard}>
            <Dumbbell size={18} color="#10B981" />
            <Text style={styles.statValue}>{totalSets}</Text>
            <Text style={styles.statLabel}>Sets</Text>
          </View>

          <View style={styles.statCard}>
            <TrendingUp size={18} color="#F59E0B" />
            <Text style={styles.statValue}>
              {totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}
            </Text>
            <Text style={styles.statLabel}>Volume</Text>
          </View>

          {logDetail.overallRpe && (
            <View style={styles.statCard}>
              <Target size={18} color="#EF4444" />
              <Text style={styles.statValue}>{logDetail.overallRpe}</Text>
              <Text style={styles.statLabel}>RPE</Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {logDetail.notes && (
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{logDetail.notes}</Text>
          </View>
        )}

        {/* Exercises */}
        <Text style={styles.sectionTitle}>Exercises</Text>

        {groupedExercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No sets logged for this workout</Text>
          </View>
        ) : (
          groupedExercises.map((exercise, index) => (
            <View key={exercise.exerciseId} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseNumber}>
                  <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.exerciseName}>
                  {formatExerciseName(exercise.exerciseId)}
                </Text>
              </View>

              <View style={styles.setsTable}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.tableCellSet]}>Set</Text>
                  <Text style={[styles.tableCell, styles.tableCellWeight]}>Weight</Text>
                  <Text style={[styles.tableCell, styles.tableCellReps]}>Reps</Text>
                  <Text style={[styles.tableCell, styles.tableCellRpe]}>RPE</Text>
                </View>

                {exercise.sets.map((set) => (
                  <View key={set.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableCellSet, styles.tableCellValue]}>
                      {set.setNumber}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellWeight, styles.tableCellValue]}>
                      {set.weight} lbs
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellReps, styles.tableCellValue]}>
                      {set.reps}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellRpe, styles.tableCellValue]}>
                      {set.rpe || "—"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  dateCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 12,
  },
  dateInfo: {
    flex: 1,
  },
  dateText: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
  },
  timeText: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statValue: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 6,
  },
  statLabel: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 2,
  },
  notesCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  notesLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  notesText: {
    color: "#F8FAFC",
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 24,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 14,
  },
  exerciseCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  exerciseNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  exerciseNumberText: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
  },
  exerciseName: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  setsTable: {
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingTop: 12,
  },
  tableHeader: {
    flexDirection: "row",
    paddingBottom: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
  },
  tableCell: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  tableCellValue: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "500",
    textTransform: "none",
  },
  tableCellSet: {
    width: 40,
    textAlign: "center",
  },
  tableCellWeight: {
    flex: 1,
  },
  tableCellReps: {
    width: 50,
    textAlign: "center",
  },
  tableCellRpe: {
    width: 40,
    textAlign: "center",
  },
});
