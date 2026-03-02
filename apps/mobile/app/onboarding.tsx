import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import {
  Dumbbell,
  Target,
  Zap,
  Award,
  ChevronRight,
  Check,
  Scale,
  Calculator,
  Rocket,
} from "lucide-react-native";
import { useAppUser } from "../providers/user-provider";
import { useApi } from "../hooks/use-api";
import { ApiRequestError } from "../lib/api";
import type {
  CalibrationExercise,
  CalibrationPlanResponse,
  BaselineMethod,
} from "../lib/api";

type TrainingLevel = "beginner" | "intermediate" | "advanced";
type Goal = "strength" | "hypertrophy" | "conditioning";
type Equipment = "barbell" | "dumbbell" | "cables" | "machines" | "bodyweight";

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

const equipmentOptions: { value: Equipment; label: string }[] = [
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbells" },
  { value: "cables", label: "Cable Machine" },
  { value: "machines", label: "Weight Machines" },
  { value: "bodyweight", label: "Bodyweight Only" },
];

const baselineMethods: { value: BaselineMethod; label: string; description: string; icon: typeof Scale }[] = [
  { value: "known_maxes", label: "I know my working weights", description: "Enter weights you can lift for 5-8 reps", icon: Scale },
  { value: "calibration", label: "Run calibration workouts", description: "We'll guide you through test sets", icon: Calculator },
  { value: "conservative_start", label: "Start conservative", description: "Begin light and build up over time", icon: Rocket },
];

