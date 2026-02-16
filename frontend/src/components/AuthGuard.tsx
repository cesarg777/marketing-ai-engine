"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { checkOnboardingStatus } from "@/lib/api";

type AuthState = "checking" | "onboarded" | "redirecting" | "error";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [retryCount, setRetryCount] = useState(0);

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
      .catch((err) => {
        if (cancelled) return;
        // Don't redirect to onboarding on network/server errors — the user may already be onboarded.
        // 401 is handled by the axios interceptor (redirects to login).
        // Only redirect to onboarding on 404 (endpoint not found = genuinely not onboarded).
        const status = err?.response?.status;
        if (status === 404) {
          setAuthState("redirecting");
          if (pathname !== "/onboarding") {
            router.replace("/onboarding");
          }
        } else {
          // Network or server error — show retry UI instead of wrong redirect
          setAuthState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, loading, authState, router, pathname, retryCount]);

  if (loading || (user && authState === "checking")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  // Show retry UI on network/server errors instead of wrong onboarding redirect
  if (authState === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)]">
        <div className="text-center max-w-sm">
          <p className="text-sm text-zinc-400 mb-4">
            Could not verify your account. Please check your connection and try again.
          </p>
          <button
            onClick={() => {
              setAuthState("checking");
              setRetryCount((c) => c + 1);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Only render children when onboarding is confirmed
  if (authState !== "onboarded") return null;

  return <>{children}</>;
}
