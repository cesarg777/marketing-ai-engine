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
import { Sparkles, Loader2 } from "lucide-react";

export default function GeneratePageWrapper() {
  return (
    <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
      <GeneratePage />
    </Suspense>
  );
}

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
      const message =
        err instanceof Error ? err.message : "Generation failed";
      setError(message);
    }
    setGenerating(false);
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles size={24} className="text-indigo-400" />
          Generate Content
        </h1>
        <p className="text-gray-400 mt-1">
          Select a topic and template to generate AI content
        </p>
      </div>

      <div className="space-y-6">
        {/* Step 1: Topic */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">
            1. Choose Topic
          </h2>
          <select
            value={selectedProblem}
            onChange={(e) => {
              setSelectedProblem(e.target.value);
              if (e.target.value) setCustomTopic("");
            }}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 mb-3"
          >
            <option value="">Select from research...</option>
            {problems.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.primary_niche}] {p.title} (severity: {p.severity})
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-500 mb-2">
            Or enter a custom topic:
          </div>
          <input
            type="text"
            value={customTopic}
            onChange={(e) => {
              setCustomTopic(e.target.value);
              if (e.target.value) setSelectedProblem("");
            }}
            placeholder="e.g., How to reduce B2B churn in SaaS"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200"
          />
        </div>

        {/* Step 2: Template */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">
            2. Choose Template
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(String(t.id))}
                className={`p-3 rounded-lg text-left text-xs border transition-colors ${
                  selectedTemplate === String(t.id)
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-gray-700 bg-gray-900 hover:border-gray-600"
                }`}
              >
                <div className="font-medium text-white">{t.name}</div>
                <div className="text-gray-500 mt-0.5 capitalize">
                  {t.content_type.replace(/_/g, " ")}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Options */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">
            3. Configure
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag_emoji} {l.native_name} ({l.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
              >
                <option value="professional">Professional</option>
                <option value="conversational">Conversational</option>
                <option value="thought_leadership">Thought Leadership</option>
                <option value="humorous">Humorous</option>
                <option value="warm">Warm</option>
                <option value="editorial">Editorial</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Additional Instructions (optional)
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Any specific requirements, keywords to include, or style notes..."
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
            />
          </div>
        </div>

        {/* Generate Button */}
        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {generating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating with Claude...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate Content
            </>
          )}
        </button>

        {/* Result Preview */}
        {result && (
          <div className="bg-gray-800/50 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                {result.title}
              </h2>
              <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                Generated
              </span>
            </div>
            <pre className="text-xs text-gray-300 bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
              {JSON.stringify(result.content_data, null, 2)}
            </pre>
            <div className="flex gap-3 mt-4">
              <a
                href={`/content/${result.id}`}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                View & Edit
              </a>
              <button
                onClick={() => setResult(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition-colors"
              >
                Generate Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
