import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Settings } from "lucide-react-native";
import { useApi } from "../../hooks/use-api";

interface MachineSetupSheetProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  exerciseId: string;
  exerciseName: string;
}

/** Parse a numeric input; blank/invalid → undefined. */
function num(s: string): number | undefined {
  const t = s.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * In-workout capture of a machine's real limits for the current exercise, so the
 * engine snaps prescribed loads to weights the machine can actually make and
 * prefers a confirmed working weight. Loads any existing instance to prefill;
 * saves via PUT /users/:id/equipment-instances.
 */
export function MachineSetupSheet({
  visible,
  onClose,
  userId,
  exerciseId,
  exerciseName,
}: MachineSetupSheetProps) {
  const api = useApi();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState("");
  const [working, setWorking] = useState("");
  const [minWeight, setMinWeight] = useState("");

  // Load any existing instance for this exercise when the sheet opens.
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setStep("");
    setWorking("");
    setMinWeight("");
    api
      .getEquipmentInstances(userId)
      .then((res) => {
        if (!active) return;
        const existing = (res.data ?? []).find((i) => i.exerciseId === exerciseId);
        if (existing) {
          setStep(existing.incrementConstraint?.toString() ?? "");
          setWorking(existing.confirmedWorkingWeight?.toString() ?? "");
          setMinWeight(existing.minWeight?.toString() ?? "");
        }
      })
      .catch((err) => console.error("Failed to load equipment instance:", err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible, userId, exerciseId, api]);

  const stepVal = num(step);
  const stepInvalid = step.trim() !== "" && (stepVal === undefined || stepVal <= 0);
  const hasAnything = step.trim() !== "" || working.trim() !== "" || minWeight.trim() !== "";

  const handleSave = async () => {
    if (stepInvalid) return;
    setSaving(true);
    try {
      await api.updateEquipmentInstance(userId, {
        exerciseId,
        incrementConstraint: stepVal,
        confirmedWorkingWeight: num(working),
        minWeight: num(minWeight),
      });
      onClose();
    } catch (err) {
      console.error("Failed to save machine setup:", err);
      Alert.alert("Couldn't save", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Settings size={20} color="#3B82F6" />
              <Text style={styles.title}>Machine Setup</Text>
            </View>
            <Text style={styles.subtitle} numberOfLines={1}>
              {exerciseName}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#3B82F6" style={{ marginVertical: 24 }} />
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Weight step (kg)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="e.g. 5"
                  placeholderTextColor="#64748B"
                  value={step}
                  onChangeText={setStep}
                />
                {stepInvalid && <Text style={styles.error}>Must be greater than 0.</Text>}
                <Text style={styles.hint}>The smallest jump the machine can make.</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Working weight (kg)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="optional"
                  placeholderTextColor="#64748B"
                  value={working}
                  onChangeText={setWorking}
                />
                <Text style={styles.hint}>A confirmed weight you work with here.</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Min weight (kg)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="optional"
                  placeholderTextColor="#64748B"
                  value={minWeight}
                  onChangeText={setMinWeight}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, (!hasAnything || stepInvalid || saving) && styles.saveDisabled]}
                onPress={handleSave}
                disabled={!hasAnything || stepInvalid || saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1E293B",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  subtitle: {
    fontSize: 14,
    color: "#94A3B8",
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F8FAFC",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#F8FAFC",
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  error: {
    fontSize: 12,
    color: "#F87171",
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  saveDisabled: {
    opacity: 0.5,
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  cancelText: {
    color: "#94A3B8",
    fontSize: 16,
    fontWeight: "500",
  },
});
