"use client";
import { useEffect, useState } from "react";
import { getDashboard } from "@/lib/api";
import type { DashboardData } from "@/types";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import {
  BarChart3,
  TrendingUp,
  FileText,
  Send,
  Eye,
  ThumbsUp,
} from "lucide-react";

export default function AnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    getDashboard().then((r) => setData(r.data)).catch(() => {});
  }, []);

  const stats = [
    {
      label: "Total Content",
      value: data?.total_content ?? 0,
      icon: FileText,
      accent: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Published",
      value: data?.total_published ?? 0,
      icon: Send,
      accent: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Impressions",
      value: data?.total_impressions ?? 0,
      icon: Eye,
      accent: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "Engagement",
      value: data?.total_engagement ?? 0,
      icon: ThumbsUp,
      accent: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  const hasData =
    (data?.top_content?.length ?? 0) > 0 ||
    Object.keys(data?.content_by_type || {}).length > 0;

  return (
    <div>
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        subtitle="Track content performance and engagement"
      />

      {/* Summary Stats */}
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

      {/* Content by Type */}
      {data?.content_by_type &&
        Object.keys(data.content_by_type).length > 0 && (
          <Card padding="lg" className="mb-8">
            <h2 className="text-sm font-semibold text-white mb-5">
              Content by Type
            </h2>
            <div className="space-y-3">
              {Object.entries(data.content_by_type).map(([type, count]) => {
                const pct = Math.min(
                  (count / data.total_content) * 100,
                  100
                );
                return (
                  <div key={type} className="flex items-center gap-4">
                    <span className="text-xs text-zinc-400 capitalize w-28 shrink-0 truncate">
                      {type.replace(/_/g, " ")}
                    </span>
                    <div className="flex-1 bg-zinc-800/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 rounded-full h-1.5 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-zinc-500 w-6 text-right shrink-0">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

      {/* Top Content */}
      {data?.top_content && data.top_content.length > 0 && (
        <Card padding="lg">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="rounded-lg bg-emerald-500/10 p-1.5">
              <TrendingUp
                size={16}
                className="text-emerald-400"
                strokeWidth={1.8}
              />
            </div>
            <h2 className="text-sm font-semibold text-white">
              Top Performing Content
            </h2>
          </div>
          <div className="space-y-2">
            {data.top_content.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-zinc-900/40 border border-[var(--border-subtle)] rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-bold text-zinc-600 w-5 shrink-0 text-center">
                    {i + 1}
                  </span>
                  <span className="text-sm text-zinc-200 truncate">
                    {item.title}
                  </span>
                </div>
                <span className="text-xs font-mono text-amber-400 shrink-0 ml-4">
                  {item.engagement}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!hasData && (
        <EmptyState
          icon={BarChart3}
          title="No analytics data yet"
          description="Generate and publish content to start tracking performance"
        />
      )}
    </div>
  );
}
