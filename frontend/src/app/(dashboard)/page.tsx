"use client";
import { useEffect, useState } from "react";
import { getDashboard, getResearchProblems } from "@/lib/api";
import type { DashboardData, ResearchProblem } from "@/types";
import { Card, Badge, PageHeader, Button, EmptyState } from "@/components/ui";
import {
  FileText,
  Send,
  Eye,
  ThumbsUp,
  TrendingUp,
  Sparkles,
  Search,
  LayoutTemplate,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [problems, setProblems] = useState<ResearchProblem[]>([]);

  useEffect(() => {
    getDashboard().then((r) => setDashboard(r.data)).catch(() => {});
    getResearchProblems({ limit: 3 })
      .then((r) => setProblems(r.data))
      .catch(() => {});
  }, []);

  const stats = [
    {
      label: "Total Content",
      value: dashboard?.total_content ?? 0,
      icon: FileText,
      accent: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Published",
      value: dashboard?.total_published ?? 0,
      icon: Send,
      accent: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Impressions",
      value: dashboard?.total_impressions ?? 0,
      icon: Eye,
      accent: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "Engagement",
      value: dashboard?.total_engagement ?? 0,
      icon: ThumbsUp,
      accent: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  const quickLinks = [
    {
      href: "/research",
      icon: Search,
      title: "Run Research",
      desc: "Discover trending problems",
    },
    {
      href: "/templates",
      icon: LayoutTemplate,
      title: "Manage Templates",
      desc: "Add or edit content types",
    },
    {
      href: "/analytics",
      icon: BarChart3,
      title: "View Analytics",
      desc: "Track content performance",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your AI marketing engine"
        actions={
          <Link href="/generate">
            <Button icon={<Sparkles size={16} />}>Generate Content</Button>
          </Link>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label} padding="md">
            <div className="flex items-center gap-3 mb-3">
              <div className={`rounded-lg p-2 ${stat.bg}`}>
                <stat.icon size={16} className={stat.accent} strokeWidth={1.8} />
              </div>
              <span className="text-xs text-zinc-500 font-medium tracking-wide">
                {stat.label}
              </span>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {stat.value.toLocaleString()}
            </div>
          </Card>
        ))}
      </div>

      {/* Trending Problems */}
      <Card padding="lg" className="mb-8">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-[var(--accent-muted)] p-1.5">
              <TrendingUp size={16} className="text-indigo-400" strokeWidth={1.8} />
            </div>
            <h2 className="text-sm font-semibold text-white">
              Trending Problems
            </h2>
          </div>
          <Link
            href="/research"
            className="text-xs text-zinc-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
          >
            View all
            <ArrowRight size={12} />
          </Link>
        </div>
        {problems.length === 0 ? (
          <p className="text-zinc-600 text-sm py-4">
            No research data yet. Trigger your first research run from the
            Research page.
          </p>
        ) : (
          <div className="space-y-2">
            {problems.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-zinc-900/40 border border-[var(--border-subtle)] rounded-lg hover:border-[var(--border-hover)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-200 truncate">
                    {p.title}
                  </div>
                  <div className="text-xs text-zinc-600 mt-0.5">
                    {p.primary_niche} &middot; {p.country} &middot;{" "}
                    {p.source_count} sources
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <Badge
                    variant={
                      p.severity >= 8
                        ? "danger"
                        : p.severity >= 5
                          ? "warning"
                          : "success"
                    }
                    size="sm"
                  >
                    {p.severity}/10
                  </Badge>
                  <Link
                    href={`/generate?problem=${p.id}`}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Generate
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card hover padding="md" className="group h-full">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-zinc-800/80 border border-[var(--border-subtle)] p-2 group-hover:border-indigo-500/30 group-hover:bg-[var(--accent-muted)] transition-all duration-200">
                  <link.icon
                    size={16}
                    className="text-zinc-500 group-hover:text-indigo-400 transition-colors duration-200"
                    strokeWidth={1.8}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
                    {link.title}
                  </div>
                  <div className="text-xs text-zinc-600 mt-0.5">
                    {link.desc}
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
