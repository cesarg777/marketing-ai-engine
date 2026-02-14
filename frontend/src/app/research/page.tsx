"use client";
import { useEffect, useState } from "react";
import {
  getResearchWeeks,
  getResearchProblems,
  triggerResearch,
} from "@/lib/api";
import type { ResearchWeek, ResearchProblem } from "@/types";
import { Search, Play, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";

const NICHES = [
  "all",
  "marketing",
  "tech",
  "hr",
  "consulting",
  "finance",
  "healthcare",
  "legal",
  "saas",
];

export default function ResearchPage() {
  const [weeks, setWeeks] = useState<ResearchWeek[]>([]);
  const [problems, setProblems] = useState<ResearchProblem[]>([]);
  const [selectedNiche, setSelectedNiche] = useState("all");
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getResearchWeeks(), getResearchProblems()])
      .then(([w, p]) => {
        setWeeks(w.data);
        setProblems(p.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params: Record<string, string | number> =
      selectedNiche !== "all" ? { niche: selectedNiche } : {};
    getResearchProblems(params).then((r) => setProblems(r.data));
  }, [selectedNiche]);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await triggerResearch();
      alert("Research pipeline queued! Check back in a few minutes.");
    } catch {
      alert("Failed to trigger research.");
    }
    setTriggering(false);
  };

  const trendIcon = (dir: string) => {
    if (dir === "rising")
      return <TrendingUp size={14} className="text-green-400" />;
    if (dir === "declining")
      return <TrendingDown size={14} className="text-red-400" />;
    return <Minus size={14} className="text-gray-500" />;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Search size={24} className="text-indigo-400" />
            Research Hub
          </h1>
          <p className="text-gray-400 mt-1">
            B2B pain points discovered by AI, updated weekly
          </p>
        </div>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Play size={16} />
          {triggering ? "Queuing..." : "Run Research"}
        </button>
      </div>

      {/* Niche Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {NICHES.map((niche) => (
          <button
            key={niche}
            onClick={() => setSelectedNiche(niche)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
              selectedNiche === niche
                ? "bg-indigo-500 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {niche}
          </button>
        ))}
      </div>

      {/* Problems Table */}
      {loading ? (
        <div className="text-gray-500 text-center py-12">
          Loading research data...
        </div>
      ) : problems.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Search size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No research data yet</p>
          <p className="text-sm mt-1">
            Click &ldquo;Run Research&rdquo; to discover trending B2B problems
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {problems.map((p) => (
            <div
              key={p.id}
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 hover:border-gray-600/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-sm font-semibold text-white">
                      {p.title}
                    </h3>
                    {trendIcon(p.trending_direction)}
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{p.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="capitalize bg-gray-700/50 px-2 py-0.5 rounded">
                      {p.primary_niche}
                    </span>
                    <span>{p.country}</span>
                    <span>{p.source_count} sources</span>
                    <span>
                      Keywords:{" "}
                      {p.keywords.slice(0, 3).join(", ")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      p.severity >= 8
                        ? "bg-red-500/10 text-red-400"
                        : p.severity >= 5
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-green-500/10 text-green-400"
                    }`}
                  >
                    {p.severity}/10
                  </span>
                  <Link
                    href={`/generate?problem=${p.id}`}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    Generate
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
