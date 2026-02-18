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
import {
  ArrowLeft,
  Dumbbell,
  Target,
  Zap,
  TrendingUp,
  Clock,
  AlertCircle,
} from "lucide-react-native";
import { useAppUser } from "../../providers/user-provider";
import { useApi } from "../../hooks/use-api";
import { ExerciseProgressChart } from "../../components/ExerciseProgressChart";
import type { Exercise, ExerciseProgressSession } from "../../lib/api";

const difficultyColors: Record<string, string> = {
  beginner: "#10B981",
  intermediate: "#F59E0B",
  advanced: "#EF4444",
};

const difficultyLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export default function ExerciseInfoScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const router = useRouter();
  const api = useApi();
  const { appUser } = useAppUser();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [progress, setProgress] = useState<ExerciseProgressSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExercise = useCallback(async () => {
    if (!exerciseId) return;

    try {
      const data = await api.getExercise(exerciseId);
      setExercise(data.data);
    } catch (err) {
      console.error("Failed to load exercise:", err);
      setError("Exercise not found");
    }
  }, [exerciseId, api]);

  const fetchProgress = useCallback(async () => {
    if (!exerciseId || !appUser) return;

    try {
      const data = await api.getExerciseProgress(exerciseId, appUser.id, 10);
      setProgress(data.data?.sessions || []);
    } catch (err) {
      // Progress is optional, don't fail
      console.error("Failed to load exercise progress:", err);
    }
  }, [exerciseId, appUser, api]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      await fetchExercise();
      await fetchProgress();
      setIsLoading(false);
    };

    loadData();
  }, [fetchExercise, fetchProgress]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchExercise();
    await fetchProgress();
    setRefreshing(false);
  }, [fetchExercise, fetchProgress]);

  const formatLabel = (value: string): string => {
    return value
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const calculateBestWeight = (): number | null => {
    if (progress.length === 0) return null;

    let best = 0;
    for (const session of progress) {
      if (session.bestWeight > best) {
        best = session.bestWeight;
      }
    }
    return best > 0 ? best : null;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#F8FAFC" />
          </TouchableOpacity>
          <Text style={styles.title}>Exercise Info</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </View>
    );
  }

  if (error || !exercise) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#F8FAFC" />
          </TouchableOpacity>
          <Text style={styles.title}>Exercise Info</Text>
        </View>
        <View style={styles.centered}>
          <AlertCircle size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error || "Exercise not found"}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const bestWeight = calculateBestWeight();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {exercise.name}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {/* Video Placeholder */}
        <View style={styles.videoPlaceholder}>
          <Dumbbell size={48} color="#64748B" />
          <Text style={styles.videoPlaceholderText}>Video Coming Soon</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View
              style={[
                styles.difficultyBadge,
                { backgroundColor: difficultyColors[exercise.difficulty] },
              ]}
            >
              <Zap size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.statValue}>{difficultyLabels[exercise.difficulty]}</Text>
            <Text style={styles.statLabel}>Difficulty</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Target size={16} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>{exercise.isCompound ? "Compound" : "Isolation"}</Text>
            <Text style={styles.statLabel}>Type</Text>
          </View>
          {bestWeight && (
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <TrendingUp size={16} color="#10B981" />
              </View>
              <Text style={styles.statValue}>{bestWeight}lbs</Text>
              <Text style={styles.statLabel}>Best</Text>
            </View>
          )}
        </View>

        {/* Equipment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equipment</Text>
          <View style={styles.tagRow}>
            {exercise.equipment.map((eq) => (
              <View key={eq} style={styles.tag}>
                <Dumbbell size={12} color="#94A3B8" />
                <Text style={styles.tagText}>{formatLabel(eq)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Primary Muscles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary Muscles</Text>
          <View style={styles.tagRow}>
            {exercise.primaryMuscles.map((muscle) => (
              <View key={muscle} style={[styles.tag, styles.primaryTag]}>
                <Text style={styles.tagText}>{formatLabel(muscle)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Secondary Muscles */}
        {exercise.secondaryMuscles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Secondary Muscles</Text>
            <View style={styles.tagRow}>
              {exercise.secondaryMuscles.map((muscle) => (
                <View key={muscle} style={styles.tag}>
                  <Text style={styles.tagText}>{formatLabel(muscle)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Movement Patterns */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Movement Patterns</Text>
          <View style={styles.tagRow}>
            {exercise.movementPatterns.map((pattern) => (
              <View key={pattern} style={styles.tag}>
                <Text style={styles.tagText}>{formatLabel(pattern)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Progress Chart */}
        {progress.length > 0 && (
          <View style={styles.section}>
            <ExerciseProgressChart
              sessions={progress}
              metric="weight"
              title="Weight Progress"
            />
          </View>
        )}

        {/* Recent Progress */}
        {progress.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent History</Text>
            {progress.slice(0, 5).map((session, index) => (
              <View key={index} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Clock size={14} color="#94A3B8" />
                  <Text style={styles.historyDate}>
                    {new Date(session.date).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.historySets}>
                  <Text style={styles.historySet}>
                    Best: {session.bestWeight}lbs
                  </Text>
                  <Text style={styles.historySet}>
                    {session.totalSets} sets
                  </Text>
                  {session.avgRpe != null && (
                    <Text style={styles.historySet}>
                      RPE {session.avgRpe.toFixed(1)}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Aliases */}
        {exercise.aliases.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Also Known As</Text>
            <Text style={styles.aliasText}>{exercise.aliases.join(", ")}</Text>
          </View>
        )}

        {/* Extra notes */}
        {exercise.isUnilateral && (
          <View style={styles.noteCard}>
            <AlertCircle size={16} color="#F59E0B" />
            <Text style={styles.noteText}>This is a unilateral exercise (one side at a time)</Text>
          </View>
        )}

        {exercise.constraints && exercise.constraints.length > 0 && (
          <View style={styles.noteCard}>
            <AlertCircle size={16} color="#94A3B8" />
            <Text style={styles.noteText}>
              Requires: {exercise.constraints.map(formatLabel).join(", ")}
            </Text>
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
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  videoPlaceholder: {
    height: 200,
    backgroundColor: "#1E293B",
    borderRadius: 16,
    marginTop: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  videoPlaceholderText: {
    color: "#64748B",
    fontSize: 14,
    marginTop: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  difficultyBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  statLabel: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 2,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  primaryTag: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  tagText: {
    color: "#F8FAFC",
    fontSize: 13,
  },
  historyCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  historyDate: {
    color: "#94A3B8",
    fontSize: 12,
  },
  historySets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  historySet: {
    color: "#F8FAFC",
    fontSize: 13,
    backgroundColor: "#334155",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  aliasText: {
    color: "#94A3B8",
    fontSize: 14,
    fontStyle: "italic",
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    gap: 12,
  },
  noteText: {
    color: "#F8FAFC",
    fontSize: 13,
    flex: 1,
  },
});
