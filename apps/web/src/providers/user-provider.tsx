"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useUser, useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const { getToken } = useAuth();
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);


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

      const response = await fetch(`${API_URL}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAppUser(data.data);
      } else if (response.status === 404) {
        // User doesn't exist in our database — auto-create with defaults
        const createResponse = await fetch(`${API_URL}/api/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: `user-${user.id.slice(0, 8)}`,
            clerkId: user.id,
            email: user.primaryEmailAddress?.emailAddress || "",
            trainingLevel: "intermediate",
            primaryGoal: "hypertrophy",
            preferences: {},
          }),
        });

        if (createResponse.ok) {
          const createData = await createResponse.json();
          setAppUser(createData.data);
        } else {
          console.error("Failed to auto-create user");
          setAppUser(null);
        }
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
    <UserContext.Provider value={{ appUser, isLoading, refetch }}>
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
