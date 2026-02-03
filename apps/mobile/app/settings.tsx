import { useState } from "react";
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
import { ArrowLeft, Trash2, Info, Scale } from "lucide-react-native";
import { offlineStorage } from "../lib/offline/storage";

const APP_VERSION = "1.0.0";

export default function SettingsScreen() {
  const router = useRouter();
  const [useLbs, setUseLbs] = useState(true);

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
          <Text style={styles.sectionTitle}>Units</Text>
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
                onValueChange={setUseLbs}
                trackColor={{ false: "#334155", true: "#3B82F6" }}
                thumbColor="#F8FAFC"
              />
              <Text style={[styles.toggleLabel, useLbs && styles.toggleLabelActive]}>lbs</Text>
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
