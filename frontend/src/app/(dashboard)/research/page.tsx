"use client";
import { useEffect, useState } from "react";
import {
  getResearchProblems,
  getResearchConfigs,
  createResearchConfig,
  updateResearchConfig,
  deleteResearchConfig,
  runResearchConfig,
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

const NICHES = [
  "marketing",
  "tech",
  "hr",
  "consulting",
  "finance",
  "healthcare",
  "legal",
  "saas",
];

const COUNTRIES = ["US", "MX", "CO", "BR", "ES", "AR", "CL", "PE"];

type Tab = "configs" | "results";

interface ConfigFormData {
  name: string;
  niches: string[];
  countries: string[];
}

const EMPTY_FORM: ConfigFormData = { name: "", niches: [], countries: [] };

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

  const loadData = () => {
    setLoading(true);
    Promise.all([getResearchConfigs(), getResearchProblems()])
      .then(([c, p]) => {
        setConfigs(c.data);
        setProblems(p.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const params: Record<string, string | number> =
      selectedNiche !== "all" ? { niche: selectedNiche } : {};
    getResearchProblems(params).then((r) => setProblems(r.data));
  }, [selectedNiche]);

  const togglePill = (
    list: string[],
    item: string,
    setter: (val: string[]) => void
  ) => {
    setter(
      list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
    );
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (config: ResearchConfig) => {
    setEditingId(config.id);
    setForm({
      name: config.name,
      niches: [...config.niches],
      countries: [...config.countries],
    });
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

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      await runResearchConfig(id);
      alert(
        "Research pipeline queued! Check the Results tab in a few minutes."
      );
    } catch {
      alert("Failed to run research.");
    }
    setRunningId(null);
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
          tab === "configs" ? (
            <Button onClick={openCreateForm} icon={<Plus size={14} />}>
              New Config
            </Button>
          ) : undefined
        }
      />

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
                  {NICHES.map((n) => (
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
              <div className="mb-5">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Countries
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {COUNTRIES.map((c) => (
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
            {["all", ...NICHES].map((niche) => (
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
              description="Create a config and run it to discover trending B2B problems."
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
