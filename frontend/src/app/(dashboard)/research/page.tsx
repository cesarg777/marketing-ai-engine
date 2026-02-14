"use client";
import { useEffect, useState } from "react";
import {
  getResearchWeeks,
  getResearchProblems,
  triggerResearch,
} from "@/lib/api";
import type { ResearchWeek, ResearchProblem } from "@/types";
import { Card, Badge, PageHeader, Button, Spinner, EmptyState } from "@/components/ui";
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
      return <TrendingUp size={14} className="text-emerald-400" />;
    if (dir === "declining")
      return <TrendingDown size={14} className="text-red-400" />;
    return <Minus size={14} className="text-zinc-600" />;
  };

  return (
    <div>
      <PageHeader
        icon={Search}
        title="Research Hub"
        subtitle="B2B pain points discovered by AI, updated weekly"
        actions={
          <Button
            onClick={handleTrigger}
            loading={triggering}
            icon={<Play size={14} />}
          >
            Run Research
          </Button>
        }
      />

      {/* Niche Filter */}
      <div className="flex gap-1.5 mb-6 flex-wrap">
        {NICHES.map((niche) => (
          <button
            key={niche}
            onClick={() => setSelectedNiche(niche)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all duration-200 ${
              selectedNiche === niche
                ? "bg-indigo-600 text-white shadow-[var(--shadow-glow)]"
                : "bg-zinc-800/60 text-zinc-500 border border-[var(--border-subtle)] hover:text-zinc-300 hover:border-[var(--border-hover)]"
            }`}
          >
            {niche}
          </button>
        ))}
      </div>

      {/* Problems List */}
      {loading ? (
        <Spinner className="py-16" />
      ) : problems.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No research data yet"
          description='Click "Run Research" to discover trending B2B problems'
        />
      ) : (
        <div className="space-y-3">
          {problems.map((p) => (
            <Card key={p.id} hover padding="md">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-2">
                    <h3 className="text-sm font-semibold text-zinc-200 truncate">
                      {p.title}
                    </h3>
                    {trendIcon(p.trending_direction)}
                  </div>
                  <p className="text-xs text-zinc-500 mb-3 line-clamp-2">
                    {p.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-zinc-600">
                    <Badge variant="default" size="sm">
                      {p.primary_niche}
                    </Badge>
                    <span>{p.country}</span>
                    <span>{p.source_count} sources</span>
                    <span className="hidden sm:inline text-zinc-700">
                      {p.keywords.slice(0, 3).join(", ")}
                    </span>
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
                  >
                    {p.severity}/10
                  </Badge>
                  <Link href={`/generate?problem=${p.id}`}>
                    <Button size="sm">Generate</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
