"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createTemplate,
  uploadTemplateAsset,
  getFigmaStatus,
  browseFigmaFile,
  getFigmaTextNodes,
  getCanvaStatus,
  listCanvaBrandTemplates,
  getCanvaTemplateDataset,
} from "@/lib/api";
import type { FigmaPage, FigmaTextNode, CanvaTemplate, CanvaField } from "@/lib/api";
import {
  LayoutTemplate,
  ArrowLeft,
  Plus,
  Trash2,
  Link2,
  X,
  Figma,
  Loader2,
  ArrowRight,
  Check,
  Palette,
  Search,
} from "lucide-react";
import { TemplateAssetsUpload, type BufferedAsset } from "@/components/TemplateAssetsUpload";
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
  Badge,
} from "@/components/ui";

const CONTENT_TYPES = [
  { value: "carousel", label: "Carousel Informativo" },
  { value: "meet_the_team", label: "Meet the Team" },
  { value: "case_study", label: "Case Study" },
  { value: "meme", label: "Meme" },
  { value: "infografia", label: "Infografía" },
  { value: "avatar_video", label: "Avatar Video" },
  { value: "linkedin_post", label: "LinkedIn Post" },
  { value: "blog_post", label: "Blog Post" },
  { value: "newsletter", label: "Newsletter" },
];

const FIELD_TYPES = ["text", "textarea", "number", "url", "list", "image"];

const VISUAL_TYPES = ["carousel", "meet_the_team", "case_study", "meme", "infografia"];

/** Default field structures per content type.
 *  Auto-populated when user selects a content_type — editable afterwards. */
