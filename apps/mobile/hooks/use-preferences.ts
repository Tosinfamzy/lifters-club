import { useCallback, useMemo } from "react";
import { useAppUser } from "../providers/user-provider";
import { useApi } from "./use-api";
import {
  mergePreferences,
  resolveDisplayPreferences,
  type DisplayPreferences,
} from "../lib/preferences";

/**
 * The user's display preferences (weight unit, week start) with defaults
 * applied, plus a saver that merges changes into the stored preferences.
 */
export function usePreferences() {
  const { appUser, refetch } = useAppUser();
  const api = useApi();

  const preferences = useMemo(
    () => resolveDisplayPreferences(appUser?.preferences),
    [appUser?.preferences]
  );

  const updatePreferences = useCallback(
    async (changes: Partial<DisplayPreferences>) => {
      if (!appUser) return;
      await api.updateUser(appUser.id, {
        preferences: mergePreferences(appUser.preferences, changes),
      });
      await refetch();
    },
    [api, appUser, refetch]
  );

  return { ...preferences, updatePreferences };
}
