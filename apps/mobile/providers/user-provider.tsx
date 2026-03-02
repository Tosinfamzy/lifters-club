import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from "react";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter, useSegments } from "expo-router";
import { api, ApiRequestError } from "../lib/api";
import type { User, TrainingBlock } from "../lib/api";

type AppUser = User & { activeTrainingBlock?: TrainingBlock | null };

interface UserContextType {
  appUser: AppUser | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  appUser: null,
  isLoading: true,
  refetch: async () => {},
});

export function useAppUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded: authLoaded, getToken } = useAuth();
  const { user } = useUser();
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // Use refs to avoid recreating fetchUser callback
  const getTokenRef = useRef(getToken);
  const userIdRef = useRef(user?.id);
  getTokenRef.current = getToken;
  userIdRef.current = user?.id;

  const fetchUser = useCallback(async () => {
    if (!userIdRef.current) {
      setIsLoading(false);
      return;
    }

    try {
      const token = await getTokenRef.current();
      const response = await api.withToken(token).getCurrentUser();
      const userData = response.data;

      // Only update if data actually changed (compare by ID)
      setAppUser((prev) => {
        if (prev?.id === userData?.id &&
            prev?.activeTrainingBlock?.id === userData?.activeTrainingBlock?.id) {
          return prev; // Return same reference if no change
        }
        return userData;
      });
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) {
        // User not found — new user needs onboarding
        setAppUser(null);
      } else {
        console.error("Failed to fetch user:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty deps - uses refs

  // Only fetch once when auth is ready
  const hasFetched = useRef(false);
  useEffect(() => {
    if (authLoaded && isSignedIn && user && !hasFetched.current) {
      hasFetched.current = true;
      fetchUser();
    } else if (authLoaded && !isSignedIn) {
      setAppUser(null);
      setIsLoading(false);
      hasFetched.current = false;
    }
  }, [authLoaded, isSignedIn, user, fetchUser]);

  useEffect(() => {
    if (!authLoaded || isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)");
    } else if (isSignedIn && !appUser && !inOnboarding) {
      // New user (404 from server) — needs onboarding
      router.replace("/onboarding");
    } else if (isSignedIn && appUser && !appUser.onboardingComplete && !inOnboarding) {
      // Existing user with incomplete onboarding
      router.replace("/onboarding");
    } else if (isSignedIn && appUser && appUser.onboardingComplete && (inAuthGroup || inOnboarding)) {
      router.replace("/(tabs)");
    }
  }, [authLoaded, isSignedIn, appUser, isLoading, segments, router]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ appUser, isLoading, refetch: fetchUser }),
    [appUser, isLoading, fetchUser]
  );

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}
