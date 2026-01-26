import { describe, it, expect } from "vitest";
import { calculateMissedSessionHandling } from "../missed-session";
import type { MissedSessionInput } from "../missed-session";

describe("calculateMissedSessionHandling", () => {
  it("resumes normally after recent schedule conflict", () => {
    const input: MissedSessionInput = {
      daysSinceMissed: 1,
      reason: "schedule_conflict",
      missedThisWeek: 1,
      consecutiveMissed: 1,
      weekNumber: 4,
      totalWeeks: 12,
      wasKeySession: false,
    };

    const result = calculateMissedSessionHandling(input);

    expect(result.action).toBe("resume");
    expect(result.intensityAdjustment).toBe(1.0);
    expect(result.extendProgram).toBe(false);
  });

  it("handles illness with caution for short absence", () => {
    const input: MissedSessionInput = {
      daysSinceMissed: 3,
      reason: "illness",
      missedThisWeek: 1,
      consecutiveMissed: 1,
      weekNumber: 6,
      totalWeeks: 12,
      wasKeySession: false,
    };

    const result = calculateMissedSessionHandling(input);

    expect(result.action).toBe("resume");
    expect(result.intensityAdjustment).toBeLessThan(1.0);
    expect(result.reason).toContain("illness");
  });

  it("repeats session after moderate illness absence", () => {
    const input: MissedSessionInput = {
      daysSinceMissed: 5,
      reason: "illness",
      missedThisWeek: 2,
      consecutiveMissed: 2,
      weekNumber: 6,
      totalWeeks: 12,
      wasKeySession: false,
    };

    const result = calculateMissedSessionHandling(input);

    expect(result.action).toBe("repeat");
    expect(result.intensityAdjustment).toBe(0.8);
  });

  it("regresses and extends after long illness", () => {
    const input: MissedSessionInput = {
      daysSinceMissed: 10,
      reason: "illness",
      missedThisWeek: 3,
      consecutiveMissed: 3,
      weekNumber: 6,
      totalWeeks: 12,
      wasKeySession: false,
    };

    const result = calculateMissedSessionHandling(input);

    expect(result.action).toBe("regress");
    expect(result.extendProgram).toBe(true);
  });

  it("adjusts for fatigue-related miss", () => {
    const input: MissedSessionInput = {
      daysSinceMissed: 1,
      reason: "fatigue",
      missedThisWeek: 1,
      consecutiveMissed: 1,
      weekNumber: 5,
      totalWeeks: 12,
      wasKeySession: false,
    };

    const result = calculateMissedSessionHandling(input);

    expect(result.action).toBe("skip_and_adjust");
    expect(result.intensityAdjustment).toBe(0.85);
    expect(result.reason).toContain("fatigue");
  });

  it("repeats key session if missed recently", () => {
    const input: MissedSessionInput = {
      daysSinceMissed: 2,
      reason: "schedule_conflict",
      missedThisWeek: 1,
      consecutiveMissed: 1,
      weekNumber: 4,
      totalWeeks: 12,
      wasKeySession: true,
    };

    const result = calculateMissedSessionHandling(input);

    expect(result.action).toBe("repeat");
    expect(result.reason).toContain("Key session");
  });

  it("consolidates sessions when multiple missed in week", () => {
    const input: MissedSessionInput = {
      daysSinceMissed: 3,
      reason: "travel",
      missedThisWeek: 2,
      consecutiveMissed: 2,
      weekNumber: 8,
      totalWeeks: 12,
      wasKeySession: false,
    };

    const result = calculateMissedSessionHandling(input);

    expect(result.action).toBe("skip_and_adjust");
    expect(result.reason).toContain("missed this week");
  });

  it("regresses after too many consecutive misses", () => {
    const input: MissedSessionInput = {
      daysSinceMissed: 5,
      reason: "motivation",
      missedThisWeek: 3,
      consecutiveMissed: 3,
      weekNumber: 6,
      totalWeeks: 12,
      wasKeySession: false,
    };

    const result = calculateMissedSessionHandling(input);

    expect(result.action).toBe("regress");
    expect(result.extendProgram).toBe(true);
  });

  it("does not extend program near end", () => {
    const input: MissedSessionInput = {
      daysSinceMissed: 5,
      reason: "travel",
      missedThisWeek: 3,
      consecutiveMissed: 3,
      weekNumber: 11,
      totalWeeks: 12,
      wasKeySession: false,
    };

    const result = calculateMissedSessionHandling(input);

    expect(result.action).toBe("regress");
    expect(result.extendProgram).toBe(false);
    expect(result.reason).toContain("finish strong");
  });

  it("handles injury same as illness", () => {
    const input: MissedSessionInput = {
      daysSinceMissed: 4,
      reason: "injury",
      missedThisWeek: 2,
      consecutiveMissed: 2,
      weekNumber: 5,
      totalWeeks: 12,
      wasKeySession: false,
    };

    const result = calculateMissedSessionHandling(input);

    expect(result.action).toBe("repeat");
    expect(result.reason).toContain("injury");
  });
});
