"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { getTemplate, updateTemplate, deleteTemplate } from "@/lib/api";
import type { ContentTemplate } from "@/types";
import {
  LayoutTemplate,
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Lock,
} from "lucide-react";
import Link from "next/link";
import axios from "axios";
import {
  FormSection,
  Input,
  Select,
  Textarea,
  Button,
  Alert,
  Badge,
  Spinner,
  Toggle,
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

interface FieldDef {
  name: string;
  type: string;
  required: boolean;
  max_length?: number;
  description: string;
}

export default function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [template, setTemplate] = useState<ContentTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Editable fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultTone, setDefaultTone] = useState("professional");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<FieldDef[]>([]);

  const isSystem = template?.org_id === null;

  useEffect(() => {
    getTemplate(id)
      .then((r) => {
        const t = r.data as ContentTemplate;
        setTemplate(t);
        setName(t.name);
        setDescription(t.description);
        setDefaultTone(t.default_tone);
        setSystemPrompt(t.system_prompt);
        setIsActive(t.is_active);
        setFields(
          t.structure.map((s) => ({
            name: s.name,
            type: s.type,
            required: s.required ?? false,
            max_length: s.max_length,
            description: s.description ?? "",
          }))
        );
      })
      .catch(() => setError("Template not found."))
      .finally(() => setLoading(false));
  }, [id]);

  const addField = () => {
    setFields([...fields, { name: "", type: "text", required: false, description: "" }]);
  };

  const removeField = (idx: number) => {
    setFields(fields.filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, key: keyof FieldDef, value: string | boolean | number) => {
    setFields(fields.map((f, i) => (i === idx ? { ...f, [key]: value } : f)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (fields.some((f) => !f.name.trim())) {
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

      await updateTemplate(id, {
        name: name.trim(),
        description: description.trim(),
        structure,
        system_prompt: systemPrompt.trim(),
        default_tone: defaultTone,
        is_active: isActive,
      });

      setSuccess("Template saved successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Failed to save template.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Deactivate this template? It can be reactivated later.")) return;
    try {
      await deleteTemplate(id);
      router.push("/templates");
    } catch {
      setError("Failed to deactivate template.");
    }
  };

  if (loading) {
    return <Spinner className="py-20" />;
  }

  if (!template) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-400 mb-4">Template not found.</p>
        <Link href="/templates" className="text-indigo-400 hover:text-indigo-300 text-sm">
          Back to templates
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
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
              {template.name}
              {isSystem && (
                <Badge variant="default" size="sm">
                  <Lock size={10} className="mr-1" />
                  System
                </Badge>
              )}
            </h1>
            <p className="text-zinc-500 mt-1 text-sm ml-[44px]">
              {template.slug} &middot; {template.content_type.replace(/_/g, " ")}
            </p>
          </div>
        </div>
        {!isSystem && (
          <Button variant="danger" size="sm" onClick={handleDelete} icon={<Trash2 size={13} />}>
            Deactivate
          </Button>
        )}
      </div>

      {/* System warning */}
      {isSystem && (
        <Alert variant="warning" className="mb-6">
          System templates are read-only. Duplicate it to create an editable copy for your organization.
        </Alert>
      )}

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}
      {success && <Alert variant="success" className="mb-6">{success}</Alert>}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Info */}
        <FormSection title="Basic Information">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSystem}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400 tracking-wide">
                Content Type
              </label>
              <div className="bg-[var(--surface-input)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-sm text-zinc-400 capitalize">
                {CONTENT_TYPES.find((ct) => ct.value === template.content_type)?.label ||
                  template.content_type}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Default Tone"
              value={defaultTone}
              onChange={(e) => setDefaultTone(e.target.value)}
              disabled={isSystem}
              options={[
                { value: "professional", label: "Professional" },
                { value: "casual", label: "Casual" },
                { value: "educational", label: "Educational" },
                { value: "provocative", label: "Provocative" },
                { value: "humorous", label: "Humorous" },
              ]}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400 tracking-wide">
                Status
              </label>
              <div className="pt-1">
                <Toggle
                  label={isActive ? "Active" : "Inactive"}
                  checked={isActive}
                  onChange={() => !isSystem && setIsActive(!isActive)}
                  disabled={isSystem}
                />
              </div>
            </div>
          </div>

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            disabled={isSystem}
          />
        </FormSection>

        {/* Fields (Structure) */}
        <FormSection
          title={`Fields (${fields.length})`}
          actions={
            !isSystem ? (
              <button
                type="button"
                onClick={addField}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Plus size={14} />
                Add Field
              </button>
            ) : undefined
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
                  onChange={(e) => updateField(idx, "name", e.target.value)}
                  placeholder="field_name"
                  disabled={isSystem}
                  className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-[var(--border-focus)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                />
                <select
                  value={f.type}
                  onChange={(e) => updateField(idx, "type", e.target.value)}
                  disabled={isSystem}
                  className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-[var(--border-focus)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors appearance-none"
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
                    disabled={isSystem}
                    className="rounded border-zinc-600 bg-zinc-900"
                  />
                  Req
                </label>
                {!isSystem && (
                  <button
                    type="button"
                    onClick={() => removeField(idx)}
                    className="p-1 rounded-md hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
                    title="Remove field"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </FormSection>

        {/* System Prompt */}
        <FormSection title="System Prompt">
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={4}
            disabled={isSystem}
            placeholder="Instructions for the AI when generating content with this template..."
          />
        </FormSection>

        {/* Actions */}
        {!isSystem && (
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              loading={saving}
              icon={<Save size={15} />}
            >
              Save Changes
            </Button>
            <Link href="/templates">
              <Button variant="ghost">Cancel</Button>
            </Link>
          </div>
        )}
      </form>
    </div>
  );
}
