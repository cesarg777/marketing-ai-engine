"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setupOrganization } from "@/lib/api";
import { Input, Button, Alert } from "@/components/ui";
import { Building2, ArrowRight } from "lucide-react";

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
    <>
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-semibold">
          1
        </div>
        <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        <div className="flex items-center justify-center w-7 h-7 rounded-full border border-[var(--border-subtle)] text-zinc-600 text-xs">
          2
        </div>
      </div>

      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--accent-muted)] mb-4">
          <Building2 size={20} className="text-indigo-400" strokeWidth={1.8} />
        </div>
        <h2 className="text-lg font-semibold text-white tracking-tight">
          Set up your workspace
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          Almost there! Create your organization to start generating content.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}

        <Input
          label="Organization name"
          type="text"
          value={orgName}
          onChange={(e) => handleSlugify(e.target.value)}
          placeholder="My Company"
          required
        />

        <Input
          label="URL slug"
          type="text"
          value={orgSlug}
          onChange={(e) => setOrgSlug(e.target.value)}
          placeholder="my-company"
          required
          helpText="Lowercase letters, numbers, and hyphens only"
        />

        {orgSlug && (
          <div className="text-xs text-zinc-600 bg-zinc-900/50 border border-[var(--border-subtle)] rounded-lg px-3 py-2">
            Your workspace URL:{" "}
            <span className="text-zinc-400">
              app/<span className="text-indigo-400">{orgSlug}</span>
            </span>
          </div>
        )}

        <Button
          type="submit"
          loading={loading}
          icon={<ArrowRight size={16} />}
          className="w-full"
          size="lg"
        >
          Create Organization
        </Button>
      </form>
    </>
  );
}
