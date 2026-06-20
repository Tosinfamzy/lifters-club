"use client";

import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dumbbell, Target, Ruler, Loader2, CheckCircle, Bell, Mail } from "lucide-react";
import { toast } from "sonner";
import type { WeightUnit } from "@gymapp/types";
import { useAppUser } from "@/providers/user-provider";
import { useApi } from "@/lib/use-api";
import { ConstraintsCard } from "@/components/settings/constraints-card";
import { SubstitutionsCard } from "@/components/settings/substitutions-card";
import { EquipmentInstancesCard } from "@/components/settings/equipment-instances-card";

interface NotificationPreferences {
  emailWorkoutReminders: boolean;
  emailWeeklySummary: boolean;
  emailProgressAlerts: boolean;
  pushEnabled: boolean;
}

export default function SettingsPage() {
  const { appUser, refetch } = useAppUser();
  const api = useApi();

  const [trainingLevel, setTrainingLevel] = useState<string>(
    appUser?.trainingLevel || "intermediate"
  );
  const [primaryGoal, setPrimaryGoal] = useState<string>(
    appUser?.primaryGoal || "hypertrophy"
  );
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(
    (appUser?.preferences?.weightUnit as WeightUnit) || "lbs"
  );

  const defaultNotifications: NotificationPreferences = {
    emailWorkoutReminders: true,
    emailWeeklySummary: true,
    emailProgressAlerts: true,
    pushEnabled: false,
  };

  const savedNotifications = appUser?.preferences?.notifications as NotificationPreferences | undefined;

  const [notifications, setNotifications] = useState<NotificationPreferences>({
    ...defaultNotifications,
    ...savedNotifications,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const notificationsChanged =
    notifications.emailWorkoutReminders !== (savedNotifications?.emailWorkoutReminders ?? defaultNotifications.emailWorkoutReminders) ||
    notifications.emailWeeklySummary !== (savedNotifications?.emailWeeklySummary ?? defaultNotifications.emailWeeklySummary) ||
    notifications.emailProgressAlerts !== (savedNotifications?.emailProgressAlerts ?? defaultNotifications.emailProgressAlerts) ||
    notifications.pushEnabled !== (savedNotifications?.pushEnabled ?? defaultNotifications.pushEnabled);

  const hasChanges =
    trainingLevel !== appUser?.trainingLevel ||
    primaryGoal !== appUser?.primaryGoal ||
    weightUnit !== ((appUser?.preferences?.weightUnit as string) || "lbs") ||
    notificationsChanged;

  const handleSave = async () => {
    if (!appUser) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await api.updateUser(appUser.id, {
        trainingLevel,
        primaryGoal,
        preferences: {
          ...appUser.preferences,
          weightUnit,
          notifications,
        },
      });

      setSaveSuccess(true);
      toast.success("Settings saved");
      await refetch();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
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
              <Select value={weightUnit} onValueChange={(v) => setWeightUnit(v as WeightUnit)}>
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

        {/* Notifications Section */}
        <div className="pt-4">
          <h2 className="text-xl font-semibold mb-4">Notifications</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Email Notifications */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Email Notifications</CardTitle>
                </div>
                <CardDescription>
                  Choose which emails you&apos;d like to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="workout-reminders">Workout Reminders</Label>
                    <p className="text-xs text-muted-foreground">
                      Get reminded when you have scheduled workouts
                    </p>
                  </div>
                  <Switch
                    id="workout-reminders"
                    checked={notifications.emailWorkoutReminders}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({
                        ...prev,
                        emailWorkoutReminders: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="weekly-summary">Weekly Summary</Label>
                    <p className="text-xs text-muted-foreground">
                      Receive a weekly recap of your training
                    </p>
                  </div>
                  <Switch
                    id="weekly-summary"
                    checked={notifications.emailWeeklySummary}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({
                        ...prev,
                        emailWeeklySummary: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="progress-alerts">Progress Alerts</Label>
                    <p className="text-xs text-muted-foreground">
                      Get notified when you hit new PRs
                    </p>
                  </div>
                  <Switch
                    id="progress-alerts"
                    checked={notifications.emailProgressAlerts}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({
                        ...prev,
                        emailProgressAlerts: checked,
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Push Notifications */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Push Notifications</CardTitle>
                </div>
                <CardDescription>
                  Real-time notifications on your device
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-enabled">Enable Push Notifications</Label>
                    <p className="text-xs text-muted-foreground">
                      Receive instant updates on your device
                    </p>
                  </div>
                  <Switch
                    id="push-enabled"
                    checked={notifications.pushEnabled}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({
                        ...prev,
                        pushEnabled: checked,
                      }))
                    }
                  />
                </div>
                {notifications.pushEnabled && (
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">
                      Push notifications are coming soon. We&apos;ll notify you when they&apos;re available.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Coaching Profile Section */}
        <div className="pt-4">
          <h2 className="text-xl font-semibold mb-4">Coaching Profile</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Context the decision engine uses to tailor and keep your training safe.
          </p>
          <div className="space-y-6">
            <ConstraintsCard />
            <SubstitutionsCard />
            <EquipmentInstancesCard />
          </div>
        </div>
      </div>
  );
}
