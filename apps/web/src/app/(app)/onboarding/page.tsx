"use client";

import { useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dumbbell, Loader2, Target, TrendingUp, Zap, Check, Scale, Calculator, Rocket } from "lucide-react";
import type { CalibrationPath, CalibrationExercise } from "@gymapp/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type TrainingLevel = "beginner" | "intermediate" | "advanced";
type PrimaryGoal = "strength" | "hypertrophy" | "conditioning";
type Equipment = "barbell" | "dumbbell" | "cables" | "machines" | "bodyweight";
type BaselineMethod = "known_maxes" | "calibration" | "conservative_start";

const trainingLevels: { value: TrainingLevel; label: string; description: string }[] = [
  {
    value: "beginner",
    label: "Beginner",
    description: "New to structured training (< 1 year)",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    description: "Consistent training (1-3 years)",
  },
  {
    value: "advanced",
    label: "Advanced",
    description: "Experienced lifter (3+ years)",
  },
];

const primaryGoals: { value: PrimaryGoal; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "strength",
    label: "Strength",
    description: "Get stronger, lift heavier",
    icon: <Dumbbell className="h-5 w-5" />,
  },
  {
    value: "hypertrophy",
    label: "Hypertrophy",
    description: "Build muscle, increase size",
    icon: <TrendingUp className="h-5 w-5" />,
  },
  {
    value: "conditioning",
    label: "Conditioning",
    description: "Improve endurance and fitness",
    icon: <Zap className="h-5 w-5" />,
  },
];

const equipmentOptions: { value: Equipment; label: string }[] = [
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbells" },
  { value: "cables", label: "Cable Machine" },
  { value: "machines", label: "Weight Machines" },
  { value: "bodyweight", label: "Bodyweight Only" },
];

const baselineMethods: { value: BaselineMethod; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "known_maxes",
    label: "I know my working weights",
    description: "Enter weights you can lift for 5-8 reps",
    icon: <Scale className="h-5 w-5" />,
  },
  {
    value: "calibration",
    label: "Run calibration workouts",
    description: "We'll guide you through test sets",
    icon: <Calculator className="h-5 w-5" />,
  },
  {
    value: "conservative_start",
    label: "Start conservative",
    description: "Begin light and build up over time",
    icon: <Rocket className="h-5 w-5" />,
  },
];

interface CalibrationPlan {
  path: CalibrationPath;
  exercises: CalibrationExercise[];
  instructions: string;
}

