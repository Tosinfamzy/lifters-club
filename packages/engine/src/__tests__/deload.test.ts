import { describe, it, expect } from "vitest";
import { calculateDeloadNeed } from "../deload";
import type { DeloadInput } from "../types";

describe("calculateDeloadNeed", () => {
  it("recommends scheduled deload every 8 weeks", () => {
    const input: DeloadInput = {
      weekNumber: 8,
      recentWeeklyRpe: [7, 7.5, 7],
      missedSessions: 0,
      consecutiveHardWeeks: 2,
    };

    const result = calculateDeloadNeed(input);

    expect(result.recommended).toBe(true);
    expect(result.reason).toContain("scheduled deload");
  });

  it("recommends deload after too many consecutive hard weeks", () => {
    const input: DeloadInput = {
      weekNumber: 5,
      recentWeeklyRpe: [8, 8.5, 8.5, 9],
      missedSessions: 0,
      consecutiveHardWeeks: 4,
    };

    const result = calculateDeloadNeed(input);

    expect(result.recommended).toBe(true);
    expect(result.reason).toContain("consecutive high-fatigue weeks");
  });

  it("recommends deload when average RPE is too high", () => {
    const input: DeloadInput = {
      weekNumber: 3,
      recentWeeklyRpe: [9, 9.5],
      missedSessions: 0,
      consecutiveHardWeeks: 2,
    };

    const result = calculateDeloadNeed(input);

    expect(result.recommended).toBe(true);
    expect(result.reason).toContain("Average RPE");
  });

  it("recommends deload when multiple sessions are missed", () => {
    const input: DeloadInput = {
      weekNumber: 4,
      recentWeeklyRpe: [7, 7],
      missedSessions: 2,
      consecutiveHardWeeks: 0,
    };

    const result = calculateDeloadNeed(input);

    expect(result.recommended).toBe(true);
    expect(result.reason).toContain("missed sessions");
  });

  it("does not recommend deload when training is sustainable", () => {
    const input: DeloadInput = {
      weekNumber: 3,
      recentWeeklyRpe: [7, 7.5, 7],
      missedSessions: 0,
      consecutiveHardWeeks: 1,
    };

    const result = calculateDeloadNeed(input);

    expect(result.recommended).toBe(false);
    expect(result.reason).toContain("sustainable");
  });

  it("does not recommend deload with insufficient data", () => {
    const input: DeloadInput = {
      weekNumber: 1,
      recentWeeklyRpe: [7], // Only 1 week of data
      missedSessions: 0,
      consecutiveHardWeeks: 0,
    };

    const result = calculateDeloadNeed(input);

    expect(result.recommended).toBe(false);
  });

  it("triggers at week 16 for scheduled deload", () => {
    const input: DeloadInput = {
      weekNumber: 16,
      recentWeeklyRpe: [7, 7],
      missedSessions: 0,
      consecutiveHardWeeks: 2,
    };

    const result = calculateDeloadNeed(input);

    expect(result.recommended).toBe(true);
    expect(result.reason).toContain("Week 16");
  });
});
