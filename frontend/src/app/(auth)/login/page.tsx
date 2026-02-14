"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Input, Button, Alert } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      router.replace("/");
    }
  };

  return (
    <>
      {/* Brand mark — visible on mobile, hidden on desktop (layout has it) */}
      <div className="mb-10 lg:hidden">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-white">Siete</span>
          <span className="text-indigo-400">Engine</span>
        </h1>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white tracking-tight">
          Welcome back
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          Sign in to your account to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@company.com"
          autoComplete="email"
        />

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Enter your password"
          autoComplete="current-password"
        />

        <Button
          type="submit"
          loading={loading}
          className="w-full"
          size="lg"
        >
          Sign In
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
        <p className="text-center text-xs text-zinc-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Create one
          </Link>
        </p>
      </div>
    </>
  );
}
