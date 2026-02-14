"use client";
import { useEffect, useState } from "react";
import { getDashboard } from "@/lib/api";
import type { DashboardData } from "@/types";
import { BarChart3, TrendingUp } from "lucide-react";

export default function AnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    getDashboard().then((r) => setData(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 size={24} className="text-indigo-400" />
          Analytics
        </h1>
        <p className="text-gray-400 mt-1">
          Track content performance and get AI-powered insights
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
          <div className="text-sm text-gray-400 mb-1">Total Content</div>
          <div className="text-2xl font-bold text-white">
            {data?.total_content ?? 0}
          </div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
          <div className="text-sm text-gray-400 mb-1">Published</div>
          <div className="text-2xl font-bold text-green-400">
            {data?.total_published ?? 0}
          </div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
          <div className="text-sm text-gray-400 mb-1">Total Impressions</div>
          <div className="text-2xl font-bold text-purple-400">
            {(data?.total_impressions ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
          <div className="text-sm text-gray-400 mb-1">Total Engagement</div>
          <div className="text-2xl font-bold text-amber-400">
            {(data?.total_engagement ?? 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Content by Type */}
      {data?.content_by_type &&
        Object.keys(data.content_by_type).length > 0 && (
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              Content by Type
            </h2>
            <div className="space-y-3">
              {Object.entries(data.content_by_type).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300 capitalize">
                    {type.replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-40 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-indigo-500 rounded-full h-2"
                        style={{
                          width: `${Math.min((count / data.total_content) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-mono text-gray-400 w-8 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Top Content */}
      {data?.top_content && data.top_content.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-green-400" />
            Top Performing Content
          </h2>
          <div className="space-y-3">
            {data.top_content.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-500 w-6">
                    #{i + 1}
                  </span>
                  <span className="text-sm text-white">{item.title}</span>
                </div>
                <span className="text-sm font-mono text-amber-400">
                  {item.engagement} eng.
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data?.top_content?.length &&
        !Object.keys(data?.content_by_type || {}).length && (
          <div className="text-center py-16 text-gray-500">
            <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No analytics data yet</p>
            <p className="text-sm mt-1">
              Generate and publish content to start tracking performance
            </p>
          </div>
        )}
    </div>
  );
}
