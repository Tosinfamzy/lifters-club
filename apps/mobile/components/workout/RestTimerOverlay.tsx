import { View, Text, TouchableOpacity } from "react-native";
import { Timer, Plus, X } from "lucide-react-native";
import { styles } from "./workout.styles";

interface RestTimerOverlayProps {
  timeRemaining: number;
  targetTime: number;
  onAddTime: (seconds: number) => void;
  onSkip: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function RestTimerOverlay({
  timeRemaining,
  targetTime,
  onAddTime,
  onSkip,
}: RestTimerOverlayProps) {
  return (
    <View style={styles.restOverlay}>
      <View style={styles.restCard}>
        <Timer size={32} color="#3B82F6" />
        <Text style={styles.restTitle}>Rest</Text>
        <Text style={styles.restTime}>{formatTime(timeRemaining)}</Text>
        <View style={styles.restProgress}>
          <View
            style={[
              styles.restProgressFill,
              {
                width: `${((targetTime - timeRemaining) / targetTime) * 100}%`,
              },
            ]}
          />
        </View>
        <View style={styles.restActions}>
          <TouchableOpacity
            style={styles.restActionButton}
            onPress={() => onAddTime(30)}
          >
            <Plus size={16} color="#F8FAFC" />
            <Text style={styles.restActionText}>30s</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.restActionButton, styles.skipButton]}
            onPress={onSkip}
          >
            <X size={16} color="#F8FAFC" />
            <Text style={styles.restActionText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
