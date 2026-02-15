import { useAppUser } from "@/providers/user-provider";
import type { WeightUnit } from "@gymapp/types";

export function useWeightUnit(): WeightUnit {
  const { appUser } = useAppUser();
  return (appUser?.preferences?.weightUnit as WeightUnit) || "lbs";
}
