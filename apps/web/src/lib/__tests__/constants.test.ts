import { describe, it, expect } from "vitest";
import { formatWeight, fromLbs, toLbs, getWeightStep } from "../constants";

describe("weight conversion utilities", () => {
  describe("fromLbs", () => {
    it("returns lbs unchanged when display unit is lbs", () => {
      expect(fromLbs(135, "lbs")).toBe(135);
    });

    it("converts lbs to kg", () => {
      expect(fromLbs(220, "kg")).toBeCloseTo(99.79, 1);
    });

    it("handles zero", () => {
      expect(fromLbs(0, "kg")).toBe(0);
    });
  });

  describe("toLbs", () => {
    it("returns lbs unchanged when input unit is lbs", () => {
      expect(toLbs(135, "lbs")).toBe(135);
    });

    it("converts kg to lbs", () => {
      expect(toLbs(100, "kg")).toBeCloseTo(220.46, 1);
    });

    it("handles zero", () => {
      expect(toLbs(0, "kg")).toBe(0);
    });
  });

  describe("round-trip conversion", () => {
    it("preserves value through lbs -> kg -> lbs", () => {
      const original = 225;
      const asKg = fromLbs(original, "kg");
      const backToLbs = toLbs(asKg, "kg");
      expect(backToLbs).toBeCloseTo(original, 5);
    });
  });

  describe("formatWeight", () => {
    it("formats lbs as whole number with unit", () => {
      expect(formatWeight(135, "lbs")).toBe("135 lbs");
    });

    it("formats kg to one decimal with unit", () => {
      expect(formatWeight(220, "kg")).toBe("99.8 kg");
    });

    it("converts from non-default stored unit", () => {
      expect(formatWeight(100, "lbs", "kg")).toBe("220 lbs");
    });

    it("returns same value when stored and display unit match", () => {
      expect(formatWeight(100, "kg", "kg")).toBe("100.0 kg");
    });
  });

  describe("getWeightStep", () => {
    it("returns 2.5 for lbs", () => {
      expect(getWeightStep("lbs")).toBe(2.5);
    });

    it("returns 0.5 for kg", () => {
      expect(getWeightStep("kg")).toBe(0.5);
    });
  });
});