interface BaselineInput {
  exerciseId: string;
  exerciseName: string;
  weight: string;
  reps: string;
}

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const { user } = useUser();
  const router = useRouter();
  const { refetch } = useAppUser();
  const api = useApi();

  const [step, setStep] = useState(1);
  const [trainingLevel, setTrainingLevel] = useState<TrainingLevel | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment[]>([]);
  const [baselineMethod, setBaselineMethod] = useState<BaselineMethod | null>(null);
  const [calibrationPlan, setCalibrationPlan] = useState<CalibrationPlanResponse | null>(null);
  const [baselines, setBaselines] = useState<BaselineInput[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [error, setError] = useState("");

  const toggleEquipment = (equipment: Equipment) => {
    setSelectedEquipment((prev) => {
      if (prev.includes(equipment)) {
        return prev.filter((e) => e !== equipment);
      }
      // Selecting bodyweight clears others; selecting others clears bodyweight
      if (equipment === "bodyweight") {
        return ["bodyweight"];
      }
      return [...prev.filter((e) => e !== "bodyweight"), equipment];
    });
  };

  const fetchCalibrationPlan = async () => {
    if (!user || selectedEquipment.length === 0) return;

    setIsLoadingPlan(true);
    try {
      const userId = `user-${user.id.slice(0, 8)}`;
      const result = await api.getCalibrationPlan(userId, selectedEquipment);
      setCalibrationPlan(result.data);

      if (result.data.plan?.exercises) {
        setBaselines(
          result.data.plan.exercises.map((ex: CalibrationExercise) => ({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            weight: "",
            reps: "8",
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch calibration plan:", err);
      setError("Failed to load calibration plan");
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const updateBaseline = (index: number, field: "weight" | "reps", value: string) => {
    setBaselines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index]!, [field]: value };
      return updated;
    });
  };

  const hasValidBaselines = () => {
    if (baselineMethod !== "known_maxes") return true;
    return baselines.every((b) => b.weight && parseFloat(b.weight) > 0);
  };

  const handleComplete = async () => {
    if (!user || !trainingLevel || !goal || !baselineMethod) return;

    setIsLoading(true);
    setError("");

    try {
      const userId = `user-${user.id.slice(0, 8)}`;

      // Step 1: Create user profile
      try {
        await api.createUser({
          id: userId,
          clerkId: user.id,
          email: user.emailAddresses[0]?.emailAddress,
          trainingLevel,
          primaryGoal: goal,
        });
      } catch (err) {
        // 409 = user already exists, continue to save baselines
        if (!(err instanceof ApiRequestError && err.status === 409)) {
          throw err;
        }
      }

      // Step 2: Save baselines if user provided them
      if (baselineMethod === "known_maxes" && baselines.length > 0) {
        const validBaselines = baselines
          .filter((b) => b.weight && parseFloat(b.weight) > 0)
          .map((b) => ({
            exerciseId: b.exerciseId,
            weight: parseFloat(b.weight),
            reps: parseInt(b.reps) || 8,
            source: "user_input" as const,
          }));

        if (validBaselines.length > 0) {
          try {
            await api.saveUserBaselines(userId, validBaselines);
          } catch {
            console.error("Failed to save baselines, continuing anyway");
          }
        }
      }

      // Step 3: Mark onboarding as complete
      await api.updateOnboardingStatus(userId, {
        onboardingComplete: true,
        baselineComplete: baselineMethod === "known_maxes" || baselineMethod === "conservative_start",
      });

      await refetch();
      router.replace("/(tabs)");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 429) {
          setError("Too many requests. Please wait a moment and try again.");
          return;
        }
        setError(err.message || "Failed to create profile");
      } else {
        console.error("Failed to complete onboarding:", err);
        setError("Failed to connect to server");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3, 4].map((s) => (
        <View
          key={s}
          style={[styles.stepDot, step >= s && styles.stepDotActive]}
        />
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.content}>
      <Text style={styles.question}>What&apos;s your training experience?</Text>
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
  );

  const renderStep2 = () => (
    <View style={styles.content}>
      <Text style={styles.question}>What&apos;s your primary goal?</Text>
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
        <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.nextButton, !goal && styles.buttonDisabled]}
          onPress={() => setStep(3)}
          disabled={!goal}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.content}>
      <Text style={styles.question}>What equipment do you have access to?</Text>
      <View style={styles.equipmentGrid}>
        {equipmentOptions.map((eq) => (
          <TouchableOpacity
            key={eq.value}
            style={[
              styles.equipmentOption,
              selectedEquipment.includes(eq.value) && styles.equipmentSelected,
            ]}
            onPress={() => toggleEquipment(eq.value)}
          >
            <Text
              style={[
                styles.equipmentLabel,
                selectedEquipment.includes(eq.value) && styles.equipmentLabelSelected,
              ]}
            >
              {eq.label}
            </Text>
            {selectedEquipment.includes(eq.value) && (
              <Check size={16} color="#3B82F6" />
            )}
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep(2)}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            styles.nextButton,
            selectedEquipment.length === 0 && styles.buttonDisabled,
          ]}
          onPress={async () => {
            await fetchCalibrationPlan();
            setStep(4);
          }}
          disabled={selectedEquipment.length === 0}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {isLoadingPlan ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading calibration plan...</Text>
        </View>
      ) : (
        <>
          <Text style={styles.question}>How would you like to set starting weights?</Text>
          <View style={styles.options}>
            {baselineMethods.map((method) => {
              const Icon = method.icon;
              return (
                <TouchableOpacity
                  key={method.value}
                  style={[
                    styles.option,
                    baselineMethod === method.value && styles.optionSelected,
                  ]}
                  onPress={() => setBaselineMethod(method.value)}
                >
                  <View style={styles.optionContent}>
                    <Icon
                      size={24}
                      color={baselineMethod === method.value ? "#3B82F6" : "#94A3B8"}
                    />
                    <View style={styles.optionText}>
                      <Text style={styles.optionLabel}>{method.label}</Text>
                      <Text style={styles.optionDescription}>{method.description}</Text>
                    </View>
                  </View>
                  {baselineMethod === method.value && (
                    <View style={styles.checkmark}>
                      <ChevronRight size={20} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Weight inputs for known_maxes */}
          {baselineMethod === "known_maxes" && calibrationPlan?.plan && baselines.length > 0 && (
            <View style={styles.baselinesSection}>
              <Text style={styles.baselinesHint}>
                Enter the weight you can lift for about 8 reps with good form:
              </Text>
              {baselines.map((baseline, index) => (
                <View key={baseline.exerciseId} style={styles.baselineRow}>
                  <Text style={styles.baselineLabel}>{baseline.exerciseName}</Text>
                  <View style={styles.baselineInputs}>
                    <TextInput
                      style={styles.weightInput}
                      placeholder="Weight (lbs)"
                      placeholderTextColor="#64748B"
                      keyboardType="numeric"
                      value={baseline.weight}
                      onChangeText={(v) => updateBaseline(index, "weight", v)}
                    />
                    <TextInput
                      style={styles.repsInput}
                      placeholder="Reps"
                      placeholderTextColor="#64748B"
                      keyboardType="numeric"
                      value={baseline.reps}
                      onChangeText={(v) => updateBaseline(index, "reps", v)}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Info banners for other methods */}
          {baselineMethod === "calibration" && (
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerText}>
                Calibration workouts will be added to your first week. You&apos;ll perform test sets to find your working weights.
              </Text>
            </View>
          )}

          {baselineMethod === "conservative_start" && (
            <View style={[styles.infoBanner, styles.infoBannerBlue]}>
              <Text style={[styles.infoBannerText, styles.infoBannerTextBlue]}>
                We&apos;ll start you with light weights and progressively increase as you log workouts.
              </Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => setStep(3)}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.nextButton,
                (!baselineMethod || !hasValidBaselines() || isLoading) && styles.buttonDisabled,
              ]}
              onPress={handleComplete}
              disabled={!baselineMethod || !hasValidBaselines() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Get Started</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Dumbbell size={40} color="#3B82F6" />
        <Text style={styles.title}>Set Up Your Profile</Text>
        <Text style={styles.subtitle}>Step {step} of {TOTAL_STEPS}</Text>
        {renderStepIndicator()}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
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
    marginBottom: 32,
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
  stepIndicator: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  stepDot: {
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#334155",
  },
  stepDotActive: {
    backgroundColor: "#3B82F6",
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
    flex: 1,
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
  nextButton: {
    flex: 2,
    marginTop: 0,
  },

  // Equipment grid
  equipmentGrid: {
    gap: 10,
  },
  equipmentOption: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  equipmentSelected: {
    borderColor: "#3B82F6",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  equipmentLabel: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "500",
  },
  equipmentLabelSelected: {
    color: "#3B82F6",
  },

  // Baseline inputs
  baselinesSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingTop: 20,
  },
  baselinesHint: {
    color: "#94A3B8",
    fontSize: 14,
    marginBottom: 16,
  },
  baselineRow: {
    marginBottom: 16,
  },
  baselineLabel: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 8,
  },
  baselineInputs: {
    flexDirection: "row",
    gap: 10,
  },
  weightInput: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 14,
    color: "#F8FAFC",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  repsInput: {
    width: 80,
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 14,
    color: "#F8FAFC",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },

  // Info banners
  infoBanner: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(234, 179, 8, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.2)",
  },
  infoBannerBlue: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  infoBannerText: {
    color: "#EAB308",
    fontSize: 14,
    lineHeight: 20,
  },
  infoBannerTextBlue: {
    color: "#60A5FA",
  },

  // Loading
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 16,
  },
});
