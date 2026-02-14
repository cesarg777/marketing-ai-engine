"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { checkOnboardingStatus } from "@/lib/api";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Check onboarding status after auth is confirmed
  useEffect(() => {
    if (!loading && user && !onboardingChecked) {
      checkOnboardingStatus()
        .then((res) => {
          const data = res.data as { onboarded: boolean };
          if (!data.onboarded && pathname !== "/onboarding") {
            router.replace("/onboarding");
          }
          setOnboardingChecked(true);
        })
        .catch(() => {
          // If the check fails, allow access (don't block the user)
          setOnboardingChecked(true);
        });
    }
  }, [user, loading, onboardingChecked, router, pathname]);

  if (loading || (!onboardingChecked && user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
