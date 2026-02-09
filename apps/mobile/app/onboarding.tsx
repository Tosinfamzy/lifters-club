import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Dumbbell, Target, Zap, Award, ChevronRight } from "lucide-react-native";
import { useAppUser } from "../providers/user-provider";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

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

export default function OnboardingScreen() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const { refetch } = useAppUser();

  const [step, setStep] = useState(1);
  const [trainingLevel, setTrainingLevel] = useState<TrainingLevel | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleComplete = async () => {
    if (!user || !trainingLevel || !goal) return;

    setIsLoading(true);
    setError("");

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          clerkId: user.id,
          email: user.emailAddresses[0]?.emailAddress,
          trainingLevel,
          primaryGoal: goal,
        }),
      });

      if (response.ok || response.status === 409) {
        // 409 = user already exists, which is fine - just proceed
        await refetch();
        router.replace("/(tabs)");
      } else if (response.status === 429) {
        setError("Too many requests. Please wait a moment and try again.");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create profile");
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Dumbbell size={40} color="#3B82F6" />
        <Text style={styles.title}>Set Up Your Profile</Text>
        <Text style={styles.subtitle}>
          Step {step} of 2
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {step === 1 ? (
        <View style={styles.content}>
          <Text style={styles.question}>What's your training experience?</Text>
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
                <View>
                  <Text style={styles.optionLabel}>{level.label}</Text>
                  <Text style={styles.optionDescription}>{level.description}</Text>
                </View>
                {trainingLevel === level.value && (
                  <View style={styles.checkmark}>
                    <ChevronRight size={20} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.button, !trainingLevel && styles.buttonDisabled]}
            onPress={() => setStep(2)}
            disabled={!trainingLevel}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.question}>What's your primary goal?</Text>
          <View style={styles.options}>
            {goals.map((g) => {
              const Icon = g.icon;
              return (
                <TouchableOpacity
                  key={g.value}
                  style={[
                    styles.option,
                    goal === g.value && styles.optionSelected,
                  ]}
                  onPress={() => setGoal(g.value)}
                >
                  <View style={styles.optionContent}>
                    <Icon size={24} color={goal === g.value ? "#3B82F6" : "#94A3B8"} />
                    <View style={styles.optionText}>
                      <Text style={styles.optionLabel}>{g.label}</Text>
                      <Text style={styles.optionDescription}>{g.description}</Text>
                    </View>
                  </View>
                  {goal === g.value && (
                    <View style={styles.checkmark}>
                      <ChevronRight size={20} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep(1)}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.finishButton, (!goal || isLoading) && styles.buttonDisabled]}
              onPress={handleComplete}
              disabled={!goal || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Get Started</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginTop: 60,
    marginBottom: 40,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 16,
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 8,
  },
  error: {
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 16,
    padding: 12,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  question: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 24,
  },
  options: {
    gap: 12,
  },
  option: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionSelected: {
    borderColor: "#3B82F6",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
  },
  optionDescription: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 2,
  },
  checkmark: {
    backgroundColor: "#3B82F6",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 32,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 32,
  },
  backButton: {
    flex: 1,
    backgroundColor: "#334155",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  backButtonText: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
  },
  finishButton: {
    flex: 2,
    marginTop: 0,
  },
});
