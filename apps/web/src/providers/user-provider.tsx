"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { API_BASE_URL } from "@/lib/api";

interface AppUser {
  id: string;
  clerkId: string;
  email: string;
  trainingLevel: "beginner" | "intermediate" | "advanced";
  primaryGoal: "strength" | "hypertrophy" | "conditioning";
  preferences: Record<string, unknown>;
  activeTrainingBlock?: {
    id: string;
    programId: string;
    currentWeek: number;
    status: string;
  };
}

interface UserContextValue {
  appUser: AppUser | null;
  isLoading: boolean;
  needsOnboarding: boolean;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const { getToken } = useAuth();
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);


  const fetchUser = useCallback(async () => {
    if (!user) {
      setAppUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const token = await getToken();

      // If no token, user is not authenticated yet - wait for Clerk to initialize
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAppUser(data.data);
        setNeedsOnboarding(false);
      } else if (response.status === 404) {
        // User doesn't exist in our database — redirect to onboarding
        setNeedsOnboarding(true);
        setAppUser(null);
      }
    } catch {
      // API might be down, don't block the user
      console.error("Failed to fetch user");
    } finally {
      setIsLoading(false);

    }
  }, [user, getToken]);

  useEffect(() => {
    if (isClerkLoaded) {
      fetchUser();
    }
  }, [isClerkLoaded, fetchUser]);


  const refetch = async () => {
    setIsLoading(true);
    await fetchUser();
  };

  return (
    <UserContext.Provider value={{ appUser, isLoading, needsOnboarding, refetch }}>
      {children}
    </UserContext.Provider>
  );
}

export function useAppUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useAppUser must be used within a UserProvider");
  }
  return context;
}
