"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setupOrganization } from "@/lib/api";

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSlugify = (name: string) => {
    setOrgName(name);
    setOrgSlug(
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !orgSlug.trim()) return;

    setLoading(true);
    setError("");
    try {
      await setupOrganization({ org_name: orgName, org_slug: orgSlug });
      router.replace("/");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create organization";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-xl bg-gray-800 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Set up your organization</h1>
        <p className="mt-2 text-sm text-gray-400">
          Create your workspace to start generating content.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300">
            Organization name
          </label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => handleSlugify(e.target.value)}
            placeholder="My Company"
            className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">
            URL slug
          </label>
          <input
            type="text"
            value={orgSlug}
            onChange={(e) => setOrgSlug(e.target.value)}
            placeholder="my-company"
            className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Used in URLs. Only lowercase letters, numbers, and hyphens.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 py-2 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create organization"}
        </button>
      </form>
    </div>
  );
}
