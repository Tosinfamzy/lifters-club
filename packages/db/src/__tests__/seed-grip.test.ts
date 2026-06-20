import { describe, it, expect } from "vitest";
import type { Grip } from "@gymapp/types";
import { exerciseSeedData } from "../seed";

/**
 * Pure seed-classification guard (no DB). Keeps the seed's grip tags valid and
 * in lockstep with the `Grip` union and the 0007 backfill migration.
 */

const VALID_GRIPS: Grip[] = ["pronated", "supinated", "neutral", "mixed", "none"];

function gripOf(id: string): Grip | null | undefined {
  return exerciseSeedData.find((e) => e.id === id)?.grip as Grip | null | undefined;
}

describe("seed grip classification", () => {
  it("tags every non-null grip with a value in the Grip union", () => {
    for (const exercise of exerciseSeedData) {
      if (exercise.grip != null) {
        expect(VALID_GRIPS).toContain(exercise.grip);
      }
    }
  });

  it.each([
    ["barbell-row", "pronated"],
    ["pull-up", "pronated"],
    ["barbell-curl", "supinated"],
    ["hammer-curl", "neutral"],
  ] as const)("classifies %s as %s", (id, expected) => {
    expect(gripOf(id)).toBe(expected);
  });

  it("leaves lower-body/machine exercises untagged (leg-press)", () => {
    expect(gripOf("leg-press") ?? null).toBeNull();
  });
});
