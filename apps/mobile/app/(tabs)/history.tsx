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
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Calendar, Clock, Dumbbell, TrendingUp, BarChart3 } from "lucide-react-native";
import { useAppUser } from "../../providers/user-provider";
import { VolumeChart } from "../../components";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

interface WorkoutLog {
  id: string;
  workoutId: string;
  startedAt: string;
  completedAt?: string;
  overallRpe?: number;
  notes?: string;
  weekNumber?: number;
  dayNumber?: number;
  exerciseCount?: number;
}

interface WeekData {
  weekStart: string;
  totalVolume: number;
  workoutCount: number;
  setCount: number;
}

interface SummaryData {
  totalWorkouts: number;
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  averageRpe: number | null;
  averageDuration: number | null;
  currentStreak: number;
  lastWorkout: string | null;
}

type ViewMode = "history" | "analytics";

export default function HistoryScreen() {
  const { getToken } = useAuth();
  const { appUser } = useAppUser();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("history");
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [volumeData, setVolumeData] = useState<WeekData[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!appUser) return;

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/logs?limit=20`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.data || []);
      }
    } catch {
      // Silently fail
    }
  }, [appUser, getToken]);

  const fetchAnalytics = useCallback(async () => {
    if (!appUser) return;

    try {
      const token = await getToken();
      const [volumeResult, summaryResult] = await Promise.allSettled([
        fetch(`${API_URL}/api/analytics/volume?weeks=8`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(`${API_URL}/api/analytics/summary`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      // Handle volume data - don't let one failure affect the other
      if (volumeResult.status === "fulfilled" && volumeResult.value.ok) {
        const data = await volumeResult.value.json();
        setVolumeData(data.data?.weeks || []);
      }

      // Handle summary data independently
      if (summaryResult.status === "fulfilled" && summaryResult.value.ok) {
        const data = await summaryResult.value.json();
        setSummary(data.data || null);
      }
    } catch {
      // Silently fail for other unexpected errors
    }
  }, [appUser, getToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([fetchHistory(), fetchAnalytics()]);
    setRefreshing(false);
  }, [fetchHistory, fetchAnalytics]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.allSettled([fetchHistory(), fetchAnalytics()]);
      setIsLoading(false);
    };

    if (appUser?.id) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.id]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const calculateDuration = (startedAt: string, completedAt?: string): string => {
    if (!completedAt) return "In progress";
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const diffMinutes = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60)
    );
    return `${diffMinutes} min`;
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const completedLogs = logs.filter((log) => log.completedAt);

  return (
    <View style={styles.container}>
      {/* View Mode Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === "history" && styles.toggleButtonActive]}
          onPress={() => setViewMode("history")}
        >
          <Clock size={16} color={viewMode === "history" ? "#FFFFFF" : "#94A3B8"} />
          <Text style={[styles.toggleText, viewMode === "history" && styles.toggleTextActive]}>
            History
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === "analytics" && styles.toggleButtonActive]}
          onPress={() => setViewMode("analytics")}
        >
          <BarChart3 size={16} color={viewMode === "analytics" ? "#FFFFFF" : "#94A3B8"} />
          <Text style={[styles.toggleText, viewMode === "analytics" && styles.toggleTextActive]}>
            Analytics
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {viewMode === "history" ? (
          <>
            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{completedLogs.length}</Text>
                <Text style={styles.statLabel}>Workouts</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {completedLogs.filter((log) => {
                    const date = new Date(log.completedAt!);
                    const now = new Date();
                    const diffDays = Math.floor(
                      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return diffDays < 7;
                  }).length}
                </Text>
                <Text style={styles.statLabel}>This Week</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {completedLogs.length > 0
                    ? (
                        completedLogs
                          .filter((log) => log.overallRpe)
                          .reduce((sum, log) => sum + (log.overallRpe || 0), 0) /
                          (completedLogs.filter((log) => log.overallRpe).length || 1)
                      ).toFixed(1)
                    : "—"}
                </Text>
                <Text style={styles.statLabel}>Avg RPE</Text>
              </View>
            </View>

            {/* History List */}
            <Text style={styles.sectionTitle}>Recent Workouts</Text>

            {completedLogs.length === 0 ? (
              <View style={styles.emptyState}>
                <Dumbbell size={48} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No History Yet</Text>
                <Text style={styles.emptyText}>
                  Complete your first workout to see it here
                </Text>
              </View>
            ) : (
              completedLogs.map((log) => (
                <TouchableOpacity
                  key={log.id}
                  style={styles.logCard}
                  onPress={() => router.push(`/workout-detail/${log.id}`)}
                >
                  <View style={styles.logHeader}>
                    <Text style={styles.logTitle}>
                      {log.weekNumber && log.dayNumber
                        ? `Week ${log.weekNumber} • Day ${log.dayNumber}`
                        : "Workout Session"}
                    </Text>
                    {log.overallRpe && (
                      <View style={styles.rpeBadge}>
                        <Text style={styles.rpeText}>RPE {log.overallRpe}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.logDetails}>
                    <View style={styles.logDetail}>
                      <Calendar size={14} color="#94A3B8" />
                      <Text style={styles.logDetailText}>
                        {formatDate(log.completedAt!)}
                      </Text>
                    </View>
                    <View style={styles.logDetail}>
                      <Clock size={14} color="#94A3B8" />
                      <Text style={styles.logDetailText}>
                        {calculateDuration(log.startedAt, log.completedAt)}
                      </Text>
                    </View>
                    {log.exerciseCount != null && log.exerciseCount > 0 && (
                      <View style={styles.logDetail}>
                        <Dumbbell size={14} color="#94A3B8" />
                        <Text style={styles.logDetailText}>
                          {log.exerciseCount} exercises
                        </Text>
                      </View>
                    )}
                  </View>
                  {log.notes && (
                    <Text style={styles.logNotes}>{log.notes}</Text>
                  )}
                </TouchableOpacity>
              ))
            )}
          </>
        ) : (
          <>
            {/* Analytics Summary */}
            {summary && (
              <View style={styles.summaryContainer}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCard}>
                    <TrendingUp size={20} color="#22C55E" />
                    <Text style={styles.summaryValue}>{summary.currentStreak}</Text>
                    <Text style={styles.summaryLabel}>Day Streak</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Dumbbell size={20} color="#3B82F6" />
                    <Text style={styles.summaryValue}>{summary.workoutsThisMonth}</Text>
                    <Text style={styles.summaryLabel}>This Month</Text>
                  </View>
                </View>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCard}>
                    <Clock size={20} color="#F59E0B" />
                    <Text style={styles.summaryValue}>
                      {summary.averageDuration ? `${summary.averageDuration}m` : "—"}
                    </Text>
                    <Text style={styles.summaryLabel}>Avg Duration</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <BarChart3 size={20} color="#8B5CF6" />
                    <Text style={styles.summaryValue}>
                      {summary.averageRpe?.toFixed(1) || "—"}
                    </Text>
                    <Text style={styles.summaryLabel}>Avg RPE</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Volume Chart */}
            <View style={styles.chartSection}>
              <VolumeChart weeks={volumeData} title="Weekly Training Volume" />
            </View>

            {/* Total Stats */}
            {summary && (
              <View style={styles.totalStatsCard}>
                <Text style={styles.totalStatsTitle}>All Time</Text>
                <View style={styles.totalStatsRow}>
                  <View style={styles.totalStat}>
                    <Text style={styles.totalStatValue}>{summary.totalWorkouts}</Text>
                    <Text style={styles.totalStatLabel}>Total Workouts</Text>
                  </View>
                  {summary.lastWorkout && (
                    <View style={styles.totalStat}>
                      <Text style={styles.totalStatValue}>
                        {formatDate(summary.lastWorkout)}
                      </Text>
                      <Text style={styles.totalStatLabel}>Last Workout</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </>
        )}

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
  scrollView: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: "#3B82F6",
  },
  toggleText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "#FFFFFF",
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statValue: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  logCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  logTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
  },
  rpeBadge: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rpeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  logDetails: {
    flexDirection: "row",
    gap: 16,
  },
  logDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  logDetailText: {
    color: "#94A3B8",
    fontSize: 14,
  },
  logNotes: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 8,
    fontStyle: "italic",
  },
  summaryContainer: {
    gap: 12,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  summaryValue: {
    color: "#F8FAFC",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 8,
  },
  summaryLabel: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 4,
  },
  chartSection: {
    marginBottom: 24,
  },
  totalStatsCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
  },
  totalStatsTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  totalStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  totalStat: {
    alignItems: "center",
  },
  totalStatValue: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "700",
  },
  totalStatLabel: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 4,
  },
  bottomPadding: {
    height: 32,
  },
});
