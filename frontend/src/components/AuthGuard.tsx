"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { checkOnboardingStatus } from "@/lib/api";

type AuthState = "checking" | "onboarded" | "redirecting";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [authState, setAuthState] = useState<AuthState>("checking");

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (authState !== "checking") return;

    let cancelled = false;

    checkOnboardingStatus()
      .then((res) => {
        if (cancelled) return;
        const data = res.data as { onboarded: boolean };
        if (data.onboarded) {
          setAuthState("onboarded");
        } else {
          setAuthState("redirecting");
          if (pathname !== "/onboarding") {
            router.replace("/onboarding");
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAuthState("redirecting");
        if (pathname !== "/onboarding") {
          router.replace("/onboarding");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, loading, authState, router, pathname]);

  if (loading || (user && authState === "checking")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  // Only render children when onboarding is confirmed
  if (authState !== "onboarded") return null;

  return <>{children}</>;
}
