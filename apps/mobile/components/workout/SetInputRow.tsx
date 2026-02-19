import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { Check, Plus, Minus } from "lucide-react-native";
import { styles } from "./workout.styles";
import type { LoggedSet } from "./workout.types";

interface SetInputRowProps {
  set: LoggedSet;
  setIndex: number;
  onUpdateField: (field: "weight" | "reps" | "rpe", value: string) => void;
  onComplete: () => void;
}

export function SetInputRow({ set, setIndex, onUpdateField, onComplete }: SetInputRowProps) {
  return (
    <View style={[styles.setCard, set.completed && styles.setCardCompleted]}>
      <View style={styles.setHeader}>
        <Text style={styles.setNumber}>Set {set.setNumber}</Text>
        {set.completed && (
          <View style={styles.completedBadge}>
            <Check size={14} color="#FFFFFF" />
          </View>
        )}
      </View>

      <View style={styles.inputsRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Weight (lbs)</Text>
          <View style={styles.inputWithButtons}>
            <TouchableOpacity
              style={styles.inputButton}
              onPress={() => {
                const current = parseFloat(set.weight) || 0;
                onUpdateField("weight", String(Math.max(0, current - 5)));
              }}
              disabled={set.completed}
            >
              <Minus size={16} color={set.completed ? "#475569" : "#94A3B8"} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={set.weight}
              onChangeText={(v) => onUpdateField("weight", v)}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#64748B"
              editable={!set.completed}
            />
            <TouchableOpacity
              style={styles.inputButton}
              onPress={() => {
                const current = parseFloat(set.weight) || 0;
                onUpdateField("weight", String(current + 5));
              }}
              disabled={set.completed}
            >
              <Plus size={16} color={set.completed ? "#475569" : "#94A3B8"} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Reps</Text>
          <View style={styles.inputWithButtons}>
            <TouchableOpacity
              style={styles.inputButton}
              onPress={() => {
                const current = parseInt(set.reps) || 0;
                onUpdateField("reps", String(Math.max(0, current - 1)));
              }}
              disabled={set.completed}
            >
              <Minus size={16} color={set.completed ? "#475569" : "#94A3B8"} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={set.reps}
              onChangeText={(v) => onUpdateField("reps", v)}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#64748B"
              editable={!set.completed}
            />
            <TouchableOpacity
              style={styles.inputButton}
              onPress={() => {
                const current = parseInt(set.reps) || 0;
                onUpdateField("reps", String(current + 1));
              }}
              disabled={set.completed}
            >
              <Plus size={16} color={set.completed ? "#475569" : "#94A3B8"} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.inputGroup, styles.inputGroupSmall]}>
          <Text style={styles.inputLabel}>RPE</Text>
          <TextInput
            style={[styles.input, styles.inputSmall]}
            value={set.rpe}
            onChangeText={(v) => onUpdateField("rpe", v)}
            keyboardType="numeric"
            placeholder="7"
            placeholderTextColor="#64748B"
            editable={!set.completed}
          />
        </View>
      </View>

      {!set.completed && (
        <TouchableOpacity
          style={styles.completeSetButton}
          onPress={onComplete}
        >
          <Check size={18} color="#FFFFFF" />
          <Text style={styles.completeSetText}>Complete Set</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