interface BaselineInput {
  exerciseId: string;
  exerciseName: string;
  weight: string;
  reps: string;
}

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [trainingLevel, setTrainingLevel] = useState<TrainingLevel | null>(null);
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment[]>([]);
  const [baselineMethod, setBaselineMethod] = useState<BaselineMethod | null>(null);
  const [calibrationPlan, setCalibrationPlan] = useState<CalibrationPlan | null>(null);
  const [baselines, setBaselines] = useState<BaselineInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch calibration plan when equipment changes
  const fetchCalibrationPlan = async (userId: string, equipment: Equipment[]) => {
    if (equipment.length === 0) {
      setCalibrationPlan(null);
      setBaselines([]);
      return;
    }

    setIsLoadingPlan(true);
    try {
      const token = await getToken();
      const equipmentStr = equipment.join(",");
      const response = await fetch(
        `${API_URL}/api/users/${userId}/calibration-plan?equipment=${equipmentStr}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const { data } = await response.json();
        setCalibrationPlan(data.plan);

        // Initialize baseline inputs from plan exercises
        if (data.plan?.exercises) {
          setBaselines(
            data.plan.exercises.map((ex: CalibrationExercise) => ({
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName,
              weight: "",
              reps: "8",
            }))
          );
        }
      }
    } catch (err) {
      console.error("Failed to fetch calibration plan:", err);
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const toggleEquipment = (equipment: Equipment) => {
    setSelectedEquipment((prev) => {
      if (prev.includes(equipment)) {
        return prev.filter((e) => e !== equipment);
      }
      // If selecting bodyweight only, clear others
      if (equipment === "bodyweight") {
        return ["bodyweight"];
      }
      // If selecting other equipment, remove bodyweight
      return [...prev.filter((e) => e !== "bodyweight"), equipment];
    });
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
    if (!user || !trainingLevel || !primaryGoal) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const userId = `user-${user.id.slice(0, 8)}`;
      const token = await getToken();

      // Step 1: Create user profile
      const response = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: userId,
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress || "",
          trainingLevel,
          primaryGoal,
          preferences: {
            weightUnit: "lbs",
            weekStartsOn: "monday",
            equipment: selectedEquipment,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        // If user already exists, continue to save baselines
        if (response.status !== 409) {
          throw new Error(data.error || "Failed to create profile");
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
          const baselinesResponse = await fetch(
            `${API_URL}/api/users/${userId}/baselines`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ baselines: validBaselines }),
            }
          );

          if (!baselinesResponse.ok) {
            console.error("Failed to save baselines, continuing anyway");
          }
        }
      }

      // Step 3: Mark onboarding as complete
      await fetch(`${API_URL}/api/users/${userId}/onboarding`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          onboardingComplete: true,
          baselineComplete: baselineMethod === "known_maxes" || baselineMethod === "conservative_start",
        }),
      });

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStepDescription = () => {
    switch (step) {
      case 1:
        return "Let's personalize your training experience";
      case 2:
        return "What's your primary goal?";
      case 3:
        return "What equipment do you have access to?";
      case 4:
        return "Let's set your starting weights";
      default:
        return "";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to Lifters Club</CardTitle>
          <CardDescription>{getStepDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Training Level */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm font-medium">What&apos;s your training level?</p>
              <div className="space-y-2">
                {trainingLevels.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setTrainingLevel(level.value)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      trainingLevel === level.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <p className="font-medium">{level.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {level.description}
                    </p>
                  </button>
                ))}
              </div>
              <Button
                className="w-full"
                disabled={!trainingLevel}
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </div>
          )}

          {/* Step 2: Primary Goal */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm font-medium">What&apos;s your primary goal?</p>
              <div className="space-y-2">
                {primaryGoals.map((goal) => (
                  <button
                    key={goal.value}
                    onClick={() => setPrimaryGoal(goal.value)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      primaryGoal === goal.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-primary">{goal.icon}</div>
                      <div>
                        <p className="font-medium">{goal.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {goal.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!primaryGoal}
                  onClick={() => setStep(3)}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Equipment Selection */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm font-medium">Select all equipment you have access to:</p>
              <div className="grid grid-cols-2 gap-2">
                {equipmentOptions.map((equipment) => (
                  <button
                    key={equipment.value}
                    onClick={() => toggleEquipment(equipment.value)}
                    className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                      selectedEquipment.includes(equipment.value)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="font-medium">{equipment.label}</span>
                    {selectedEquipment.includes(equipment.value) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(2)}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={selectedEquipment.length === 0}
                  onClick={async () => {
                    if (user) {
                      const userId = `user-${user.id.slice(0, 8)}`;
                      await fetchCalibrationPlan(userId, selectedEquipment);
                    }
                    setStep(4);
                  }}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Baseline Method + Weight Inputs */}
          {step === 4 && (
            <div className="space-y-4">
              {isLoadingPlan ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">How would you like to set your starting weights?</p>
                  <div className="space-y-2">
                    {baselineMethods.map((method) => (
                      <button
                        key={method.value}
                        onClick={() => setBaselineMethod(method.value)}
                        className={`w-full rounded-lg border p-4 text-left transition-colors ${
                          baselineMethod === method.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-primary">{method.icon}</div>
                          <div>
                            <p className="font-medium">{method.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {method.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Weight inputs for known_maxes method */}
                  {baselineMethod === "known_maxes" && calibrationPlan && baselines.length > 0 && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      <p className="text-sm text-muted-foreground">
                        Enter the weight you can lift for about 8 reps with good form:
                      </p>
                      {baselines.map((baseline, index) => (
                        <div key={baseline.exerciseId} className="space-y-2">
                          <Label htmlFor={`weight-${index}`}>{baseline.exerciseName}</Label>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Input
                                id={`weight-${index}`}
                                type="number"
                                placeholder="Weight (lbs)"
                                value={baseline.weight}
                                onChange={(e) => updateBaseline(index, "weight", e.target.value)}
                              />
                            </div>
                            <div className="w-20">
                              <Input
                                type="number"
                                placeholder="Reps"
                                value={baseline.reps}
                                onChange={(e) => updateBaseline(index, "reps", e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {baselineMethod === "calibration" && (
                    <div className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        Calibration workouts will be added to your first week. You&apos;ll perform test sets to find your working weights.
                      </p>
                    </div>
                  )}

                  {baselineMethod === "conservative_start" && (
                    <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        We&apos;ll start you with light weights and progressively increase as you log workouts.
                      </p>
                    </div>
                  )}

                  {error && (
                    <p className="text-sm text-red-400">{error}</p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setStep(3)}
                      disabled={isSubmitting}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!baselineMethod || !hasValidBaselines() || isSubmitting}
                      onClick={handleComplete}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Get Started"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Progress indicator */}
          <div className="mt-6 flex justify-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 w-6 rounded-full transition-colors ${
                  step >= s ? "bg-primary" : "bg-secondary"
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