const DEFAULT_STRUCTURES: Record<string, FieldDef[]> = {
  carousel: [
    { name: "title", type: "text", required: true, description: "Carousel title / hook" },
    { name: "slides", type: "textarea", required: true, description: "5-10 slides with headline + body each" },
    { name: "cta", type: "text", required: true, description: "Call to action on final slide" },
    { name: "social_caption", type: "textarea", required: true, description: "LinkedIn/Instagram caption" },
    { name: "social_hashtags", type: "text", required: true, description: "3-5 relevant hashtags" },
  ],
  meet_the_team: [
    { name: "title", type: "text", required: true, description: "Post title" },
    { name: "person_name", type: "text", required: true, description: "Team member name" },
    { name: "role", type: "text", required: true, description: "Job title / role" },
    { name: "quote", type: "textarea", required: true, description: "Personal or professional quote" },
    { name: "bio", type: "textarea", required: true, description: "Short bio (max 300 chars)" },
    { name: "social_caption", type: "textarea", required: true, description: "LinkedIn/Instagram caption" },
    { name: "social_hashtags", type: "text", required: true, description: "3-5 relevant hashtags" },
  ],
  case_study: [
    { name: "title", type: "text", required: true, description: "Case study title" },
    { name: "client", type: "text", required: true, description: "Client name or description" },
    { name: "challenge", type: "textarea", required: true, description: "The problem the client faced" },
    { name: "solution", type: "textarea", required: true, description: "How it was solved" },
    { name: "results", type: "textarea", required: true, description: "Quantifiable results" },
    { name: "key_metrics", type: "textarea", required: true, description: "Key metrics with values" },
    { name: "social_caption", type: "textarea", required: true, description: "LinkedIn caption" },
    { name: "social_hashtags", type: "text", required: true, description: "3-5 relevant hashtags" },
  ],
  meme: [
    { name: "title", type: "text", required: true, description: "Meme title (internal)" },
    { name: "top_text", type: "text", required: true, description: "Top text of the meme" },
    { name: "bottom_text", type: "text", required: true, description: "Bottom text / punchline" },
    { name: "image_prompt", type: "text", required: true, description: "Prompt for the meme image" },
    { name: "context", type: "text", required: false, description: "Why this is relatable" },
    { name: "social_caption", type: "textarea", required: true, description: "Caption for social post" },
    { name: "social_hashtags", type: "text", required: true, description: "3-5 relevant hashtags" },
  ],
  infografia: [
    { name: "title", type: "text", required: true, description: "Infographic title" },
    { name: "slides", type: "textarea", required: true, description: "Steps/sections with headline + body" },
    { name: "social_caption", type: "textarea", required: true, description: "LinkedIn/Instagram caption" },
    { name: "social_hashtags", type: "text", required: true, description: "3-5 relevant hashtags" },
  ],
  linkedin_post: [
    { name: "hook", type: "text", required: true, description: "Opening line that grabs attention" },
    { name: "body", type: "textarea", required: true, description: "Main post content (1300 chars max)" },
    { name: "cta", type: "text", required: false, description: "Call to action or question" },
    { name: "hashtags", type: "text", required: false, description: "3-5 relevant hashtags" },
  ],
  blog_post: [
    { name: "title", type: "text", required: true, description: "Blog post title (SEO-optimized)" },
    { name: "meta_description", type: "text", required: true, description: "SEO meta description (155 chars)" },
    { name: "introduction", type: "textarea", required: true, description: "Opening paragraph with hook" },
    { name: "body", type: "textarea", required: true, description: "Main article content with sections" },
    { name: "conclusion", type: "textarea", required: true, description: "Summary and call to action" },
    { name: "tags", type: "text", required: false, description: "Blog categories/tags" },
  ],
  newsletter: [
    { name: "subject_line", type: "text", required: true, description: "Email subject line" },
    { name: "preview_text", type: "text", required: true, description: "Email preview text (90 chars)" },
    { name: "greeting", type: "text", required: false, description: "Personalized greeting" },
    { name: "body", type: "textarea", required: true, description: "Main newsletter content" },
    { name: "cta", type: "text", required: true, description: "Primary call to action" },
    { name: "cta_url", type: "url", required: false, description: "CTA link URL" },
  ],
  avatar_video: [
    { name: "title", type: "text", required: true, description: "Video title" },
    { name: "script", type: "textarea", required: true, description: "Full video script for the avatar" },
    { name: "cta", type: "text", required: false, description: "Closing call to action" },
    { name: "social_caption", type: "textarea", required: false, description: "Caption for social post" },
  ],
};

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
  const [pendingAssets, setPendingAssets] = useState<BufferedAsset[]>([]);

  // Design Source state
  const [designProvider, setDesignProvider] = useState<"builtin" | "figma" | "canva">("builtin");
  const [figmaConnected, setFigmaConnected] = useState(false);
  const [figmaFileUrl, setFigmaFileUrl] = useState("");
  const [figmaFileKey, setFigmaFileKey] = useState("");
  const [figmaPages, setFigmaPages] = useState<FigmaPage[]>([]);
  const [figmaFileName, setFigmaFileName] = useState("");
  const [selectedFrameId, setSelectedFrameId] = useState("");
  const [selectedFrameName, setSelectedFrameName] = useState("");
  const [figmaTextNodes, setFigmaTextNodes] = useState<FigmaTextNode[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [figmaError, setFigmaError] = useState("");

  // Canva Design Source state
  const [canvaConnected, setCanvaConnected] = useState(false);
  const [canvaTemplates, setCanvaTemplates] = useState<CanvaTemplate[]>([]);
  const [selectedCanvaTemplateId, setSelectedCanvaTemplateId] = useState("");
  const [selectedCanvaTemplateName, setSelectedCanvaTemplateName] = useState("");
  const [canvaFields, setCanvaFields] = useState<CanvaField[]>([]);
  const [canvaFieldMapping, setCanvaFieldMapping] = useState<Record<string, string>>({});
  const [canvaLoading, setCanvaLoading] = useState(false);
  const [canvaError, setCanvaError] = useState("");

  const isVisualType = VISUAL_TYPES.includes(contentType);

  // Check design tool connection status on mount
  useEffect(() => {
    getFigmaStatus()
      .then((r) => setFigmaConnected(r.data.connected))
      .catch(() => {});
    getCanvaStatus()
      .then((r) => setCanvaConnected(r.data.connected))
      .catch(() => {});
  }, []);

  // Auto-generate slug from name
  useEffect(() => {
    setSlug(
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  }, [name]);

  // Auto-populate default fields when content type changes
  useEffect(() => {
    const defaults = DEFAULT_STRUCTURES[contentType];
    if (defaults) {
      setFields(defaults.map((f) => ({ ...f })));
    } else {
      setFields([{ name: "", type: "text", required: true, description: "" }]);
    }
  }, [contentType]);

  const addField = () => {
    setFields([...fields, { name: "", type: "text", required: false, description: "" }]);
  };

  const removeField = (idx: number) => {
    setFields(fields.filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, key: keyof FieldDef, value: string | boolean | number) => {
    setFields(fields.map((f, i) => (i === idx ? { ...f, [key]: value } : f)));
  };

  // --- Design Source helpers ---
  const parseFigmaUrl = (url: string): string | null => {
    const m = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
    return m ? m[1] : null;
  };

  const handleLoadFigmaFile = async () => {
    setFigmaError("");
    const key = parseFigmaUrl(figmaFileUrl);
    if (!key) {
      setFigmaError("Invalid Figma URL. Paste a link like https://www.figma.com/design/FILEKEY/...");
      return;
    }
    setFigmaFileKey(key);
    setFigmaLoading(true);
    try {
      const res = await browseFigmaFile(key);
      setFigmaPages(res.data.pages);
      setFigmaFileName(res.data.name);
      if (!selectedFrameId) {
        setSelectedFrameId("");
        setFigmaTextNodes([]);
        setFieldMapping({});
      }
    } catch {
      setFigmaError("Could not load Figma file. Check the URL and your connection in Settings.");
      setFigmaPages([]);
    } finally {
      setFigmaLoading(false);
    }
  };

  const handleSelectFrame = async (frameId: string, frameName: string) => {
    setSelectedFrameId(frameId);
    setSelectedFrameName(frameName);
    setFigmaError("");
    if (!frameId || !figmaFileKey) return;
    setFigmaLoading(true);
    try {
      const res = await getFigmaTextNodes(figmaFileKey, frameId);
      setFigmaTextNodes(res.data);
      const autoMap: Record<string, string> = {};
      for (const f of fields) {
        const normalField = f.name.toLowerCase().replace(/_/g, " ");
        const match = res.data.find((tn: FigmaTextNode) => {
          const normalNode = tn.name.toLowerCase().replace(/_/g, " ");
          return normalNode === normalField || normalNode.includes(normalField) || normalField.includes(normalNode);
        });
        if (match) autoMap[f.name] = match.name;
      }
      setFieldMapping((prev) => {
        const merged = { ...autoMap };
        for (const [k, v] of Object.entries(prev)) {
          if (v && fields.some((f) => f.name === k)) merged[k] = v;
        }
        return merged;
      });
    } catch {
      setFigmaError("Could not load text layers from this frame.");
      setFigmaTextNodes([]);
    } finally {
      setFigmaLoading(false);
    }
  };

  const handleBrowseCanvaTemplates = async () => {
    setCanvaError("");
    setCanvaLoading(true);
    try {
      const res = await listCanvaBrandTemplates();
      setCanvaTemplates(res.data.templates);
      if (res.data.templates.length === 0) {
        setCanvaError("No brand templates found in your Canva account.");
      }
    } catch {
      setCanvaError("Could not load Canva templates. Check your connection in Settings.");
      setCanvaTemplates([]);
    } finally {
      setCanvaLoading(false);
    }
  };

  const handleSelectCanvaTemplate = async (templateId: string) => {
    const tpl = canvaTemplates.find((t) => t.id === templateId);
    setSelectedCanvaTemplateId(templateId);
    setSelectedCanvaTemplateName(tpl?.title || "");
    setCanvaError("");
    if (!templateId) return;
    setCanvaLoading(true);
    try {
      const res = await getCanvaTemplateDataset(templateId);
      setCanvaFields(res.data.fields);
      const autoMap: Record<string, string> = {};
      for (const f of fields) {
        const normalField = f.name.toLowerCase().replace(/_/g, " ");
        const match = res.data.fields.find((cf: CanvaField) => {
          const normalCanva = cf.name.toLowerCase().replace(/_/g, " ");
          return normalCanva === normalField || normalCanva.includes(normalField) || normalField.includes(normalCanva);
        });
        if (match) autoMap[f.name] = match.name;
      }
      setCanvaFieldMapping((prev) => {
        const merged = { ...autoMap };
        for (const [k, v] of Object.entries(prev)) {
          if (v && fields.some((f) => f.name === k)) merged[k] = v;
        }
        return merged;
      });
    } catch {
      setCanvaError("Could not load template fields.");
      setCanvaFields([]);
    } finally {
      setCanvaLoading(false);
    }
  };

  const buildDesignSource = (): Record<string, unknown> | null => {
    if (designProvider === "figma" && figmaFileKey && selectedFrameId) {
      const fm: Record<string, string> = {};
      for (const [k, v] of Object.entries(fieldMapping)) {
        if (v) fm[k] = v;
      }
      return {
        provider: "figma",
        file_key: figmaFileKey,
        frame_id: selectedFrameId,
        frame_name: selectedFrameName,
        field_map: fm,
      };
    }
    if (designProvider === "canva" && selectedCanvaTemplateId) {
      const fm: Record<string, string> = {};
      for (const [k, v] of Object.entries(canvaFieldMapping)) {
        if (v) fm[k] = v;
      }
      return {
        provider: "canva",
        template_id: selectedCanvaTemplateId,
        template_name: selectedCanvaTemplateName,
        field_map: fm,
      };
    }
    return null;
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
        design_source: buildDesignSource(),
      });

      const templateId = res.data.id;

      // Upload buffered assets
      for (const asset of pendingAssets) {
        const formData = new FormData();
        formData.append("file", asset.file);
        formData.append("asset_type", asset.assetType);
        formData.append("name", asset.file.name);
        await uploadTemplateAsset(templateId, formData);
      }

      // Clean up preview URLs
      pendingAssets.forEach((a) => a.preview && URL.revokeObjectURL(a.preview));

      router.push(`/templates/${templateId}`);
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

          {DEFAULT_STRUCTURES[contentType] && (
            <p className="text-xs text-indigo-400/70 -mt-2">
              Default fields for this type have been loaded below. You can edit or remove them.
            </p>
          )}

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
                className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg p-3 space-y-2"
              >
                <div className="grid grid-cols-[1fr_120px_auto_auto] gap-3 items-center">
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
                <input
                  type="text"
                  value={f.description}
                  onChange={(e) => updateField(idx, "description", e.target.value)}
                  placeholder="Field description (optional)"
                  className="w-full bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-2.5 py-1 text-xs text-zinc-400 focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                />
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
        </FormSection>

        {/* Assets & References */}
        <TemplateAssetsUpload
          bufferedFiles={pendingAssets}
          onBufferedFilesChange={setPendingAssets}
        />

        {/* Design Source */}
        <FormSection title="Design Source">
            <p className="text-xs text-zinc-600 mb-4">
              Link an editable design from Figma or Canva to render professional-quality assets. Falls back to the built-in engine when no design is linked.
            </p>

            {/* Provider tabs */}
            <div className="flex gap-1 mb-4 bg-[var(--surface-input)] p-1 rounded-lg w-fit">
              {[
                { key: "builtin" as const, label: "Built-in" },
                { key: "figma" as const, label: "Figma" },
                { key: "canva" as const, label: "Canva" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDesignProvider(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    designProvider === tab.key
                      ? "bg-[var(--surface-base)] text-zinc-100 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Built-in info */}
            {designProvider === "builtin" && (
              <div className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg p-4">
                <p className="text-sm text-zinc-400">
                  Using the built-in rendering engine. Text zones are positioned on the template background using field zone settings.
                </p>
              </div>
            )}

            {/* Figma panel */}
            {designProvider === "figma" && (
              <div className="space-y-4">
                {!figmaConnected && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex items-center gap-3">
                    <Figma size={16} className="text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-300">
                      Figma is not connected.{" "}
                      <Link href="/settings" className="underline hover:text-amber-200">
                        Connect in Settings
                      </Link>{" "}
                      first.
                    </p>
                  </div>
                )}

                {figmaConnected && (
                  <>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          label="Figma Design Link"
                          value={figmaFileUrl}
                          onChange={(e) => setFigmaFileUrl(e.target.value)}
                          placeholder="https://www.figma.com/design/FILEKEY/Design-Name"
                        />
                      </div>
                      <div className="pt-6">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleLoadFigmaFile}
                          loading={figmaLoading && figmaPages.length === 0}
                          disabled={!figmaFileUrl.trim()}
                        >
                          Load
                        </Button>
                      </div>
                    </div>

                    {figmaError && <p className="text-xs text-red-400">{figmaError}</p>}

                    {figmaPages.length > 0 && (
                      <div className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg p-4 space-y-3">
                        {figmaFileName && (
                          <div className="flex items-center gap-2 mb-1">
                            <Figma size={14} className="text-purple-400" />
                            <span className="text-sm text-zinc-200 font-medium">{figmaFileName}</span>
                            <Badge variant="info" size="sm">{figmaPages.reduce((sum, p) => sum + p.frames.length, 0)} frames</Badge>
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-medium text-zinc-400 tracking-wide mb-1.5">
                            Select Frame
                          </label>
                          <select
                            value={selectedFrameId}
                            onChange={(e) => {
                              const fId = e.target.value;
                              let fName = "";
                              for (const p of figmaPages) {
                                const fr = p.frames.find((f) => f.id === fId);
                                if (fr) { fName = fr.name; break; }
                              }
                              handleSelectFrame(fId, fName);
                            }}
                            className="w-full bg-[var(--surface-base)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-[var(--border-focus)] transition-colors appearance-none"
                          >
                            <option value="">Choose a frame...</option>
                            {figmaPages.map((page) =>
                              page.frames.map((frame) => (
                                <option key={frame.id} value={frame.id}>
                                  {page.name} / {frame.name}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      </div>
                    )}

                    {selectedFrameId && figmaTextNodes.length > 0 && (
                      <div className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-medium text-zinc-400 tracking-wide">Field Mapping</h4>
                          <span className="text-[10px] text-zinc-600">
                            {Object.values(fieldMapping).filter(Boolean).length} / {fields.length} mapped
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600">
                          Map each template field to a Figma text layer. The generated content will replace the text in each mapped layer.
                        </p>
                        <div className="space-y-2">
                          {fields.map((f) => (
                            <div key={f.name} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                              <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-zinc-300 truncate">
                                {f.name}
                              </div>
                              <ArrowRight size={14} className="text-zinc-600" />
                              <select
                                value={fieldMapping[f.name] || ""}
                                onChange={(e) => setFieldMapping((prev) => ({ ...prev, [f.name]: e.target.value }))}
                                className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[var(--border-focus)] transition-colors appearance-none"
                              >
                                <option value="">— Not mapped —</option>
                                {figmaTextNodes.map((tn) => (
                                  <option key={tn.id} value={tn.name}>
                                    {tn.name} ({tn.characters.length > 30 ? tn.characters.slice(0, 30) + "..." : tn.characters})
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                        {Object.values(fieldMapping).some(Boolean) && (
                          <div className="flex items-center gap-2 pt-1">
                            <Check size={14} className="text-emerald-400" />
                            <span className="text-xs text-emerald-400">
                              Figma design linked — content will render using your design
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedFrameId && figmaLoading && figmaTextNodes.length === 0 && (
                      <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
                        <Loader2 size={14} className="animate-spin" />
                        Loading text layers...
                      </div>
                    )}

                    {selectedFrameId && !figmaLoading && figmaTextNodes.length === 0 && figmaPages.length > 0 && (
                      <p className="text-xs text-zinc-600 py-2">
                        No text layers found in this frame. Select a frame that contains text elements.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Canva panel */}
            {designProvider === "canva" && (
              <div className="space-y-4">
                {!canvaConnected && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex items-center gap-3">
                    <Palette size={16} className="text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-300">
                      Canva is not connected.{" "}
                      <Link href="/settings" className="underline hover:text-amber-200">
                        Connect in Settings
                      </Link>{" "}
                      first.
                    </p>
                  </div>
                )}

                {canvaConnected && (
                  <>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleBrowseCanvaTemplates}
                        loading={canvaLoading && canvaTemplates.length === 0}
                        icon={<Search size={13} />}
                      >
                        Browse Brand Templates
                      </Button>
                      {selectedCanvaTemplateName && (
                        <span className="text-xs text-zinc-400">
                          Selected: <strong className="text-zinc-200">{selectedCanvaTemplateName}</strong>
                        </span>
                      )}
                    </div>

                    {canvaError && <p className="text-xs text-red-400">{canvaError}</p>}

                    {canvaTemplates.length > 0 && (
                      <div className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Palette size={14} className="text-cyan-400" />
                          <span className="text-sm text-zinc-200 font-medium">Brand Templates</span>
                          <Badge variant="info" size="sm">{canvaTemplates.length} templates</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                          {canvaTemplates.map((tpl) => (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => handleSelectCanvaTemplate(tpl.id)}
                              className={`text-left p-2 rounded-lg border transition-colors ${
                                selectedCanvaTemplateId === tpl.id
                                  ? "border-cyan-500/50 bg-cyan-500/5"
                                  : "border-[var(--border-default)] hover:border-zinc-600"
                              }`}
                            >
                              {tpl.thumbnail?.url && (
                                <img
                                  src={tpl.thumbnail.url}
                                  alt={tpl.title}
                                  className="w-full h-20 object-cover rounded mb-1.5"
                                />
                              )}
                              <span className="text-xs text-zinc-300 line-clamp-1">{tpl.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedCanvaTemplateId && canvaFields.length > 0 && (
                      <div className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-medium text-zinc-400 tracking-wide">Field Mapping</h4>
                          <span className="text-[10px] text-zinc-600">
                            {Object.values(canvaFieldMapping).filter(Boolean).length} / {fields.length} mapped
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600">
                          Map each template field to a Canva autofill field. Generated content will populate these fields automatically.
                        </p>
                        <div className="space-y-2">
                          {fields.map((f) => (
                            <div key={f.name} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                              <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-zinc-300 truncate">
                                {f.name}
                              </div>
                              <ArrowRight size={14} className="text-zinc-600" />
                              <select
                                value={canvaFieldMapping[f.name] || ""}
                                onChange={(e) => setCanvaFieldMapping((prev) => ({ ...prev, [f.name]: e.target.value }))}
                                className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[var(--border-focus)] transition-colors appearance-none"
                              >
                                <option value="">— Not mapped —</option>
                                {canvaFields.map((cf) => (
                                  <option key={cf.name} value={cf.name}>
                                    {cf.name} ({cf.type})
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                        {Object.values(canvaFieldMapping).some(Boolean) && (
                          <div className="flex items-center gap-2 pt-1">
                            <Check size={14} className="text-emerald-400" />
                            <span className="text-xs text-emerald-400">
                              Canva template linked — content will render using your brand template
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedCanvaTemplateId && canvaLoading && canvaFields.length === 0 && (
                      <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
                        <Loader2 size={14} className="animate-spin" />
                        Loading template fields...
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
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
