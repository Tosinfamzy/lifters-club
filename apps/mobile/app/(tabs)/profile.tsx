import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { User, Settings, LogOut, ChevronRight, Target, Dumbbell } from "lucide-react-native";
import { useAppUser } from "../../providers/user-provider";

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const { appUser } = useAppUser();
  const router = useRouter();

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await signOut();
            router.replace("/(auth)/sign-in");
          },
        },
      ]
    );
  };

  const goalLabel = {
    strength: "Strength",
    hypertrophy: "Hypertrophy",
    conditioning: "Conditioning",
  };

  const levelLabel = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <User size={40} color="#F8FAFC" />
        </View>
        <Text style={styles.name}>
          {user?.firstName || user?.emailAddresses[0]?.emailAddress?.split("@")[0] || "Lifter"}
        </Text>
        <Text style={styles.email}>{user?.emailAddresses[0]?.emailAddress}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Target size={24} color="#3B82F6" />
          <Text style={styles.statValue}>
            {appUser ? levelLabel[appUser.trainingLevel] : "—"}
          </Text>
          <Text style={styles.statLabel}>Level</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Dumbbell size={24} color="#3B82F6" />
          <Text style={styles.statValue}>
            {appUser ? goalLabel[appUser.goal] : "—"}
          </Text>
          <Text style={styles.statLabel}>Goal</Text>
        </View>
      </View>

      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/settings")}>
          <View style={styles.menuItemLeft}>
            <Settings size={20} color="#94A3B8" />
            <Text style={styles.menuItemText}>Settings</Text>
          </View>
          <ChevronRight size={20} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/edit-profile")}>
          <View style={styles.menuItemLeft}>
            <User size={20} color="#94A3B8" />
            <Text style={styles.menuItemText}>Edit Profile</Text>
          </View>
          <ChevronRight size={20} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, styles.logoutItem]}
          onPress={handleSignOut}
        >
          <View style={styles.menuItemLeft}>
            <LogOut size={20} color="#EF4444" />
            <Text style={[styles.menuItemText, styles.logoutText]}>Sign Out</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Lifters Club v1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  header: {
    alignItems: "center",
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  name: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "700",
  },
  email: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 16,
    padding: 20,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  divider: {
    width: 1,
    backgroundColor: "#334155",
    marginHorizontal: 16,
  },
  statValue: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  statLabel: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 4,
  },
  menuSection: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuItemText: {
    color: "#F8FAFC",
    fontSize: 16,
  },
  logoutItem: {
    marginTop: 16,
  },
  logoutText: {
    color: "#EF4444",
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  footerText: {
    color: "#64748B",
    fontSize: 12,
  },
});
