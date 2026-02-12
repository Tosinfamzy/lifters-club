import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Check, Target, Dumbbell, Zap, Award } from "lucide-react-native";
import { useAppUser } from "../providers/user-provider";
import { useApi } from "../hooks/use-api";

type TrainingLevel = "beginner" | "intermediate" | "advanced";
type Goal = "strength" | "hypertrophy" | "conditioning";

const levels: { value: TrainingLevel; label: string; description: string }[] = [
  { value: "beginner", label: "Beginner", description: "New to lifting (< 1 year)" },
  { value: "intermediate", label: "Intermediate", description: "Consistent training (1-3 years)" },
  { value: "advanced", label: "Advanced", description: "Experienced lifter (3+ years)" },
];

const goals: { value: Goal; label: string; description: string; icon: typeof Target }[] = [
  { value: "strength", label: "Strength", description: "Build raw power", icon: Award },
  { value: "hypertrophy", label: "Hypertrophy", description: "Build muscle size", icon: Dumbbell },
  { value: "conditioning", label: "Conditioning", description: "Improve endurance", icon: Zap },
];

export default function EditProfileScreen() {
  const api = useApi();
  const router = useRouter();
  const { appUser, refetch } = useAppUser();

  const [trainingLevel, setTrainingLevel] = useState<TrainingLevel>(
    appUser?.trainingLevel || "intermediate"
  );
  const [goal, setGoal] = useState<Goal>(appUser?.primaryGoal || "hypertrophy");
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges =
    trainingLevel !== appUser?.trainingLevel || goal !== appUser?.primaryGoal;

  const handleSave = async () => {
    if (!appUser || !hasChanges) return;

    setIsSaving(true);

    try {
      await api.updateUser(appUser.id, {
        trainingLevel,
        primaryGoal: goal,
      });

      await refetch();
      Alert.alert("Success", "Profile updated successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      console.error("Failed to update profile:", err);
      Alert.alert("Error", "Failed to connect to server");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Training Level */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Training Experience</Text>
          <Text style={styles.sectionDescription}>
            This helps us customize your workout recommendations
          </Text>
          <View style={styles.options}>
            {levels.map((level) => (
              <TouchableOpacity
                key={level.value}
                style={[
                  styles.option,
                  trainingLevel === level.value && styles.optionSelected,
                ]}
                onPress={() => setTrainingLevel(level.value)}
              >
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionLabel,
                      trainingLevel === level.value && styles.optionLabelSelected,
                    ]}
                  >
                    {level.label}
                  </Text>
                  <Text style={styles.optionDescription}>{level.description}</Text>
                </View>
                {trainingLevel === level.value && (
                  <View style={styles.checkmark}>
                    <Check size={16} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Goal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary Goal</Text>
          <Text style={styles.sectionDescription}>
            We'll tailor program recommendations based on your goal
          </Text>
          <View style={styles.options}>
            {goals.map((g) => {
              const Icon = g.icon;
              return (
                <TouchableOpacity
                  key={g.value}
                  style={[styles.option, goal === g.value && styles.optionSelected]}
                  onPress={() => setGoal(g.value)}
                >
                  <View style={styles.optionContent}>
                    <View style={styles.optionWithIcon}>
                      <Icon
                        size={24}
                        color={goal === g.value ? "#3B82F6" : "#94A3B8"}
                      />
                      <View>
                        <Text
                          style={[
                            styles.optionLabel,
                            goal === g.value && styles.optionLabelSelected,
                          ]}
                        >
                          {g.label}
                        </Text>
                        <Text style={styles.optionDescription}>{g.description}</Text>
                      </View>
                    </View>
                  </View>
                  {goal === g.value && (
                    <View style={styles.checkmark}>
                      <Check size={16} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  saveButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#334155",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  saveButtonTextDisabled: {
    color: "#64748B",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  sectionDescription: {
    color: "#94A3B8",
    fontSize: 14,
    marginBottom: 16,
  },
  options: {
    gap: 12,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionSelected: {
    borderColor: "#3B82F6",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  optionContent: {
    flex: 1,
  },
  optionWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionLabel: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
  },
  optionLabelSelected: {
    color: "#3B82F6",
  },
  optionDescription: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 2,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
});
