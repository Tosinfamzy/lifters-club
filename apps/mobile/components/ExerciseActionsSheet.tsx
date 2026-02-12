import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { Info, RefreshCw, SkipForward, CheckCircle } from "lucide-react-native";
import type { ExerciseAction } from "../types";

interface ExerciseActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  exerciseId: string;
  exerciseName: string;
  onSelectAction: (action: ExerciseAction) => void;
}

interface ActionOption {
  action: ExerciseAction;
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  description: string;
}

export function ExerciseActionsSheet({
  visible,
  onClose,
  exerciseId: _exerciseId,
  exerciseName,
  onSelectAction,
}: ExerciseActionsSheetProps) {
  const actions: ActionOption[] = [
    {
      action: "info",
      icon: Info,
      label: "Exercise Info",
      description: "View instructions and tips",
    },
    {
      action: "alternatives",
      icon: RefreshCw,
      label: "Alternative Exercises",
      description: "Find similar exercises",
    },
    {
      action: "skip",
      icon: SkipForward,
      label: "Skip Exercise for Today",
      description: "Mark as skipped",
    },
    {
      action: "mark_done",
      icon: CheckCircle,
      label: "Mark Exercise as Done",
      description: "Auto-complete remaining sets",
    },
  ];

  const handleActionPress = (action: ExerciseAction) => {
    onSelectAction(action);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} testID="backdrop">
        {/* Bottom Sheet */}
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Exercise Actions</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {exerciseName}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {actions.map((item) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.action}
                  style={styles.actionButton}
                  onPress={() => handleActionPress(item.action)}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconContainer}>
                    <Icon size={24} color="#3B82F6" />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionLabel}>{item.label}</Text>
                    <Text style={styles.actionDescription}>
                      {item.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
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
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#94A3B8",
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#334155",
    borderRadius: 12,
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F8FAFC",
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 12,
    color: "#94A3B8",
  },
  cancelButton: {
    backgroundColor: "#334155",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F8FAFC",
  },
});
