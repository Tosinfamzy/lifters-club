import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
  },
  loadingText: {
    color: "#94A3B8",
    marginTop: 12,
  },
  // Rest Timer Overlay
  restOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  restCard: {
    backgroundColor: "#1E293B",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "80%",
  },
  restTitle: {
    color: "#94A3B8",
    fontSize: 16,
    marginTop: 8,
  },
  restTime: {
    color: "#F8FAFC",
    fontSize: 64,
    fontWeight: "700",
    marginVertical: 16,
  },
  restProgress: {
    width: "100%",
    height: 6,
    backgroundColor: "#334155",
    borderRadius: 3,
    marginBottom: 24,
  },
  restProgressFill: {
    height: 6,
    backgroundColor: "#3B82F6",
    borderRadius: 3,
  },
  restActions: {
    flexDirection: "row",
    gap: 12,
  },
  restActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#334155",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  skipButton: {
    backgroundColor: "#475569",
  },
  restActionText: {
    color: "#F8FAFC",
    fontWeight: "600",
  },
  // Progress Header
  progressHeader: {
    padding: 16,
    backgroundColor: "#1E293B",
  },
  progressText: {
    color: "#F8FAFC",
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#334155",
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: "#3B82F6",
    borderRadius: 2,
  },
  // Tabs
  tabsContainer: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#334155",
    minWidth: 80,
  },
  tabActive: {
    backgroundColor: "#3B82F6",
  },
  tabCompleted: {
    backgroundColor: "#166534",
  },
  tabText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  tabProgress: {
    color: "#64748B",
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
  },
  // Content
  content: {
    flex: 1,
    padding: 16,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  exerciseTitleContainer: {
    flex: 1,
  },
  exerciseTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  exerciseTitle: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  exerciseTarget: {
    color: "#3B82F6",
    fontSize: 14,
  },
  swapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  swapButtonText: {
    color: "#3B82F6",
    fontSize: 14,
    fontWeight: "600",
  },
  // Substitution Modal
  substituteCard: {
    backgroundColor: "#1E293B",
    borderRadius: 24,
    padding: 24,
    width: "90%",
    maxHeight: "70%",
  },
  substituteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  substituteTitle: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "700",
  },
  closeButton: {
    padding: 4,
  },
  substituteSubtitle: {
    color: "#94A3B8",
    fontSize: 14,
    marginBottom: 20,
  },
  substituteLoader: {
    marginVertical: 40,
  },
  noSubstitutes: {
    color: "#64748B",
    textAlign: "center",
    marginVertical: 40,
  },
  substituteList: {
    maxHeight: 300,
  },
  substituteItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#334155",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  substituteInfo: {
    flex: 1,
  },
  substituteName: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
  },
  substituteMatch: {
    color: "#10B981",
    fontSize: 12,
    marginTop: 2,
  },
  substituteEquipment: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
    textTransform: "capitalize",
  },
  lastPerformance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  lastPerformanceText: {
    color: "#10B981",
    fontSize: 13,
  },
  // Set Card
  setCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  setCardCompleted: {
    opacity: 0.6,
  },
  setHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  setNumber: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
  },
  completedBadge: {
    backgroundColor: "#22C55E",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  inputsRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputGroupSmall: {
    flex: 0.6,
  },
  inputLabel: {
    color: "#94A3B8",
    fontSize: 12,
    marginBottom: 6,
  },
  inputWithButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  inputButton: {
    width: 32,
    height: 44,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#334155",
    borderRadius: 8,
    padding: 12,
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginHorizontal: 4,
  },
  inputSmall: {
    marginHorizontal: 0,
  },
  completeSetButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  completeSetText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  // Bottom Actions
  bottomActions: {
    marginTop: 12,
  },
  nextButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  finishButton: {
    backgroundColor: "#22C55E",
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  bottomPadding: {
    height: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Readiness Check-in
  readinessContainer: {
    flex: 1,
    backgroundColor: "#0F172A",
    padding: 24,
  },
  readinessTitle: {
    color: "#F8FAFC",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 40,
    marginBottom: 8,
  },
  readinessSubtitle: {
    color: "#94A3B8",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
  },
  readinessSlider: {
    marginBottom: 28,
  },
  readinessLabel: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  readinessButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  readinessButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  readinessButtonText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  readinessButtonTextActive: {
    color: "#FFFFFF",
  },
  readinessLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  readinessLabelSmall: {
    color: "#64748B",
    fontSize: 12,
  },
  readinessProceedButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  readinessProceedText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  readinessSkipButton: {
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  readinessSkipText: {
    color: "#64748B",
    fontSize: 14,
  },
  readinessScoreCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginVertical: 24,
  },
  readinessScore: {
    fontSize: 64,
    fontWeight: "700",
  },
  readinessRecommendation: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 8,
  },
  readinessAdjustments: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  readinessAdjustmentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  readinessAdjustmentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  readinessAdjustmentText: {
    color: "#F8FAFC",
    fontSize: 14,
  },
  // Load Recommendation Modal
  recommendationCard: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 24,
    width: "90%",
    alignItems: "center",
  },
  recommendationHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  recommendationIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  recommendationIconIncrease: {
    backgroundColor: "#22C55E",
  },
  recommendationIconDecrease: {
    backgroundColor: "#EF4444",
  },
  recommendationIconMaintain: {
    backgroundColor: "#3B82F6",
  },
  recommendationTitle: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  recommendationExercise: {
    color: "#94A3B8",
    fontSize: 14,
    marginBottom: 20,
  },
  recommendationWeight: {
    backgroundColor: "#334155",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  recommendationWeightLabel: {
    color: "#94A3B8",
    fontSize: 12,
    marginBottom: 4,
  },
  recommendationWeightValue: {
    color: "#F8FAFC",
    fontSize: 32,
    fontWeight: "700",
  },
  recommendationReason: {
    color: "#94A3B8",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  recommendationButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    alignItems: "center",
  },
  recommendationButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  celebrationOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  celebrationCard: {
    backgroundColor: "#1E293B",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    maxWidth: 320,
    width: "90%",
  },
  celebrationTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 8,
    textAlign: "center",
  },
  celebrationSubtitle: {
    fontSize: 16,
    color: "#94A3B8",
    marginBottom: 24,
    textAlign: "center",
  },
  undoButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  undoButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  undoTimer: {
    color: "#64748B",
    fontSize: 14,
  },
});
