import { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Trash2, Info, Scale, CalendarDays } from "lucide-react-native";
import type { WeekStartDay } from "@gymapp/types";
import { offlineStorage } from "../lib/offline/storage";
import { usePreferences } from "../hooks/use-preferences";
import type { DisplayPreferences } from "../lib/preferences";

const APP_VERSION = "1.0.0";

const WEEK_START_OPTIONS: { value: WeekStartDay; label: string }[] = [
  { value: "sunday", label: "Sun" },
  { value: "monday", label: "Mon" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { weightUnit, weekStartDay, updatePreferences } = usePreferences();
  // Optimistic values shown while a save is in flight
  const [pending, setPending] = useState<Partial<DisplayPreferences>>({});
  // Per-setting save counter, so an older save finishing doesn't clear a newer pending value
  const saveVersions = useRef<Partial<Record<keyof DisplayPreferences, number>>>({});
  const useLbs = (pending.weightUnit ?? weightUnit) === "lbs";
  const shownWeekStart = pending.weekStartDay ?? weekStartDay;

  const savePreference = async (changes: Partial<DisplayPreferences>) => {
    const keys = Object.keys(changes) as (keyof DisplayPreferences)[];
    const versions = keys.map((key) => {
      const version = (saveVersions.current[key] ?? 0) + 1;
      saveVersions.current[key] = version;
      return [key, version] as const;
    });

    setPending((prev) => ({ ...prev, ...changes }));
    try {
      await updatePreferences(changes);
    } catch (err) {
      console.error("Failed to save preference:", err);
      Alert.alert("Error", "Couldn't save your setting. Please try again.");
    } finally {
      setPending((prev) => {
        const next = { ...prev };
        for (const [key, version] of versions) {
          if (saveVersions.current[key] === version) delete next[key];
        }
        return next;
      });
    }
  };

  const handleClearCache = async () => {
    Alert.alert(
      "Clear Cache",
      "This will clear all cached workout data and exercise preferences. You won't lose any saved workout history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await offlineStorage.clearAll();
              Alert.alert("Success", "Cache cleared successfully");
            } catch {
              Alert.alert("Error", "Failed to clear cache");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Units Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Units & display</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Scale size={20} color="#94A3B8" />
              <View>
                <Text style={styles.settingLabel}>Weight Unit</Text>
                <Text style={styles.settingDescription}>
                  {useLbs ? "Pounds (lbs)" : "Kilograms (kg)"}
                </Text>
              </View>
            </View>
            <View style={styles.toggleContainer}>
              <Text style={[styles.toggleLabel, !useLbs && styles.toggleLabelActive]}>kg</Text>
              <Switch
                value={useLbs}
                onValueChange={(lbs) => savePreference({ weightUnit: lbs ? "lbs" : "kg" })}
                trackColor={{ false: "#334155", true: "#3B82F6" }}
                thumbColor="#F8FAFC"
              />
              <Text style={[styles.toggleLabel, useLbs && styles.toggleLabelActive]}>lbs</Text>
            </View>
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <CalendarDays size={20} color="#94A3B8" />
              <View>
                <Text style={styles.settingLabel}>Week Starts On</Text>
                <Text style={styles.settingDescription}>
                  {shownWeekStart === "sunday" ? "Sunday" : "Monday"}
                </Text>
              </View>
            </View>
            <View style={styles.segmented} accessibilityRole="radiogroup">
              {WEEK_START_OPTIONS.map((option) => {
                const selected = option.value === shownWeekStart;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.segment, selected && styles.segmentActive]}
                    onPress={() => !selected && savePreference({ weekStartDay: option.value })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.segmentLabel, selected && styles.segmentLabelActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <TouchableOpacity style={styles.settingItem} onPress={handleClearCache}>
            <View style={styles.settingLeft}>
              <Trash2 size={20} color="#EF4444" />
              <View>
                <Text style={[styles.settingLabel, { color: "#EF4444" }]}>Clear Cache</Text>
                <Text style={styles.settingDescription}>
                  Remove cached exercises and preferences
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Info size={20} color="#94A3B8" />
              <View>
                <Text style={styles.settingLabel}>Version</Text>
                <Text style={styles.settingDescription}>{APP_VERSION}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Lifters Club</Text>
          <Text style={styles.footerSubtext}>
            Built with care for lifters everywhere
          </Text>
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "500",
  },
  settingDescription: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 2,
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleLabel: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
  toggleLabelActive: {
    color: "#F8FAFC",
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: "#334155",
    borderRadius: 8,
    padding: 2,
  },
  segment: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: "#3B82F6",
  },
  segmentLabel: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  segmentLabelActive: {
    color: "#F8FAFC",
  },
  footer: {
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 24,
  },
  footerText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
  footerSubtext: {
    color: "#475569",
    fontSize: 12,
    marginTop: 4,
  },
});
