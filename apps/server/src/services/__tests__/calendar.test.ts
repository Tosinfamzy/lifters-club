import { describe, it, expect } from "vitest";
import { countDaysInclusive, enumerateDates, isValidTimeZone, resolveSessionName } from "../calendar";

describe("enumerateDates", () => {
  it("lists every date inclusively across a month boundary", () => {
    expect(enumerateDates("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("returns a single date when from equals to", () => {
    expect(enumerateDates("2026-01-05", "2026-01-05")).toEqual(["2026-01-05"]);
  });
});

describe("countDaysInclusive", () => {
  it("counts both endpoints", () => {
    expect(countDaysInclusive("2026-01-01", "2026-03-03")).toBe(62);
    expect(countDaysInclusive("2026-01-01", "2026-01-01")).toBe(1);
  });
});

describe("resolveSessionName", () => {
  const template = {
    sessions: [
      { dayNumber: 1, name: "Push Day 1" },
      { dayNumber: 2, name: "" },
    ],
  };

  it("returns the template session name matching the day number", () => {
    expect(resolveSessionName(template, 1)).toBe("Push Day 1");
  });

  it("falls back to Day N when the session is missing or unnamed", () => {
    expect(resolveSessionName(template, 2)).toBe("Day 2");
    expect(resolveSessionName(template, 4)).toBe("Day 4");
  });

  it("falls back when the template has no sessions array", () => {
    expect(resolveSessionName({}, 3)).toBe("Day 3");
  });
});

describe("isValidTimeZone", () => {
  it.each(["UTC", "Europe/Berlin", "America/New_York", "Asia/Kolkata", "Europe/Kyiv", "Etc/GMT+5"])(
    "accepts %s",
    (tz) => {
      expect(isValidTimeZone(tz)).toBe(true);
    }
  );

  it.each(["", "Mars/Olympus", "+05:00", "UTC+5", "Europe/Berlin; drop", "../etc/passwd"])("rejects %s", (tz) => {
    expect(isValidTimeZone(tz)).toBe(false);
  });
});
