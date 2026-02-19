import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import type { ReadinessResult } from "../../lib/api";
import { styles } from "./workout.styles";

interface ReadinessInputs {
  sleepQuality: number;
  muscleSoreness: number;
  stressLevel: number;
  energyLevel: number;
}

interface ReadinessCheckViewProps {
  readinessResult: ReadinessResult | null;
  readinessInputs: ReadinessInputs;
  isSubmittingReadiness: boolean;
  onInputChange: (inputs: ReadinessInputs) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onGoBack: () => void;
}

function ReadinessSlider({
  label,
  value,
  onValueChange,
  lowLabel,
  highLabel,
  inverted = false,
}: {
  label: string;
  value: number;
  onValueChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
  inverted?: boolean;
}) {
  return (
    <View style={styles.readinessSlider}>
      <Text style={styles.readinessLabel}>{label}</Text>
      <View style={styles.readinessButtons}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
          const isSelected = value === num;
          const colorValue = inverted ? 11 - num : num;
          const bgColor = isSelected
            ? colorValue <= 3
              ? "#EF4444"
              : colorValue <= 6
                ? "#F59E0B"
                : "#22C55E"
            : "#334155";

          return (
            <TouchableOpacity
              key={num}
              style={[styles.readinessButton, { backgroundColor: bgColor }]}
              onPress={() => onValueChange(num)}
            >
              <Text
                style={[
                  styles.readinessButtonText,
                  isSelected && styles.readinessButtonTextActive,
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.readinessLabels}>
        <Text style={styles.readinessLabelSmall}>{lowLabel}</Text>
        <Text style={styles.readinessLabelSmall}>{highLabel}</Text>
      </View>
    </View>
  );
}

export function ReadinessCheckView({
  readinessResult,
  readinessInputs,
  isSubmittingReadiness,
  onInputChange,
  onSubmit,
  onSkip,
  onGoBack,
}: ReadinessCheckViewProps) {
  if (readinessResult) {
    const resultColor =
      readinessResult.recommendation === "proceed"
        ? "#22C55E"
        : readinessResult.recommendation === "light_session"
          ? "#F59E0B"
          : "#EF4444";

    return (
      <View style={styles.readinessContainer}>
        <Text style={styles.readinessTitle}>Ready to Train?</Text>

        <View style={styles.readinessScoreCard}>
          <Text style={[styles.readinessScore, { color: resultColor }]}>
            {readinessResult.score}%
          </Text>
          <Text style={styles.readinessRecommendation}>
            {readinessResult.recommendation === "proceed"
              ? "You're good to go!"
              : readinessResult.recommendation === "light_session"
                ? "Consider a lighter session"
                : "Rest day recommended"}
          </Text>
        </View>

        <View style={styles.readinessAdjustments}>
          {readinessResult.adjustments.map((adjustment, i) => (
            <View key={i} style={styles.readinessAdjustmentItem}>
              <View style={[styles.readinessAdjustmentDot, { backgroundColor: resultColor }]} />
              <Text style={styles.readinessAdjustmentText}>{adjustment}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.readinessProceedButton, { backgroundColor: resultColor }]}
          onPress={onSkip}
        >
          <Text style={styles.readinessProceedText}>
            {readinessResult.recommendation === "rest_day"
              ? "Continue Anyway"
              : "Start Workout"}
          </Text>
        </TouchableOpacity>

        {readinessResult.recommendation === "rest_day" && (
          <TouchableOpacity
            style={styles.readinessSkipButton}
            onPress={onGoBack}
          >
            <Text style={styles.readinessSkipText}>Take Rest Day</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.readinessContainer}>
      <Text style={styles.readinessTitle}>Pre-Workout Check-in</Text>
      <Text style={styles.readinessSubtitle}>
        How are you feeling today?
      </Text>

      <ReadinessSlider
        label="Sleep Quality"
        value={readinessInputs.sleepQuality}
        onValueChange={(v) =>
          onInputChange({ ...readinessInputs, sleepQuality: v })
        }
        lowLabel="Poor"
        highLabel="Great"
      />

      <ReadinessSlider
        label="Muscle Soreness"
        value={readinessInputs.muscleSoreness}
        onValueChange={(v) =>
          onInputChange({ ...readinessInputs, muscleSoreness: v })
        }
        lowLabel="None"
        highLabel="Severe"
        inverted
      />

      <ReadinessSlider
        label="Stress Level"
        value={readinessInputs.stressLevel}
        onValueChange={(v) =>
          onInputChange({ ...readinessInputs, stressLevel: v })
        }
        lowLabel="Low"
        highLabel="High"
        inverted
      />

      <ReadinessSlider
        label="Energy Level"
        value={readinessInputs.energyLevel}
        onValueChange={(v) =>
          onInputChange({ ...readinessInputs, energyLevel: v })
        }
        lowLabel="Exhausted"
        highLabel="Energized"
      />

      <TouchableOpacity
        style={[
          styles.readinessProceedButton,
          isSubmittingReadiness && styles.buttonDisabled,
        ]}
        onPress={onSubmit}
        disabled={isSubmittingReadiness}
      >
        {isSubmittingReadiness ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.readinessProceedText}>Check Readiness</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.readinessSkipButton}
        onPress={onSkip}
      >
        <Text style={styles.readinessSkipText}>Skip Check-in</Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}
