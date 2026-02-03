"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dumbbell, Target, Ruler, Loader2, CheckCircle } from "lucide-react";
import { useAppUser } from "@/providers/user-provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function SettingsPage() {
  const { appUser, refetch } = useAppUser();
  const { getToken } = useAuth();

  const [trainingLevel, setTrainingLevel] = useState<string>(
    appUser?.trainingLevel || "intermediate"
  );
  const [primaryGoal, setPrimaryGoal] = useState<string>(
    appUser?.primaryGoal || "hypertrophy"
  );
  const [weightUnit, setWeightUnit] = useState(
    (appUser?.preferences?.weightUnit as string) || "lbs"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const hasChanges =
    trainingLevel !== appUser?.trainingLevel ||
    primaryGoal !== appUser?.primaryGoal ||
    weightUnit !== ((appUser?.preferences?.weightUnit as string) || "lbs");

  const handleSave = async () => {
    if (!appUser) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/users/${appUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          trainingLevel,
          primaryGoal,
          preferences: {
            ...appUser.preferences,
            weightUnit,
          },
        }),
      });

      if (response.ok) {
        setSaveSuccess(true);
        await refetch();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Manage your training preferences
            </p>
          </div>
          {hasChanges && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Saved!
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Training Level */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Training Level</CardTitle>
              </div>
              <CardDescription>
                Your experience level affects program recommendations and
                progression rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={trainingLevel} onValueChange={setTrainingLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">
                    Beginner (&lt; 1 year)
                  </SelectItem>
                  <SelectItem value="intermediate">
                    Intermediate (1-3 years)
                  </SelectItem>
                  <SelectItem value="advanced">
                    Advanced (3+ years)
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Primary Goal */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Primary Goal</CardTitle>
              </div>
              <CardDescription>
                Your main training objective influences volume, intensity, and
                exercise selection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={primaryGoal} onValueChange={setPrimaryGoal}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strength">Strength</SelectItem>
                  <SelectItem value="hypertrophy">Hypertrophy</SelectItem>
                  <SelectItem value="conditioning">Conditioning</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Weight Unit */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Ruler className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Weight Unit</CardTitle>
              </div>
              <CardDescription>
                Unit used for displaying and logging weights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={weightUnit} onValueChange={setWeightUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                  <SelectItem value="kg">Kilograms (kg)</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
