import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { Calendar, Target, Dumbbell, Play, Check } from "lucide-react-native";
import { useAppUser } from "../../providers/user-provider";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

interface Program {
  id: string;
  name: string;
  description?: string;
  daysPerWeek: number;
  goal: "strength" | "hypertrophy" | "conditioning";
  level: "beginner" | "intermediate" | "advanced";
  template: {
    weeks: number;
    sessions: unknown[];
  };
}

const goalLabels: Record<string, string> = {
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  conditioning: "Conditioning",
};

const levelLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const goalColors: Record<string, string> = {
  strength: "#EF4444",
  hypertrophy: "#3B82F6",
  conditioning: "#10B981",
};

export default function ProgramsScreen() {
  const { getToken } = useAuth();
  const { appUser, refetch } = useAppUser();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "recommended">("recommended");
  const [refreshing, setRefreshing] = useState(false);

  // Use refs to avoid recreating callback on every render
  const appUserRef = useRef(appUser);
  appUserRef.current = appUser;

  const fetchPrograms = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      const currentUser = appUserRef.current;
      if (filter === "recommended" && currentUser) {
        params.append("goal", currentUser.primaryGoal);
        params.append("level", currentUser.trainingLevel);
      }

      const response = await fetch(`${API_URL}/api/programs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPrograms(data.data || []);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [filter]); // Only depends on filter, not appUser

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPrograms();
    await refetch();
    setRefreshing(false);
  }, [fetchPrograms, refetch]);

  const handleStartProgram = async (program: Program) => {
    if (!appUser) return;

    // Check if user already has an active program
    if (appUser.activeTrainingBlock) {
      Alert.alert(
        "Active Program",
        "You already have an active program. Would you like to switch to this one?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Switch",
            style: "destructive",
            onPress: () => startProgram(program, true),
          },
        ]
      );
      return;
    }

    startProgram(program, false);
  };

  const startProgram = async (program: Program, pauseExisting: boolean) => {
    if (!appUser) return;

    setIsStarting(program.id);

    try {
      const token = await getToken();

      // If pausing existing, update the current block
      if (pauseExisting && appUser.activeTrainingBlock) {
        await fetch(
          `${API_URL}/api/workouts/training-blocks/${appUser.activeTrainingBlock.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status: "paused" }),
          }
        );
      }

      // Create new training block
      // Use local date to avoid timezone issues (toISOString uses UTC)
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      // Sanitize and shorten ID to stay under 64 char limit
      // Format: user-{short_id}-{program_short}-{timestamp}
      const userShort = appUser.id.slice(-8).toLowerCase().replace(/[^a-z0-9]/g, "");
      const programShort = program.id.slice(0, 20).toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const blockId = `user-${userShort}-${programShort}-${Date.now()}`;

      const response = await fetch(`${API_URL}/api/workouts/training-blocks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: blockId,
          userId: appUser.id,
          programId: program.id,
          startDate: today,
        }),
      });

      if (response.ok) {
        Alert.alert(
          "Program Started",
          `You've started ${program.name}. Your first workout is ready!`
        );
        await refetch();
      } else {
        const data = await response.json();
        Alert.alert("Error", data.error || "Failed to start program");
      }
    } catch {
      Alert.alert("Error", "Failed to connect to server");
    } finally {
      setIsStarting(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
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
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === "recommended" && styles.filterTabActive]}
          onPress={() => setFilter("recommended")}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === "recommended" && styles.filterTabTextActive,
            ]}
          >
            Recommended
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === "all" && styles.filterTabActive]}
          onPress={() => setFilter("all")}
        >
          <Text
            style={[styles.filterTabText, filter === "all" && styles.filterTabTextActive]}
          >
            All Programs
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Program */}
      {appUser?.activeTrainingBlock && (
        <View style={styles.activeCard}>
          <View style={styles.activeBadge}>
            <Check size={12} color="#FFFFFF" />
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
          <Text style={styles.activeTitle}>
            {programs.find((p) => p.id === appUser.activeTrainingBlock!.programId)?.name ||
              appUser.activeTrainingBlock.programId
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
          <Text style={styles.activeSubtitle}>
            Week {appUser.activeTrainingBlock.currentWeek}
          </Text>
        </View>
      )}

      {/* Programs List */}
      <Text style={styles.sectionTitle}>
        {filter === "recommended" ? "For You" : "All Programs"}
      </Text>

      {programs.length === 0 ? (
        <View style={styles.emptyState}>
          <Dumbbell size={48} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No Programs Found</Text>
          <Text style={styles.emptyText}>
            {filter === "recommended"
              ? "No programs match your profile yet"
              : "No programs available"}
          </Text>
        </View>
      ) : (
        programs.map((program) => (
          <View key={program.id} style={styles.programCard}>
            <View style={styles.programHeader}>
              <View style={styles.programTitleRow}>
                <Text style={styles.programName}>{program.name}</Text>
                <View
                  style={[
                    styles.goalBadge,
                    { backgroundColor: goalColors[program.goal] },
                  ]}
                >
                  <Text style={styles.goalText}>{goalLabels[program.goal]}</Text>
                </View>
              </View>
              {program.description && (
                <Text style={styles.programDescription}>{program.description}</Text>
              )}
            </View>

            <View style={styles.programMeta}>
              <View style={styles.metaItem}>
                <Calendar size={14} color="#94A3B8" />
                <Text style={styles.metaText}>
                  {program.daysPerWeek} days/week
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Target size={14} color="#94A3B8" />
                <Text style={styles.metaText}>{levelLabels[program.level]}</Text>
              </View>
              <View style={styles.metaItem}>
                <Dumbbell size={14} color="#94A3B8" />
                <Text style={styles.metaText}>
                  {program.template.weeks} weeks
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.startButton,
                isStarting === program.id && styles.startButtonDisabled,
              ]}
              onPress={() => handleStartProgram(program)}
              disabled={isStarting === program.id}
            >
              {isStarting === program.id ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.startButtonText}>Start Program</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ))
      )}

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
  },
  filterContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#1E293B",
    alignItems: "center",
  },
  filterTabActive: {
    backgroundColor: "#3B82F6",
  },
  filterTabText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },
  activeCard: {
    backgroundColor: "#1E3A5F",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  activeBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  activeTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "600",
  },
  activeSubtitle: {
    color: "#94A3B8",
    fontSize: 14,
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
  programCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  programHeader: {
    marginBottom: 12,
  },
  programTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  programName: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  goalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  goalText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  programDescription: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 4,
  },
  programMeta: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    color: "#94A3B8",
    fontSize: 12,
  },
  startButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  bottomPadding: {
    height: 32,
  },
});
