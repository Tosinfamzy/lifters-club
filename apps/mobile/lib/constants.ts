// Centralized constants for the mobile app

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const FETCH_TIMEOUT_MS = 30_000;
export const SYNC_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export const RPE_SCALE = { min: 1, max: 10 } as const;

// Theme colors (dark mode slate palette)
export const COLORS = {
  background: "#0F172A",
  surface: "#1E293B",
  surfaceLight: "#334155",
  primary: "#3B82F6",
  primaryLight: "#60A5FA",
  text: "#F8FAFC",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  border: "#334155",
  danger: "#EF4444",
  success: "#10B981",
  warning: "#F59E0B",
  white: "#FFFFFF",
} as const;

export const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "#10B981",
  intermediate: "#F59E0B",
  advanced: "#EF4444",
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const GOAL_COLORS: Record<string, string> = {
  strength: "#EF4444",
  hypertrophy: "#3B82F6",
  conditioning: "#10B981",
};

export const GOAL_LABELS: Record<string, string> = {
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  conditioning: "Conditioning",
};
