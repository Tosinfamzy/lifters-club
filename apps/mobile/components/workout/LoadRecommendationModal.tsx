import { View, Text, TouchableOpacity } from "react-native";
import { TrendingUp } from "lucide-react-native";
import { styles } from "./workout.styles";
import type { LoadRecommendation } from "./workout.types";

interface LoadRecommendationModalProps {
  recommendation: LoadRecommendation;
  exerciseName: string;
  onDismiss: () => void;
}

export function LoadRecommendationModal({
  recommendation,
  exerciseName,
  onDismiss,
}: LoadRecommendationModalProps) {
  return (
    <View style={styles.restOverlay}>
      <View style={styles.recommendationCard}>
        <View style={styles.recommendationHeader}>
          <View
            style={[
              styles.recommendationIcon,
              recommendation.action === "increase" && styles.recommendationIconIncrease,
              recommendation.action === "decrease" && styles.recommendationIconDecrease,
              recommendation.action === "maintain" && styles.recommendationIconMaintain,
            ]}
          >
            <TrendingUp
              size={24}
              color="#FFFFFF"
              style={
                recommendation.action === "decrease"
                  ? { transform: [{ rotate: "180deg" }] }
                  : undefined
              }
            />
          </View>
          <Text style={styles.recommendationTitle}>
            {recommendation.action === "increase"
              ? "Ready to Progress!"
              : recommendation.action === "decrease"
                ? "Reduce Load"
                : "Maintain Weight"}
          </Text>
        </View>

        <Text style={styles.recommendationExercise}>{exerciseName}</Text>

        <View style={styles.recommendationWeight}>
          <Text style={styles.recommendationWeightLabel}>Next Session</Text>
          <Text style={styles.recommendationWeightValue}>
            {recommendation.newWeight} lbs
          </Text>
        </View>

        <Text style={styles.recommendationReason}>{recommendation.reason}</Text>

        <TouchableOpacity style={styles.recommendationButton} onPress={onDismiss}>
          <Text style={styles.recommendationButtonText}>Got It</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
