import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Link } from "expo-router";
import { Dumbbell, Brain, TrendingUp, Target } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.logoContainer}>
            <Dumbbell size={64} color="#3B82F6" />
          </View>
          <Text style={styles.title}>Lifters Club</Text>
          <Text style={styles.tagline}>Train Smarter, Not Harder</Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Brain size={24} color="#3B82F6" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Intelligent Decisions</Text>
              <Text style={styles.featureDescription}>
                AI-powered recommendations based on your performance
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <TrendingUp size={24} color="#22C55E" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Track Progress</Text>
              <Text style={styles.featureDescription}>
                Log workouts and visualize your gains over time
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Target size={24} color="#A855F7" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Smart Programs</Text>
              <Text style={styles.featureDescription}>
                Programs that adapt to you, not the other way around
              </Text>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Create Account</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "space-between",
  },
  hero: {
    alignItems: "center",
    marginTop: 48,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    color: "#94A3B8",
    textAlign: "center",
  },
  features: {
    gap: 20,
  },
  feature: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F8FAFC",
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: "#94A3B8",
    lineHeight: 20,
  },
  buttons: {
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 18,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
  },
});
