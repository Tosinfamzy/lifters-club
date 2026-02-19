import { View, Text, TouchableOpacity } from "react-native";
import { styles } from "./workout.styles";

interface WorkoutCompletionViewProps {
  countdownSeconds: number;
  onUndo: () => void;
}

export function WorkoutCompletionView({
  countdownSeconds,
  onUndo,
}: WorkoutCompletionViewProps) {
  return (
    <View style={styles.celebrationOverlay}>
      <View style={styles.celebrationCard}>
        <Text style={styles.celebrationTitle}>WORKOUT DONE 🎉</Text>
        <Text style={styles.celebrationSubtitle}>Great session!</Text>

        <TouchableOpacity style={styles.undoButton} onPress={onUndo}>
          <Text style={styles.undoButtonText}>UNDO</Text>
        </TouchableOpacity>

        <Text style={styles.undoTimer}>
          Redirecting in {countdownSeconds}s
        </Text>
      </View>
    </View>
  );
}
