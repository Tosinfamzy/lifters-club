import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { WifiOff, RefreshCw, Cloud, CloudOff } from "lucide-react-native";
import { useOffline } from "../providers/offline-provider";

interface OfflineIndicatorProps {
  /** Show as a banner at the top of the screen */
  variant?: "banner" | "badge" | "minimal";
}

/**
 * Displays the current sync status and offline indicator.
 *
 * - Shows a banner when offline with pending changes
 * - Shows sync status when syncing
 * - Hides when fully synced and online
 */
export function OfflineIndicator({ variant = "banner" }: OfflineIndicatorProps) {
  const { isOnline, isSyncing, pendingCount, syncNow } = useOffline();

  // Don't show anything when connected and no pending changes
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  if (variant === "minimal") {
    return (
      <View style={styles.minimalContainer}>
        {!isOnline && <WifiOff size={14} color="#F59E0B" />}
        {isSyncing && (
          <Animated.View>
            <RefreshCw size={14} color="#3B82F6" />
          </Animated.View>
        )}
        {pendingCount > 0 && (
          <View style={styles.minimalBadge}>
            <Text style={styles.minimalBadgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>
    );
  }

  if (variant === "badge") {
    return (
      <TouchableOpacity style={styles.badgeContainer} onPress={syncNow}>
        {!isOnline ? (
          <>
            <CloudOff size={16} color="#F59E0B" />
            <Text style={styles.badgeText}>Offline</Text>
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
              </View>
            )}
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw size={16} color="#3B82F6" />
            <Text style={styles.badgeTextSyncing}>Syncing...</Text>
          </>
        ) : (
          <>
            <Cloud size={16} color="#22C55E" />
            <Text style={styles.badgeTextSynced}>Synced</Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  // Banner variant (default)
  return (
    <TouchableOpacity
      style={[
        styles.bannerContainer,
        !isOnline && styles.bannerOffline,
        isSyncing && styles.bannerSyncing,
      ]}
      onPress={syncNow}
      activeOpacity={0.8}
    >
      <View style={styles.bannerContent}>
        {!isOnline ? (
          <>
            <WifiOff size={18} color="#FEF3C7" />
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>You're Offline</Text>
              <Text style={styles.bannerSubtitle}>
                {pendingCount > 0
                  ? `${pendingCount} change${pendingCount > 1 ? "s" : ""} will sync when online`
                  : "Changes will sync when you're back online"}
              </Text>
            </View>
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw size={18} color="#BFDBFE" />
            <View style={styles.bannerTextContainer}>
              <Text style={[styles.bannerTitle, styles.bannerTitleSyncing]}>
                Syncing...
              </Text>
              <Text style={[styles.bannerSubtitle, styles.bannerSubtitleSyncing]}>
                Uploading your workout data
              </Text>
            </View>
          </>
        ) : pendingCount > 0 ? (
          <>
            <Cloud size={18} color="#BBF7D0" />
            <View style={styles.bannerTextContainer}>
              <Text style={[styles.bannerTitle, styles.bannerTitlePending]}>
                Pending Sync
              </Text>
              <Text style={[styles.bannerSubtitle, styles.bannerSubtitlePending]}>
                {pendingCount} change{pendingCount > 1 ? "s" : ""} waiting
              </Text>
            </View>
          </>
        ) : null}
      </View>

      {!isOnline && pendingCount > 0 && (
        <View style={styles.pendingCount}>
          <Text style={styles.pendingCountText}>{pendingCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * Compact sync status for headers or toolbars.
 */
export function SyncStatusIndicator() {
  const { isOnline, isSyncing, pendingCount, lastSyncTime } = useOffline();

  const formatLastSync = (date: Date | null): string => {
    if (!date) return "Never";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  };

  return (
    <View style={styles.statusContainer}>
      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            isOnline ? styles.statusDotOnline : styles.statusDotOffline,
          ]}
        />
        <Text style={styles.statusText}>
          {isOnline ? "Connected" : "Offline"}
        </Text>
      </View>

      {isSyncing && (
        <Text style={styles.statusSyncing}>Syncing...</Text>
      )}

      {pendingCount > 0 && (
        <Text style={styles.statusPending}>
          {pendingCount} pending
        </Text>
      )}

      {!isSyncing && isOnline && (
        <Text style={styles.statusLastSync}>
          Last sync: {formatLastSync(lastSyncTime)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Banner styles
  bannerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1E293B",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
  },
  bannerOffline: {
    backgroundColor: "#78350F",
  },
  bannerSyncing: {
    backgroundColor: "#1E3A8A",
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  bannerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  bannerTitle: {
    color: "#FEF3C7",
    fontSize: 14,
    fontWeight: "600",
  },
  bannerTitleSyncing: {
    color: "#BFDBFE",
  },
  bannerTitlePending: {
    color: "#BBF7D0",
  },
  bannerSubtitle: {
    color: "#FDE68A",
    fontSize: 12,
    marginTop: 2,
  },
  bannerSubtitleSyncing: {
    color: "#93C5FD",
  },
  bannerSubtitlePending: {
    color: "#86EFAC",
  },
  pendingCount: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingCountText: {
    color: "#78350F",
    fontSize: 12,
    fontWeight: "700",
  },

  // Badge styles
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "600",
  },
  badgeTextSyncing: {
    color: "#3B82F6",
    fontSize: 12,
    fontWeight: "600",
  },
  badgeTextSynced: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "600",
  },
  pendingBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pendingBadgeText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "700",
  },

  // Minimal styles
  minimalContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  minimalBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 16,
    alignItems: "center",
  },
  minimalBadgeText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "700",
  },

  // Status indicator styles
  statusContainer: {
    gap: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOnline: {
    backgroundColor: "#22C55E",
  },
  statusDotOffline: {
    backgroundColor: "#F59E0B",
  },
  statusText: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "500",
  },
  statusSyncing: {
    color: "#3B82F6",
    fontSize: 12,
  },
  statusPending: {
    color: "#F59E0B",
    fontSize: 12,
  },
  statusLastSync: {
    color: "#64748B",
    fontSize: 12,
  },
});
