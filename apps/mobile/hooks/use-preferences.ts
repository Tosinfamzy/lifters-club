import { useCallback, useEffect, useMemo, useRef } from "react";
import type { WeightUnit } from "@gymapp/types";
import { useAppUser } from "../providers/user-provider";
import { useApi } from "./use-api";
import {
  mergePreferences,
  resolveDisplayPreferences,
  type DisplayPreferences,
} from "../lib/preferences";

/** The user's weight unit with the default applied. Read-only and API-free. */
export function useWeightUnit(): WeightUnit {
  const { appUser } = useAppUser();
  return resolveDisplayPreferences(appUser?.preferences).weightUnit;
}

/**
 * The user's display preferences (weight unit, week start) with defaults
 * applied, plus a saver that merges changes into the stored preferences.
 *
 * PATCH /users/:id replaces the whole preferences object, so saves run one at a
 * time and each merges onto the result of the previous one. Otherwise two quick
 * changes would each send stale preferences and the later would undo the earlier.
 */
export function usePreferences() {
  const { appUser, refetch } = useAppUser();
  const api = useApi();

  // Latest known stored preferences, ahead of appUser while saves are in flight
  const latestRef = useRef(appUser?.preferences);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const inFlightRef = useRef(0);

  useEffect(() => {
    // A refetch that lands mid-queue may predate the queued saves; ignore it
    if (inFlightRef.current === 0) latestRef.current = appUser?.preferences;
  }, [appUser?.preferences]);

  const preferences = useMemo(
    () => resolveDisplayPreferences(appUser?.preferences),
    [appUser?.preferences]
  );

  const updatePreferences = useCallback(
    async (changes: Partial<DisplayPreferences>) => {
      if (!appUser) {
        throw new Error("Cannot save preferences before the user has loaded");
      }

      const save = async () => {
        const merged = mergePreferences(latestRef.current, changes);
        const response = await api.updateUser(appUser.id, { preferences: merged });
        latestRef.current = response.data?.preferences ?? merged;
      };

      inFlightRef.current += 1;
      // Chain after the previous save whether it succeeded or failed
      const result = queueRef.current.then(save, save);
      queueRef.current = result.catch(() => undefined);

      try {
        await result;
      } finally {
        inFlightRef.current -= 1;
        // Refetch once the queue drains, so the UI never shows an intermediate state
        if (inFlightRef.current === 0) await refetch();
      }
    },
    [api, appUser, refetch]
  );

  return { ...preferences, updatePreferences };
}
