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
import { Dumbbell, Loader2, Target, TrendingUp, Zap } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type TrainingLevel = "beginner" | "intermediate" | "advanced";
type PrimaryGoal = "strength" | "hypertrophy" | "conditioning";

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

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [trainingLevel, setTrainingLevel] = useState<TrainingLevel | null>(null);
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    if (!user || !trainingLevel || !primaryGoal) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const userId = `user-${user.id.slice(0, 8)}`;

      const token = await getToken();
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
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        // If user already exists, that's fine - redirect anyway
        if (response.status === 409) {
          router.push("/");
          return;
        }
        throw new Error(data.error || "Failed to create profile");
      }

      router.push("/");
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

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to Lifters Club</CardTitle>
          <CardDescription>
            {step === 1
              ? "Let's personalize your training experience"
              : "Almost there! What's your primary goal?"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-sm font-medium">What's your training level?</p>
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
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-medium">What's your primary goal?</p>
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

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!primaryGoal || isSubmitting}
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
            </div>
          )}

          {/* Progress indicator */}
          <div className="mt-6 flex justify-center gap-2">
            <div
              className={`h-2 w-8 rounded-full ${
                step >= 1 ? "bg-primary" : "bg-secondary"
              }`}
            />
            <div
              className={`h-2 w-8 rounded-full ${
                step >= 2 ? "bg-primary" : "bg-secondary"
              }`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
