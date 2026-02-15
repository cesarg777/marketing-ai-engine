"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getTemplates,
  getResearchProblems,
  getLanguages,
  generateContent,
} from "@/lib/api";
import type {
  ContentTemplate,
  ResearchProblem,
  Language,
  ContentItem,
} from "@/types";
import {
  Sparkles,
  Check,
  ChevronRight,
  FileText,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import {
  PageHeader,
  FormSection,
  Select,
  Input,
  Textarea,
  Button,
  Alert,
  Badge,
  Spinner,
  Card,
  ProgressOverlay,
} from "@/components/ui";

export default function GeneratePageWrapper() {
  return (
    <Suspense fallback={<Spinner className="py-20" />}>
      <GeneratePage />
    </Suspense>
  );
}

const STEPS = ["Topic", "Template", "Configure"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && (
              <ChevronRight
                size={14}
                className={done ? "text-indigo-400/60" : "text-zinc-700"}
              />
            )}
            <div className="flex items-center gap-2">
              <span
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold
                  transition-all duration-300
                  ${
                    done
                      ? "bg-indigo-500/20 text-indigo-400"
                      : active
                        ? "bg-indigo-600 text-white shadow-[var(--shadow-glow)]"
                        : "bg-zinc-800/80 text-zinc-600 border border-[var(--border-subtle)]"
                  }
                `}
              >
                {done ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`text-xs font-medium transition-colors ${
                  active
                    ? "text-zinc-200"
                    : done
                      ? "text-zinc-400"
                      : "text-zinc-600"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const TYPE_ICONS: Record<string, string> = {
  carousel: "slides",
  meet_the_team: "team",
  case_study: "case",
  meme: "meme",
  avatar_video: "video",
  linkedin_post: "linkedin",
  blog_post: "blog",
  newsletter: "mail",
};

function GeneratePage() {
  const searchParams = useSearchParams();
  const preselectedProblem = searchParams.get("problem");

  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [problems, setProblems] = useState<ResearchProblem[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);

  const [selectedProblem, setSelectedProblem] = useState<string>(
    preselectedProblem || ""
  );
  const [customTopic, setCustomTopic] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [tone, setTone] = useState("professional");
  const [instructions, setInstructions] = useState("");

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ContentItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getTemplates(true).then((r) => setTemplates(r.data));
    getResearchProblems({ limit: 50 }).then((r) => setProblems(r.data));
    getLanguages(true).then((r) => setLanguages(r.data));
  }, []);

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      setError("Select a template");
      return;
    }
    if (!selectedProblem && !customTopic) {
      setError("Select a problem or enter a custom topic");
      return;
    }

    setGenerating(true);
    setError("");
    setResult(null);

    try {
      const res = await generateContent({
        problem_id: selectedProblem || undefined,
        custom_topic: customTopic || undefined,
        template_id: selectedTemplate,
        language: selectedLanguage,
        tone,
        additional_instructions: instructions,
      });
      setResult(res.data);
    } catch (err: unknown) {
      let message = "Generation failed";
      if (err && typeof err === "object" && "response" in err) {
        const resp = (err as { response?: { data?: { detail?: string }; status?: number } }).response;
        if (resp?.data?.detail) {
          message = resp.data.detail;
        } else if (resp?.status === 504) {
          message = "Content generation timed out. Please try again.";
        }
      } else if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "ECONNABORTED") {
        message = "Request timed out. The AI is taking too long — please try again.";
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
    }
    setGenerating(false);
  };

  // Determine active step
  const activeStep =
    selectedProblem || customTopic
      ? selectedTemplate
        ? 2
        : 1
      : 0;

  return (
    <div className="max-w-4xl">
      <PageHeader
        icon={Sparkles}
        title="Generate Content"
        subtitle="Select a topic and template to generate AI content"
      />

      <StepIndicator current={activeStep} />

      <div className="space-y-6">
        {/* Step 1: Topic */}
        <FormSection title="1 &middot; Choose Topic">
          <Select
            label="Research Problem"
            value={selectedProblem}
            onChange={(e) => {
              setSelectedProblem(e.target.value);
              if (e.target.value) setCustomTopic("");
            }}
            placeholder="Select from research..."
            options={problems.map((p) => ({
              value: p.id,
              label: `[${p.primary_niche}] ${p.title} (severity: ${p.severity})`,
            }))}
          />

          <div className="relative flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium">
              or
            </span>
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
          </div>

          <Input
            label="Custom Topic"
            value={customTopic}
            onChange={(e) => {
              setCustomTopic(e.target.value);
              if (e.target.value) setSelectedProblem("");
            }}
            placeholder="e.g., How to reduce churn in SaaS companies"
          />
        </FormSection>

        {/* Step 2: Template */}
        <FormSection title="2 &middot; Choose Template">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {templates.map((t) => {
              const isSelected = selectedTemplate === String(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(String(t.id))}
                  className={`
                    relative p-3.5 rounded-lg text-left transition-all duration-200 group
                    border
                    ${
                      isSelected
                        ? "border-indigo-500/60 bg-indigo-500/8 shadow-[var(--shadow-glow)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-input)] hover:border-[var(--border-hover)] hover:bg-zinc-800/40"
                    }
                  `}
                >
                  {isSelected && (
                    <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                      <Check size={10} strokeWidth={3} className="text-white" />
                    </span>
                  )}
                  <div className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium mb-1.5">
                    {TYPE_ICONS[t.content_type] || t.content_type.replace(/_/g, " ")}
                  </div>
                  <div
                    className={`text-sm font-medium transition-colors ${
                      isSelected ? "text-indigo-300" : "text-zinc-300 group-hover:text-zinc-200"
                    }`}
                  >
                    {t.name}
                  </div>
                  <div className="text-[11px] text-zinc-600 mt-0.5 capitalize">
                    {t.content_type.replace(/_/g, " ")}
                  </div>
                </button>
              );
            })}
          </div>
        </FormSection>

        {/* Step 3: Options */}
        <FormSection title="3 &middot; Configure">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Language"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              options={languages.map((l) => ({
                value: l.code,
                label: `${l.flag_emoji} ${l.native_name} (${l.code})`,
              }))}
            />
            <Select
              label="Tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              options={[
                { value: "professional", label: "Professional" },
                { value: "conversational", label: "Conversational" },
                { value: "thought_leadership", label: "Thought Leadership" },
                { value: "humorous", label: "Humorous" },
                { value: "warm", label: "Warm" },
                { value: "editorial", label: "Editorial" },
              ]}
            />
          </div>
          <Textarea
            label="Additional Instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Any specific requirements, keywords to include, or style notes..."
            rows={2}
          />
        </FormSection>

        {/* Error */}
        {error && <Alert variant="error">{error}</Alert>}

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          loading={generating}
          icon={<Sparkles size={16} />}
          className="w-full py-3 text-sm font-semibold"
        >
          {generating ? "Generating with Claude..." : "Generate Content"}
        </Button>

        {/* Progress overlay for generation */}
        <ProgressOverlay
          isActive={generating}
          steps={[
            { label: "Preparing template...", durationMs: 2000 },
            { label: "Generating content with AI...", durationMs: 30000 },
            { label: "Saving content...", durationMs: 2000 },
          ]}
        />

        {/* Result Preview */}
        {result && (
          <Card padding="lg" className="border-emerald-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <Check size={16} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-200">
                    {result.title}
                  </h2>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Content generated successfully
                  </p>
                </div>
              </div>
              <Badge variant="success">Generated</Badge>
            </div>

            {/* Structured preview */}
            <div className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg p-4 mb-4 max-h-80 overflow-auto">
              {typeof result.content_data === "object" &&
              result.content_data !== null ? (
                <dl className="space-y-3">
                  {Object.entries(
                    result.content_data as Record<string, unknown>
                  ).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-0.5">
                        {key.replace(/_/g, " ")}
                      </dt>
                      <dd className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {typeof value === "string"
                          ? value
                          : JSON.stringify(value, null, 2)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <pre className="text-xs text-zinc-400 whitespace-pre-wrap">
                  {JSON.stringify(result.content_data, null, 2)}
                </pre>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Link href={`/content/${result.id}`}>
                <Button size="sm" icon={<FileText size={14} />}>
                  View & Edit
                </Button>
              </Link>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setResult(null)}
                icon={<RotateCcw size={14} />}
              >
                Generate Another
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
