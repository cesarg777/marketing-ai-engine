"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createTemplate } from "@/lib/api";
import { LayoutTemplate, ArrowLeft, Plus, Trash2, Link2, X } from "lucide-react";
import type { ReferenceUrl } from "@/types";
import Link from "next/link";
import axios from "axios";
import {
  FormSection,
  Input,
  Select,
  Textarea,
  Button,
  Alert,
} from "@/components/ui";

const CONTENT_TYPES = [
  { value: "carousel", label: "Carousel Informativo" },
  { value: "meet_the_team", label: "Meet the Team" },
  { value: "case_study", label: "Case Study" },
  { value: "meme", label: "Meme" },
  { value: "avatar_video", label: "Avatar Video" },
  { value: "linkedin_post", label: "LinkedIn Post" },
  { value: "blog_post", label: "Blog Post" },
  { value: "newsletter", label: "Newsletter" },
];

const FIELD_TYPES = ["text", "textarea", "number", "url", "list", "image"];

/** Sanitize a field name to snake_case (only a-z, 0-9, underscores). */
const sanitizeFieldName = (raw: string) =>
  raw.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 64);

interface FieldDef {
  name: string;
  type: string;
  required: boolean;
  max_length?: number;
  description: string;
}

export default function NewTemplatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [contentType, setContentType] = useState("linkedin_post");
  const [description, setDescription] = useState("");
  const [defaultTone, setDefaultTone] = useState("professional");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [fields, setFields] = useState<FieldDef[]>([
    { name: "", type: "text", required: true, description: "" },
  ]);
  const [referenceUrls, setReferenceUrls] = useState<ReferenceUrl[]>([]);

  // Auto-generate slug from name
  useEffect(() => {
    setSlug(
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  }, [name]);

  const addField = () => {
    setFields([...fields, { name: "", type: "text", required: false, description: "" }]);
  };

  const removeField = (idx: number) => {
    setFields(fields.filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, key: keyof FieldDef, value: string | boolean | number) => {
    setFields(fields.map((f, i) => (i === idx ? { ...f, [key]: value } : f)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !slug.trim()) {
      setError("Name and slug are required.");
      return;
    }
    if (fields.length === 0 || fields.some((f) => !f.name.trim())) {
      setError("All fields must have a name.");
      return;
    }

    setSaving(true);
    try {
      const structure = fields.map((f) => ({
        name: f.name,
        type: f.type,
        required: f.required,
        ...(f.max_length ? { max_length: f.max_length } : {}),
        ...(f.description ? { description: f.description } : {}),
      }));

      const validUrls = referenceUrls.filter((r) => r.label.trim() && r.url.trim());

      const res = await createTemplate({
        name: name.trim(),
        slug: slug.trim(),
        content_type: contentType,
        description: description.trim(),
        structure,
        system_prompt: systemPrompt.trim(),
        default_tone: defaultTone,
        reference_urls: validUrls,
      });

      // Redirect to edit page so user can upload assets
      router.push(`/templates/${res.data.id}`);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Failed to create template.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/templates"
          className="p-2 rounded-lg hover:bg-zinc-800/60 text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-muted)] flex items-center justify-center">
              <LayoutTemplate size={16} className="text-indigo-400" />
            </div>
            New Template
          </h1>
          <p className="text-zinc-500 mt-1 text-sm ml-[44px]">
            Create a custom content template for your organization
          </p>
        </div>
      </div>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <FormSection title="Basic Information">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Template"
            />
            <Input
              label="Slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-custom-template"
              helpText="Auto-generated from name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Content Type"
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              options={CONTENT_TYPES}
            />
            <Select
              label="Default Tone"
              value={defaultTone}
              onChange={(e) => setDefaultTone(e.target.value)}
              options={[
                { value: "professional", label: "Professional" },
                { value: "casual", label: "Casual" },
                { value: "educational", label: "Educational" },
                { value: "provocative", label: "Provocative" },
                { value: "humorous", label: "Humorous" },
              ]}
            />
          </div>

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Briefly describe what this template is for..."
          />
        </FormSection>

        {/* Fields (Structure) */}
        <FormSection
          title={`Fields (${fields.length})`}
          actions={
            <button
              type="button"
              onClick={addField}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Plus size={14} />
              Add Field
            </button>
          }
        >
          <div className="space-y-2.5">
            {fields.map((f, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_120px_auto_auto] gap-3 items-center bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg p-3"
              >
                <input
                  type="text"
                  value={f.name}
                  onChange={(e) => updateField(idx, "name", sanitizeFieldName(e.target.value))}
                  placeholder="field_name"
                  className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                />
                <select
                  value={f.type}
                  onChange={(e) => updateField(idx, "type", e.target.value)}
                  className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-[var(--border-focus)] transition-colors appearance-none"
                >
                  {FIELD_TYPES.map((ft) => (
                    <option key={ft} value={ft}>
                      {ft}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => updateField(idx, "required", e.target.checked)}
                    className="rounded border-zinc-600 bg-zinc-900"
                  />
                  Req
                </label>
                <button
                  type="button"
                  onClick={() => removeField(idx)}
                  className="p-1 rounded-md hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
                  title="Remove field"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </FormSection>

        {/* Reference URLs */}
        <FormSection
          title="Reference URLs"
          actions={
            <button
              type="button"
              onClick={() => setReferenceUrls([...referenceUrls, { label: "", url: "" }])}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Plus size={14} />
              Add URL
            </button>
          }
        >
          <p className="text-xs text-zinc-600 mb-3">
            Add links to your newsletter, blog, or other content so the AI can reference your style.
          </p>
          {referenceUrls.length === 0 ? (
            <p className="text-sm text-zinc-600 py-2 text-center">No reference URLs yet.</p>
          ) : (
            <div className="space-y-2.5">
              {referenceUrls.map((ref, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_2fr_auto] gap-3 items-center bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Link2 size={14} className="text-zinc-600 shrink-0" />
                    <input
                      type="text"
                      value={ref.label}
                      onChange={(e) => setReferenceUrls(referenceUrls.map((r, i) => i === idx ? { ...r, label: e.target.value } : r))}
                      placeholder="Label"
                      className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-[var(--border-focus)] transition-colors w-full"
                    />
                  </div>
                  <input
                    type="url"
                    value={ref.url}
                    onChange={(e) => setReferenceUrls(referenceUrls.map((r, i) => i === idx ? { ...r, url: e.target.value } : r))}
                    placeholder="https://..."
                    className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                  />
                  <button type="button" onClick={() => setReferenceUrls(referenceUrls.filter((_, i) => i !== idx))} className="p-1 rounded-md hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-zinc-700 mt-2">
            After creating the template, you&apos;ll be redirected to the edit page where you can upload images and PDFs as visual references for the AI.
          </p>
        </FormSection>

        {/* System Prompt */}
        <FormSection title="System Prompt (optional)">
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={4}
            placeholder="Instructions for the AI when generating content with this template..."
          />
        </FormSection>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            loading={saving}
            icon={<Plus size={15} />}
          >
            Create Template
          </Button>
          <Link href="/templates">
            <Button variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
