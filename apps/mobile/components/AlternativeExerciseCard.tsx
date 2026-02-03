import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Dumbbell, Star } from "lucide-react-native";

interface AlternativeExerciseCardProps {
  exercise: {
    id: string;
    name: string;
    difficulty: "beginner" | "intermediate" | "advanced";
    equipment: string[];
  };
  matchScore: number;
  matchReasons: string[];
  sets: number;
  repRange: [number, number];
  isOriginal?: boolean;
  isSelected?: boolean;
  onPress?: () => void;
}

export function AlternativeExerciseCard({
  exercise,
  matchScore,
  matchReasons,
  sets,
  repRange,
  isOriginal = false,
  isSelected = false,
  onPress,
}: AlternativeExerciseCardProps) {
  // Color by difficulty
  const difficultyColors = {
    beginner: { bg: "#10B981", text: "#000", border: "#10B981" },
    intermediate: { bg: "#F59E0B", text: "#000", border: "#F59E0B" },
    advanced: { bg: "#EF4444", text: "#FFF", border: "#EF4444" },
  };

  // Color by match score
  const getMatchScoreColor = (score: number): string => {
    if (score >= 0.9) return "#10B981"; // Green for 90-100%
    if (score >= 0.7) return "#F59E0B"; // Yellow for 70-89%
    return "#94A3B8"; // Grey for <70%
  };

  const difficultyConfig = difficultyColors[exercise.difficulty];
  const matchScoreColor = getMatchScoreColor(matchScore);
  const matchPercentage = Math.round(matchScore * 100);

  // Format rep range
  const repRangeText =
    repRange[0] === repRange[1]
      ? `${repRange[0]} REPS`
      : `${repRange[0]}-${repRange[1]} REPS`;

  // Get first 2 match reasons
  const displayReasons = matchReasons.slice(0, 2).join(" • ");

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        !onPress && styles.cardDisabled,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {/* Thumbnail placeholder */}
      <View
        style={[
          styles.thumbnail,
          { borderColor: difficultyConfig.border },
        ]}
      >
        <Dumbbell size={24} color="#94A3B8" />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Header: Name + Difficulty Badge */}
        <View style={styles.header}>
          <Text style={styles.exerciseName} numberOfLines={1}>
            {exercise.name}
          </Text>
          <View
            style={[
              styles.difficultyBadge,
              { backgroundColor: difficultyConfig.bg },
            ]}
          >
            <Text
              style={[
                styles.difficultyText,
                { color: difficultyConfig.text },
              ]}
            >
              {exercise.difficulty.toUpperCase().slice(0, 3)}
            </Text>
          </View>
          {isOriginal && (
            <View style={styles.originalBadge}>
              <Text style={styles.originalText}>ORIGINAL</Text>
            </View>
          )}
        </View>

        {/* Sets/Reps */}
        <Text style={styles.setsReps}>
          {sets} SETS ⟳ {repRangeText}
        </Text>

        {/* Match Score (only if not original) */}
        {!isOriginal && (
          <View style={styles.matchRow}>
            <Star size={12} color={matchScoreColor} fill={matchScoreColor} />
            <Text style={[styles.matchScore, { color: matchScoreColor }]}>
              {matchPercentage}% match
            </Text>
          </View>
        )}

        {/* Match Reasons */}
        {!isOriginal && displayReasons && (
          <Text style={styles.matchReasons} numberOfLines={1}>
            {displayReasons}
          </Text>
        )}

        {/* Equipment */}
        <Text style={styles.equipment} numberOfLines={1}>
          {exercise.equipment.join(", ")}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardSelected: {
    borderColor: "#3B82F6",
  },
  cardDisabled: {
    opacity: 1,
  },
  thumbnail: {
    width: 60,
    height: 60,
    backgroundColor: "#334155",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    marginRight: 12,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
    flex: 1,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: "700",
  },
  originalBadge: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  originalText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFF",
  },
  setsReps: {
    fontSize: 12,
    fontWeight: "600",
    color: "#CBD5E1",
    marginBottom: 4,
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  matchScore: {
    fontSize: 12,
    fontWeight: "600",
  },
  matchReasons: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 4,
  },
  equipment: {
    fontSize: 12,
    color: "#64748B",
  },
});
