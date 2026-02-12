import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Search, Dumbbell, ChevronRight, X, Filter } from "lucide-react-native";
import { debounce } from "../../utils/debounce";
import { useApi } from "../../hooks/use-api";
import type { Exercise } from "../../lib/api";

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

type Difficulty = "beginner" | "intermediate" | "advanced";
type MuscleGroup = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "quads" | "hamstrings" | "glutes" | "core";
type EquipmentType = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "kettlebell";

const MUSCLE_OPTIONS: MuscleGroup[] = ["chest", "back", "shoulders", "biceps", "triceps", "quads", "hamstrings", "glutes", "core"];
const EQUIPMENT_OPTIONS: EquipmentType[] = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell"];
const DIFFICULTY_OPTIONS: Difficulty[] = ["beginner", "intermediate", "advanced"];

interface Filters {
  difficulty: Difficulty | null;
  muscle: MuscleGroup | null;
  equipment: EquipmentType | null;
}

export default function ExercisesScreen() {
  const router = useRouter();
  const api = useApi();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    difficulty: null,
    muscle: null,
    equipment: null,
  });

  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const activeFilterCount = [filters.difficulty, filters.muscle, filters.equipment].filter(Boolean).length;

  const fetchExercises = useCallback(async (query: string, reset = false) => {
    const currentOffset = reset ? 0 : offsetRef.current;
    const currentFilters = filtersRef.current;

    try {
      setError(null);

      const data = await api.getExercises({
        limit: 20,
        offset: currentOffset,
        search: query.trim() || undefined,
        difficulty: currentFilters.difficulty || undefined,
        muscleGroup: currentFilters.muscle || undefined,
        equipment: currentFilters.equipment || undefined,
      });

      const newExercises = data.data || [];

      if (reset) {
        setExercises(newExercises);
        setOffset(20);
      } else {
        setExercises((prev) => [...prev, ...newExercises]);
        setOffset((prev) => prev + 20);
      }

      setHasMore(data.pagination?.hasMore ?? false);
    } catch (err) {
      console.error("Failed to load exercises:", err);
      setError("Unable to load exercises");
      if (reset) {
        // Only show alert on initial load or explicit refresh, not on scroll pagination
        Alert.alert(
          "Connection Error",
          "Unable to load exercises. Please check your connection and try again.",
          [{ text: "Retry", onPress: () => fetchExercises(query, true) }]
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchExercises("", true);
  }, [fetchExercises]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      setIsLoading(true);
      fetchExercises(query, true);
    }, 300),
    [fetchExercises]
  );

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    debouncedSearch(text);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setIsLoading(true);
    fetchExercises("", true);
  };

  const handleFilterChange = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    const newFilters = { ...filters, [key]: filters[key] === value ? null : value };
    setFilters(newFilters);
    filtersRef.current = newFilters;
    setIsLoading(true);
    fetchExercises(searchQuery, true);
  };

  const clearAllFilters = () => {
    const newFilters: Filters = { difficulty: null, muscle: null, equipment: null };
    setFilters(newFilters);
    filtersRef.current = newFilters;
    setIsLoading(true);
    fetchExercises(searchQuery, true);
  };

  const formatFilterLabel = (value: string): string => {
    return value
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchExercises(searchQuery, true);
    setRefreshing(false);
  }, [fetchExercises, searchQuery]);

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      fetchExercises(searchQuery, false);
    }
  };

  const formatMuscles = (muscles: string[]): string => {
    return muscles
      .slice(0, 2)
      .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
      .join(", ");
  };

  const handleExercisePress = useCallback(
    (exerciseId: string) => {
      router.push({
        pathname: "/exercise-info/[exerciseId]",
        params: { exerciseId },
      });
    },
    [router]
  );

  const renderExercise = ({ item }: { item: Exercise }) => (
    <TouchableOpacity
      style={styles.exerciseCard}
      onPress={() => handleExercisePress(item.id)}
    >
      <View style={styles.exerciseMain}>
        <View style={styles.exerciseIcon}>
          <Dumbbell size={20} color="#3B82F6" />
        </View>
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName}>{item.name}</Text>
          <Text style={styles.exerciseMeta}>
            {formatMuscles(item.primaryMuscles)}
          </Text>
        </View>
        <View style={styles.exerciseRight}>
          <View
            style={[
              styles.difficultyBadge,
              { backgroundColor: difficultyColors[item.difficulty] },
            ]}
          >
            <Text style={styles.difficultyText}>
              {difficultyLabels[item.difficulty][0]}
            </Text>
          </View>
          <ChevronRight size={16} color="#94A3B8" />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!hasMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch}>
              <X size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={20} color={activeFilterCount > 0 ? "#FFFFFF" : "#94A3B8"} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          {/* Difficulty */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Difficulty</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterChipsRow}>
                {DIFFICULTY_OPTIONS.map((diff) => (
                  <TouchableOpacity
                    key={diff}
                    style={[
                      styles.filterChip,
                      filters.difficulty === diff && { backgroundColor: difficultyColors[diff] },
                    ]}
                    onPress={() => handleFilterChange("difficulty", diff)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        filters.difficulty === diff && styles.filterChipTextActive,
                      ]}
                    >
                      {difficultyLabels[diff]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Muscle Group */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Muscle</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterChipsRow}>
                {MUSCLE_OPTIONS.map((muscle) => (
                  <TouchableOpacity
                    key={muscle}
                    style={[
                      styles.filterChip,
                      filters.muscle === muscle && styles.filterChipActive,
                    ]}
                    onPress={() => handleFilterChange("muscle", muscle)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        filters.muscle === muscle && styles.filterChipTextActive,
                      ]}
                    >
                      {formatFilterLabel(muscle)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Equipment */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Equipment</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterChipsRow}>
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <TouchableOpacity
                    key={eq}
                    style={[
                      styles.filterChip,
                      filters.equipment === eq && styles.filterChipActive,
                    ]}
                    onPress={() => handleFilterChange("equipment", eq)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        filters.equipment === eq && styles.filterChipTextActive,
                      ]}
                    >
                      {formatFilterLabel(eq)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearAllFilters}>
              <Text style={styles.clearFiltersText}>Clear All Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Exercise List */}
      {isLoading && exercises.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : exercises.length === 0 ? (
        <View style={styles.emptyState}>
          <Dumbbell size={48} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No Exercises Found</Text>
          <Text style={styles.emptyText}>
            Try a different search term
          </Text>
        </View>
      ) : (
        <FlatList
          data={exercises}
          renderItem={renderExercise}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: 16,
    paddingVertical: 12,
  },
  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: "#3B82F6",
  },
  filterBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  filtersContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  filterSection: {
    marginBottom: 12,
  },
  filterLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    marginLeft: 16,
    marginBottom: 8,
  },
  filterChipsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    backgroundColor: "#334155",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: "#3B82F6",
  },
  filterChipText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  clearFiltersButton: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  clearFiltersText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  exerciseCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  exerciseMain: {
    flexDirection: "row",
    alignItems: "center",
  },
  exerciseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "500",
  },
  exerciseMeta: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },
  exerciseRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  difficultyBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  difficultyText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
});
