"use client";
import { useEffect, useState } from "react";
import { getDashboard, getResearchProblems } from "@/lib/api";
import type { DashboardData, ResearchProblem } from "@/types";
import {
  FileText,
  Send,
  Eye,
  ThumbsUp,
  TrendingUp,
  Sparkles,
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
      color: "text-blue-400",
    },
    {
      label: "Published",
      value: dashboard?.total_published ?? 0,
      icon: Send,
      color: "text-green-400",
    },
    {
      label: "Impressions",
      value: dashboard?.total_impressions ?? 0,
      icon: Eye,
      color: "text-purple-400",
    },
    {
      label: "Engagement",
      value: dashboard?.total_engagement ?? 0,
      icon: ThumbsUp,
      color: "text-amber-400",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Overview of your AI marketing engine
          </p>
        </div>
        <Link
          href="/generate"
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Sparkles size={16} />
          Generate Content
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <stat.icon size={20} className={stat.color} />
              <span className="text-sm text-gray-400">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {stat.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Trending Problems */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp size={20} className="text-indigo-400" />
            Trending B2B Problems
          </h2>
          <Link
            href="/research"
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            View all
          </Link>
        </div>
        {problems.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No research data yet. Trigger your first research run from the
            Research page.
          </p>
        ) : (
          <div className="space-y-3">
            {problems.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">
                    {p.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {p.primary_niche} &middot; {p.country} &middot;{" "}
                    {p.source_count} sources
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      p.severity >= 8
                        ? "bg-red-500/10 text-red-400"
                        : p.severity >= 5
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-green-500/10 text-green-400"
                    }`}
                  >
                    Severity {p.severity}/10
                  </span>
                  <Link
                    href={`/generate?problem=${p.id}`}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    Generate
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            href: "/research",
            title: "Run Research",
            desc: "Discover trending B2B problems",
          },
          {
            href: "/templates",
            title: "Manage Templates",
            desc: "Add or edit content types",
          },
          {
            href: "/analytics",
            title: "View Analytics",
            desc: "Track content performance",
          },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-5 hover:border-indigo-500/30 transition-colors"
          >
            <div className="text-sm font-medium text-white">{link.title}</div>
            <div className="text-xs text-gray-500 mt-1">{link.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
