import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from "react";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter, useSegments } from "expo-router";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

interface TrainingBlock {
  id: string;
  programId: string;
  currentWeek: number;
  status: "active" | "completed" | "paused";
}

interface AppUser {
  id: string;
  clerkId: string;
  email: string;
  trainingLevel: "beginner" | "intermediate" | "advanced";
  primaryGoal: "strength" | "hypertrophy" | "conditioning";
  createdAt: string;
  activeTrainingBlock?: TrainingBlock | null;
}

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
      const response = await fetch(`${API_URL}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Only update if data actually changed (compare by ID)
        setAppUser((prev) => {
          if (prev?.id === data.data?.id &&
              prev?.activeTrainingBlock?.id === data.data?.activeTrainingBlock?.id) {
            return prev; // Return same reference if no change
          }
          return data.data;
        });
      } else if (response.status === 404) {
        setAppUser(null);
      }
    } catch (err) {
      console.error("Failed to fetch user:", err);
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
      router.replace("/onboarding");
    } else if (isSignedIn && appUser && (inAuthGroup || inOnboarding)) {
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
