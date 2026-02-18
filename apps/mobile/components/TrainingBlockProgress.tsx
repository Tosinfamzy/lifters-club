import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import {
  CheckCircle,
  Circle,
  SkipForward,
  PlayCircle,
  Sparkles,
  Trophy,
  Calendar,
} from "lucide-react-native";
import { useApi } from "../hooks/use-api";
import type { TrainingBlock, Workout, Program } from "../lib/api";

interface TrainingBlockProgressProps {
  block: TrainingBlock;
  program: Program;
  onWeekGenerated?: () => void;
}

const STATUS_COLORS: Record<Workout["status"], string> = {
  pending: "#94A3B8",
  in_progress: "#3B82F6",
  completed: "#10B981",
  skipped: "#F59E0B",
};

const STATUS_LABELS: Record<Workout["status"], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped",
};

function StatusIcon({ status, size = 20 }: { status: Workout["status"]; size?: number }) {
  const color = STATUS_COLORS[status];
  switch (status) {
    case "completed":
      return <CheckCircle size={size} color={color} />;
    case "skipped":
      return <SkipForward size={size} color={color} />;
    case "in_progress":
      return <PlayCircle size={size} color={color} />;
    default:
      return <Circle size={size} color={color} />;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function TrainingBlockProgress({
  block,
  program,
  onWeekGenerated,
}: TrainingBlockProgressProps) {
  const api = useApi();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [skippingId, setSkippingId] = useState<string | null>(null);
  const [forceDeload, setForceDeload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  const totalWeeks = program.template?.weeks ?? 12;
  const progressPercent = (block.currentWeek / totalWeeks) * 100;

  const fetchWorkouts = useCallback(async () => {
    try {
      const res = await api.getWorkouts({ trainingBlockId: block.id });
      setWorkouts(res.data || []);
    } catch (err) {
      console.error("Failed to fetch workouts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [api, block.id]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  const currentWeekWorkouts = workouts.filter(
    (w) => w.weekNumber === block.currentWeek
  );

  const isWeekComplete =
    currentWeekWorkouts.length > 0 &&
    currentWeekWorkouts.every(
      (w) => w.status === "completed" || w.status === "skipped" || skippedIds.has(w.id)
    );

  const isProgramComplete = block.currentWeek >= totalWeeks && isWeekComplete;

  const handleSkipWorkout = (workout: Workout) => {
    Alert.alert(
      "Skip Workout?",
      `Skip Day ${workout.dayNumber} (${formatDate(workout.scheduledDate)})? You can still come back to it later.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Skip",
          style: "destructive",
          onPress: async () => {
            setSkippingId(workout.id);
            setError(null);
            try {
              await api.updateWorkout(workout.id, { status: "skipped" });
              setSkippedIds((prev) => new Set(prev).add(workout.id));
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Failed to skip workout"
              );
            } finally {
              setSkippingId(null);
            }
          },
        },
      ]
    );
  };

  const handleGenerateWeek = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await api.generateWeek(block.id, { forceDeload });
      Alert.alert(
        res.data.isDeloadWeek ? "Deload Week Generated" : "Week Generated",
        `Week ${res.data.weekNumber} is ready. ${res.data.summary}`
      );
      onWeekGenerated?.();
      await fetchWorkouts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate week"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  }

  if (isProgramComplete) {
    return (
      <View style={[styles.card, styles.completeCard]}>
        <View style={styles.completeHeader}>
          <Trophy size={32} color="#10B981" />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.completeTitle}>Program Complete!</Text>
            <Text style={styles.completeSubtitle}>
              Congratulations on completing {program.name}
            </Text>
          </View>
        </View>
        <Text style={styles.completeText}>
          You&apos;ve finished all {totalWeeks} weeks. Consider starting a new
          program or repeating this one with higher weights.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Calendar size={18} color="#3B82F6" />
          <Text style={styles.title}>{program.name}</Text>
        </View>
        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>Active</Text>
        </View>
      </View>

      <Text style={styles.weekLabel}>
        Week {block.currentWeek} of {totalWeeks}
      </Text>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${Math.min(progressPercent, 100)}%` }]}
          />
        </View>
        <Text style={styles.progressText}>{Math.round(progressPercent)}%</Text>
      </View>

      {/* Workout List */}
      <Text style={styles.sectionLabel}>This Week&apos;s Workouts</Text>

      {currentWeekWorkouts.map((workout) => {
        const effectiveStatus = skippedIds.has(workout.id)
          ? "skipped"
          : workout.status;
        const canSkip = effectiveStatus === "pending";
        const isSkipping = skippingId === workout.id;

        return (
          <View key={workout.id} style={styles.workoutRow}>
            <View style={styles.workoutLeft}>
              <StatusIcon status={effectiveStatus} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.workoutDay}>Day {workout.dayNumber}</Text>
                <Text style={styles.workoutMeta}>
                  {workout.plannedExercises?.length ?? 0} exercises
                </Text>
              </View>
            </View>
            <View style={styles.workoutRight}>
              {canSkip && (
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={() => handleSkipWorkout(workout)}
                  disabled={isSkipping}
                >
                  {isSkipping ? (
                    <ActivityIndicator size="small" color="#F59E0B" />
                  ) : (
                    <>
                      <SkipForward size={12} color="#94A3B8" />
                      <Text style={styles.skipButtonText}>Skip</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              <View style={styles.statusContainer}>
                <View
                  style={[
                    styles.statusBadge,
                    { borderColor: STATUS_COLORS[effectiveStatus] },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: STATUS_COLORS[effectiveStatus] },
                    ]}
                  >
                    {STATUS_LABELS[effectiveStatus]}
                  </Text>
                </View>
                <Text style={styles.dateText}>
                  {formatDate(workout.scheduledDate)}
                </Text>
              </View>
            </View>
          </View>
        );
      })}

      {/* Generate Week */}
      {isWeekComplete && block.currentWeek < totalWeeks && (
        <View style={styles.generateSection}>
          <View style={styles.generateHeader}>
            <Sparkles size={18} color="#3B82F6" />
            <Text style={styles.generateTitle}>
              Week {block.currentWeek} Complete!
            </Text>
          </View>

          <Text style={styles.generateDescription}>
            Ready to generate week {block.currentWeek + 1}. The decision engine
            will analyze your performance and adjust weights and volumes.
          </Text>

          <View style={styles.deloadRow}>
            <Text style={styles.deloadLabel}>Request deload week</Text>
            <Switch
              value={forceDeload}
              onValueChange={setForceDeload}
              trackColor={{ false: "#334155", true: "#3B82F680" }}
              thumbColor={forceDeload ? "#3B82F6" : "#94A3B8"}
            />
          </View>

          <TouchableOpacity
            style={[styles.generateButton, isGenerating && styles.buttonDisabled]}
            onPress={handleGenerateWeek}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Sparkles size={16} color="#FFFFFF" />
                <Text style={styles.generateButtonText}>
                  Generate Week {block.currentWeek + 1}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Week in progress */}
      {!isWeekComplete && currentWeekWorkouts.length > 0 && (
        <View style={styles.progressMessage}>
          <Text style={styles.progressMessageText}>
            Complete or skip remaining workouts to advance
          </Text>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  completeCard: {
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  completeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  completeTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "700",
  },
  completeSubtitle: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 2,
  },
  completeText: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  activeBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  weekLabel: {
    color: "#94A3B8",
    fontSize: 13,
    marginBottom: 12,
    marginLeft: 26,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "#334155",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 3,
  },
  progressText: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "600",
    width: 36,
    textAlign: "right",
  },
  sectionLabel: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0F172A",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  workoutLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  workoutDay: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "500",
  },
  workoutMeta: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 1,
  },
  workoutRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  skipButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(148, 163, 184, 0.1)",
  },
  skipButtonText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
  },
  statusContainer: {
    alignItems: "flex-end",
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  dateText: {
    color: "#64748B",
    fontSize: 10,
    marginTop: 3,
  },
  generateSection: {
    backgroundColor: "rgba(59, 130, 246, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
    borderRadius: 10,
    padding: 14,
    marginTop: 10,
  },
  generateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  generateTitle: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "600",
  },
  generateDescription: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  deloadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  deloadLabel: {
    color: "#CBD5E1",
    fontSize: 13,
  },
  generateButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  progressMessage: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  progressMessageText: {
    color: "#94A3B8",
    fontSize: 13,
    textAlign: "center",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 8,
  },
});
