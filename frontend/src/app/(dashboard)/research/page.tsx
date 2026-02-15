"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  getResearchProblems,
  getResearchConfigs,
  getResearchWeeks,
  createResearchConfig,
  updateResearchConfig,
  deleteResearchConfig,
  runResearchConfig,
  getResearchWeekStatus,
  getICPProfile,
} from "@/lib/api";
import type { ResearchProblem, ResearchConfig } from "@/types";
import {
  Card,
  Badge,
  PageHeader,
  Button,
  Spinner,
  EmptyState,
  Input,
  ProgressOverlay,
} from "@/components/ui";
import {
  Search,
  Play,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Pencil,
  Trash2,
  X,
  Settings2,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

const FALLBACK_NICHES = [
  "marketing", "tech", "hr", "consulting",
  "finance", "healthcare", "legal", "saas",
];
const FALLBACK_COUNTRIES = ["US", "MX", "CO", "BR", "ES", "AR", "CL", "PE"];

type Tab = "configs" | "results";

interface ConfigFormData {
  name: string;
  niches: string[];
  countries: string[];
  decision_makers: string[];
  keywords: string[];
}

const EMPTY_FORM: ConfigFormData = {
  name: "",
  niches: [],
  countries: [],
  decision_makers: [],
  keywords: [],
};

export default function ResearchPage() {
  const [tab, setTab] = useState<Tab>("configs");
  const [configs, setConfigs] = useState<ResearchConfig[]>([]);
  const [problems, setProblems] = useState<ResearchProblem[]>([]);
  const [selectedNiche, setSelectedNiche] = useState("all");
  const [loading, setLoading] = useState(false);

  // Config form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ConfigFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [dmInput, setDmInput] = useState("");
  const [kwInput, setKwInput] = useState("");
  const [activeWeekId, setActiveWeekId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dynamic ICP-driven niches/countries
  const [availableNiches, setAvailableNiches] = useState<string[]>(FALLBACK_NICHES);
  const [availableCountries, setAvailableCountries] = useState<string[]>(FALLBACK_COUNTRIES);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configsRes, weeksRes] = await Promise.all([
        getResearchConfigs(),
        getResearchWeeks(20),
      ]);
      setConfigs(configsRes.data);

      // Default to most recent week (list is sorted desc by backend)
      const weeks = weeksRes.data;
      if (weeks.length > 0 && !activeWeekId) {
        setActiveWeekId(weeks[0].id);
        // Fetch problems filtered by the latest week
        const problemsRes = await getResearchProblems({ week_id: weeks[0].id });
        setProblems(problemsRes.data);
      } else if (!activeWeekId) {
        // No weeks yet — load all (will be empty)
        const problemsRes = await getResearchProblems();
        setProblems(problemsRes.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    getICPProfile()
      .then((r) => {
        if (r.data.industries.length > 0) setAvailableNiches(r.data.industries);
        if (r.data.countries.length > 0) setAvailableCountries(r.data.countries);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params: Record<string, string | number> = {};
    if (selectedNiche !== "all") params.niche = selectedNiche;
    if (activeWeekId) params.week_id = activeWeekId;
    getResearchProblems(params).then((r) => setProblems(r.data));
  }, [selectedNiche, activeWeekId]);

  const togglePill = (
    list: string[],
    item: string,
    setter: (val: string[]) => void
  ) => {
    setter(
      list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
    );
  };

  const addTag = (field: "decision_makers" | "keywords", value: string) => {
    const trimmed = value.trim();
    if (!trimmed || form[field].includes(trimmed)) return;
    setForm((prev) => ({ ...prev, [field]: [...prev[field], trimmed] }));
  };

  const removeTag = (field: "decision_makers" | "keywords", index: number) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDmInput("");
    setKwInput("");
    setShowForm(true);
  };

  const openEditForm = (config: ResearchConfig) => {
    setEditingId(config.id);
    setForm({
      name: config.name,
      niches: [...config.niches],
      countries: [...config.countries],
      decision_makers: [...(config.decision_makers || [])],
      keywords: [...(config.keywords || [])],
    });
    setDmInput("");
    setKwInput("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateResearchConfig(editingId, form);
      } else {
        await createResearchConfig(form);
      }
      closeForm();
      const res = await getResearchConfigs();
      setConfigs(res.data);
    } catch {
      alert("Failed to save config.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this research config?")) return;
    try {
      await deleteResearchConfig(id);
      setConfigs((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert("Failed to delete config.");
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      const res = await runResearchConfig(id);
      const weekId = res.data.week_id as string;
      setActiveWeekId(weekId);
      setTab("results");
      setProblems([]); // Clear old results immediately

      // Poll for completion every 3 seconds
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(async () => {
        try {
          const status = await getResearchWeekStatus(weekId);
          if (status.data.status === "completed" || status.data.status === "failed") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            setRunningId(null);
            if (status.data.status === "completed") {
              const problems = await getResearchProblems({ week_id: weekId });
              setProblems(problems.data);
            } else {
              alert("Research run failed. Please try again.");
            }
          }
        } catch {
          // Polling error — keep trying
        }
      }, 3000);
    } catch {
      alert("Failed to run research.");
      setRunningId(null);
    }
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
        subtitle="Pain points discovered by AI for your target markets"
        actions={
          tab === "configs" ? (
            <Button onClick={openCreateForm} icon={<Plus size={14} />}>
              New Config
            </Button>
          ) : undefined
        }
      />

      {/* Progress overlay for running research */}
      {runningId && (
        <ProgressOverlay
          isActive={!!runningId}
          steps={[
            { label: "Connecting to research sources...", durationMs: 5000 },
            { label: "Analyzing industry problems...", durationMs: 45000 },
            { label: "Ranking results...", durationMs: 5000 },
          ]}
          className="mb-6"
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => setTab("configs")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "configs"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Settings2 size={15} />
          Configs
        </button>
        <button
          onClick={() => setTab("results")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "results"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <BarChart3 size={15} />
          Results
          {problems.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-zinc-800 text-zinc-400">
              {problems.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <Spinner className="py-16" />
      ) : tab === "configs" ? (
        /* ─── Configs Tab ─── */
        <div>
          {/* Inline Create/Edit Form */}
          {showForm && (
            <Card padding="lg" className="mb-6 border border-indigo-500/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-200">
                  {editingId ? "Edit Config" : "New Research Config"}
                </h3>
                <button
                  onClick={closeForm}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Name */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Name
                </label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Marketing LATAM"
                />
              </div>

              {/* Niches */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Niches
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableNiches.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        togglePill(form.niches, n, (val) =>
                          setForm((prev) => ({ ...prev, niches: val }))
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                        form.niches.includes(n)
                          ? "bg-indigo-600 text-white"
                          : "bg-zinc-800/60 text-zinc-500 border border-[var(--border-subtle)] hover:text-zinc-300"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Countries */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Countries
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableCountries.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        togglePill(form.countries, c, (val) =>
                          setForm((prev) => ({ ...prev, countries: val }))
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        form.countries.includes(c)
                          ? "bg-indigo-600 text-white"
                          : "bg-zinc-800/60 text-zinc-500 border border-[var(--border-subtle)] hover:text-zinc-300"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Decision Makers */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Decision Makers
                  <span className="ml-1 text-zinc-600 font-normal">
                    (e.g. CMO, VP Marketing, Head of Growth)
                  </span>
                </label>
                <div className="flex gap-2">
                  <Input
                    value={dmInput}
                    onChange={(e) => setDmInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag("decision_makers", dmInput);
                        setDmInput("");
                      }
                    }}
                    placeholder="Type a role and press Enter"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      addTag("decision_makers", dmInput);
                      setDmInput("");
                    }}
                    icon={<Plus size={12} />}
                  >
                    Add
                  </Button>
                </div>
                {form.decision_makers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.decision_makers.map((dm, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-600/30"
                      >
                        {dm}
                        <button
                          type="button"
                          onClick={() => removeTag("decision_makers", i)}
                          className="hover:text-emerald-200"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Keywords */}
              <div className="mb-5">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Keywords
                  <span className="ml-1 text-zinc-600 font-normal">
                    (e.g. inbound marketing, lead generation, account-based)
                  </span>
                </label>
                <div className="flex gap-2">
                  <Input
                    value={kwInput}
                    onChange={(e) => setKwInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag("keywords", kwInput);
                        setKwInput("");
                      }
                    }}
                    placeholder="Type a keyword and press Enter"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      addTag("keywords", kwInput);
                      setKwInput("");
                    }}
                    icon={<Plus size={12} />}
                  >
                    Add
                  </Button>
                </div>
                {form.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-600/20 text-amber-400 border border-amber-600/30"
                      >
                        {kw}
                        <button
                          type="button"
                          onClick={() => removeTag("keywords", i)}
                          className="hover:text-amber-200"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} loading={saving}>
                  {editingId ? "Update" : "Create"}
                </Button>
                <Button variant="ghost" onClick={closeForm}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {/* Config Cards Grid */}
          {configs.length === 0 && !showForm ? (
            <EmptyState
              icon={Settings2}
              title="No research configs yet"
              description="Create a config to save your niche + country combinations for quick research runs."
              action={
                <Button onClick={openCreateForm} icon={<Plus size={14} />}>
                  Create First Config
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {configs.map((config) => (
                <Card key={config.id} hover padding="md">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-semibold text-zinc-200 truncate">
                      {config.name}
                    </h3>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                        Niches
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {config.niches.length > 0 ? (
                          config.niches.map((n) => (
                            <Badge key={n} size="sm" variant="default">
                              {n}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-600">None</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                        Countries
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {config.countries.length > 0 ? (
                          config.countries.map((c) => (
                            <Badge key={c} size="sm" variant="info">
                              {c}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-600">None</span>
                        )}
                      </div>
                    </div>
                    {config.decision_makers?.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                          Decision Makers
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {config.decision_makers.map((dm) => (
                            <Badge key={dm} size="sm" variant="success">
                              {dm}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {config.keywords?.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                          Keywords
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {config.keywords.map((kw) => (
                            <Badge key={kw} size="sm" variant="warning">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-subtle)]">
                    <Button
                      size="sm"
                      onClick={() => handleRun(config.id)}
                      loading={runningId === config.id}
                      icon={<Play size={12} />}
                    >
                      Run
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditForm(config)}
                      icon={<Pencil size={12} />}
                    >
                      Edit
                    </Button>
                    <button
                      onClick={() => handleDelete(config.id)}
                      className="ml-auto text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ─── Results Tab ─── */
        <div>
          {/* Niche Filter */}
          <div className="flex gap-1.5 mb-6 flex-wrap">
            {["all", ...availableNiches].map((niche) => (
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
          {problems.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No research data yet"
              description="Create a config and run it to discover trending problems in your target markets."
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
      )}
    </div>
  );
}
