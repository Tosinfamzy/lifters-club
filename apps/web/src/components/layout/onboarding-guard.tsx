"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppUser } from "@/providers/user-provider";

/**
 * Redirects users to /onboarding when they haven't completed profile setup.
 * Skips redirect if the user is already on the onboarding page.
 */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { needsOnboarding, isLoading } = useAppUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && needsOnboarding && pathname !== "/onboarding") {
      router.push("/onboarding");
    }
  }, [needsOnboarding, isLoading, pathname, router]);

  // While loading, render children (the loading states handle skeleton UI)
  // If needs onboarding and not on onboarding page, still render children
  // briefly until the redirect fires
  return <>{children}</>;
}
