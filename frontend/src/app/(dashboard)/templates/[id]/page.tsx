"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
  getFigmaStatus,
  browseFigmaFile,
  getFigmaTextNodes,
  getCanvaStatus,
  listCanvaBrandTemplates,
  getCanvaTemplateDataset,
} from "@/lib/api";
import type { FigmaPage, FigmaTextNode, CanvaTemplate, CanvaField } from "@/lib/api";
import type { ContentTemplate, ReferenceUrl } from "@/types";
import {
  LayoutTemplate,
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Lock,
  Link2,
  X,
  ChevronDown,
  ChevronRight,
  MapPin,
  Figma,
  Loader2,
  ArrowRight,
  Check,
  Palette,
  Search,
} from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { TemplateAssetsUpload } from "@/components/TemplateAssetsUpload";
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
  { value: "infografia", label: "Infografía" },
  { value: "avatar_video", label: "Avatar Video" },
  { value: "linkedin_post", label: "LinkedIn Post" },
  { value: "blog_post", label: "Blog Post" },
  { value: "newsletter", label: "Newsletter" },
];

const FIELD_TYPES = ["text", "textarea", "number", "url", "list", "image"];

/** Sanitize a field name to snake_case (only a-z, 0-9, underscores). */
const sanitizeFieldName = (raw: string) =>
  raw.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 64);

const VISUAL_TYPES = ["carousel", "meet_the_team", "case_study", "meme", "infografia"];

interface TextZone {
  x: number;
  y: number;
  width: number;
  height: number;
  font_size: number;
  font_weight: number;
  font_family: string;
  color: string;
  align: string;
  line_height: number;
  text_transform: string;
  bg_fill: string;
  padding: number;
}

interface FieldDef {
  name: string;
  type: string;
  required: boolean;
  max_length?: number;
  description: string;
  zone?: TextZone;
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

  // Reference URLs
  const [referenceUrls, setReferenceUrls] = useState<ReferenceUrl[]>([]);

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

  // Zone editor expanded states
  const [expandedZones, setExpandedZones] = useState<Set<number>>(new Set());

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
        setReferenceUrls(t.reference_urls || []);
        setFields(
          t.structure.map((s) => ({
            name: s.name,
            type: s.type,
            required: s.required ?? false,
            max_length: s.max_length,
            description: s.description ?? "",
            zone: (s as unknown as Record<string, unknown>).zone as TextZone | undefined,
          }))
        );
        // Load existing design_source
        if (t.design_source) {
          const ds = t.design_source;
          setDesignProvider(ds.provider as "figma" | "canva");
          if (ds.provider === "figma" && ds.file_key) {
            setFigmaFileKey(ds.file_key);
            setFigmaFileUrl(`https://www.figma.com/design/${ds.file_key}`);
            if (ds.frame_id) setSelectedFrameId(ds.frame_id);
            if (ds.frame_name) setSelectedFrameName(ds.frame_name);
            if (ds.field_map) setFieldMapping(ds.field_map);
            // Auto-load file structure and text nodes
            browseFigmaFile(ds.file_key)
              .then((fRes) => {
                setFigmaPages(fRes.data.pages);
                setFigmaFileName(fRes.data.name);
                if (ds.frame_id) {
                  getFigmaTextNodes(ds.file_key!, ds.frame_id)
                    .then((tnRes) => setFigmaTextNodes(tnRes.data))
                    .catch(() => {});
                }
              })
              .catch(() => {});
          }
          // Load existing Canva design_source
          const canvaDs = ds as Record<string, unknown>;
          if (ds.provider === "canva" && canvaDs.template_id) {
            const tplId = canvaDs.template_id as string;
            const tplName = (canvaDs.template_name as string) || "";
            setSelectedCanvaTemplateId(tplId);
            setSelectedCanvaTemplateName(tplName);
            if (ds.field_map) setCanvaFieldMapping(ds.field_map);
            // Auto-load template dataset fields
            getCanvaTemplateDataset(tplId)
              .then((res) => setCanvaFields(res.data.fields))
              .catch(() => {});
          }
        }
      })
      .catch(() => setError("Template not found."))
      .finally(() => setLoading(false));

    // Check design tool connection status
    getFigmaStatus()
      .then((r) => setFigmaConnected(r.data.connected))
      .catch(() => {});
    getCanvaStatus()
      .then((r) => setCanvaConnected(r.data.connected))
      .catch(() => {});
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

  const isVisualType = VISUAL_TYPES.includes(template?.content_type || "");

  const toggleZoneExpanded = (idx: number) => {
    setExpandedZones((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const DEFAULT_ZONE: TextZone = {
    x: 0, y: 0, width: 400, height: 100,
    font_size: 20, font_weight: 400, font_family: "Inter",
    color: "#000000", align: "left", line_height: 1.4,
    text_transform: "none", bg_fill: "", padding: 0,
  };

  const addZone = (idx: number) => {
    setFields(fields.map((f, i) => i === idx ? { ...f, zone: { ...DEFAULT_ZONE } } : f));
    setExpandedZones((prev) => new Set(prev).add(idx));
  };

  const removeZone = (idx: number) => {
    setFields(fields.map((f, i) => i === idx ? { ...f, zone: undefined } : f));
    setExpandedZones((prev) => { const n = new Set(prev); n.delete(idx); return n; });
  };

  const updateZone = (idx: number, key: keyof TextZone, value: string | number) => {
    setFields(fields.map((f, i) => {
      if (i !== idx || !f.zone) return f;
      return { ...f, zone: { ...f.zone, [key]: value } };
    }));
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
      // If we had a previously selected frame, keep it
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
      // Auto-match fields to text nodes by similar name
      const autoMap: Record<string, string> = {};
      for (const f of fields) {
        const normalField = f.name.toLowerCase().replace(/_/g, " ");
        const match = res.data.find((tn: FigmaTextNode) => {
          const normalNode = tn.name.toLowerCase().replace(/_/g, " ");
          return normalNode === normalField || normalNode.includes(normalField) || normalField.includes(normalNode);
        });
        if (match) autoMap[f.name] = match.name;
      }
      // Merge: keep existing mappings, fill gaps with auto-matched
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

  // --- Canva Design Source helpers ---
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
      // Auto-match fields to Canva dataset fields by name
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
    if (designProvider === "builtin") return null;
    return null;
  };

  // Reference URL helpers
  const addReferenceUrl = () => {
    setReferenceUrls([...referenceUrls, { label: "", url: "" }]);
  };

  const removeReferenceUrl = (idx: number) => {
    setReferenceUrls(referenceUrls.filter((_, i) => i !== idx));
  };

  const updateReferenceUrl = (idx: number, key: keyof ReferenceUrl, value: string) => {
    setReferenceUrls(referenceUrls.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (fields.some((f) => !f.name.trim())) {
      setError("All fields must have a name.");
      return;
    }

    // Validate reference URLs
    const validUrls = referenceUrls.filter((r) => r.label.trim() && r.url.trim());

    setSaving(true);
    try {
      const structure = fields.map((f) => ({
        name: f.name,
        type: f.type,
        required: f.required,
        ...(f.max_length ? { max_length: f.max_length } : {}),
        ...(f.description ? { description: f.description } : {}),
        ...(f.zone ? { zone: f.zone } : {}),
      }));

      await updateTemplate(id, {
        name: name.trim(),
        description: description.trim(),
        structure,
        system_prompt: systemPrompt.trim(),
        default_tone: defaultTone,
        is_active: isActive,
        reference_urls: validUrls,
        design_source: buildDesignSource(),
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
              <div key={idx} className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg">
                {/* Field row */}
                <div className="grid grid-cols-[1fr_100px_70px_auto_auto_auto] gap-2 items-center p-3">
                  <input
                    type="text"
                    value={f.name}
                    onChange={(e) => updateField(idx, "name", sanitizeFieldName(e.target.value))}
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
                      <option key={ft} value={ft}>{ft}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={f.max_length ?? ""}
                    onChange={(e) => updateField(idx, "max_length", e.target.value ? parseInt(e.target.value) : 0)}
                    placeholder="Max"
                    disabled={isSystem}
                    className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-[var(--border-focus)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors w-full"
                    title="Max characters"
                  />
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
                  {/* Zone toggle (only for visual types) */}
                  {isVisualType && !isSystem && (
                    <button
                      type="button"
                      onClick={() => f.zone ? toggleZoneExpanded(idx) : addZone(idx)}
                      className={`p-1 rounded-md transition-colors ${
                        f.zone
                          ? "text-indigo-400 hover:bg-indigo-500/10"
                          : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-700/30"
                      }`}
                      title={f.zone ? "Edit text position" : "Add text position on design"}
                    >
                      <MapPin size={13} />
                    </button>
                  )}
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

                {/* Zone editor panel (expanded) */}
                {isVisualType && f.zone && expandedZones.has(idx) && (
                  <div className="border-t border-[var(--border-subtle)] px-3 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={() => toggleZoneExpanded(idx)}
                        className="flex items-center gap-1 text-xs text-indigo-400"
                      >
                        <ChevronDown size={12} />
                        Text Position on Design
                      </button>
                      <button
                        type="button"
                        onClick={() => removeZone(idx)}
                        className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
                      >
                        Remove zone
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-600">X (px)</label>
                        <input type="number" value={f.zone.x} onChange={(e) => updateZone(idx, "x", parseInt(e.target.value) || 0)}
                          className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-zinc-200 w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-600">Y (px)</label>
                        <input type="number" value={f.zone.y} onChange={(e) => updateZone(idx, "y", parseInt(e.target.value) || 0)}
                          className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-zinc-200 w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-600">Width</label>
                        <input type="number" value={f.zone.width} onChange={(e) => updateZone(idx, "width", parseInt(e.target.value) || 0)}
                          className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-zinc-200 w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-600">Height</label>
                        <input type="number" value={f.zone.height} onChange={(e) => updateZone(idx, "height", parseInt(e.target.value) || 0)}
                          className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-zinc-200 w-full" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-600">Font Size</label>
                        <input type="number" value={f.zone.font_size} onChange={(e) => updateZone(idx, "font_size", parseInt(e.target.value) || 16)}
                          className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-zinc-200 w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-600">Weight</label>
                        <select value={f.zone.font_weight} onChange={(e) => updateZone(idx, "font_weight", parseInt(e.target.value))}
                          className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-zinc-200 w-full appearance-none">
                          {[300,400,500,600,700,800,900].map((w) => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-600">Color</label>
                        <input type="text" value={f.zone.color} onChange={(e) => updateZone(idx, "color", e.target.value)}
                          placeholder="#FFFFFF"
                          className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-zinc-200 w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-600">Align</label>
                        <select value={f.zone.align} onChange={(e) => updateZone(idx, "align", e.target.value)}
                          className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-zinc-200 w-full appearance-none">
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-600">Font Family</label>
                        <input type="text" value={f.zone.font_family} onChange={(e) => updateZone(idx, "font_family", e.target.value)}
                          className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-zinc-200 w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-600">Line Height</label>
                        <input type="number" step="0.1" value={f.zone.line_height} onChange={(e) => updateZone(idx, "line_height", parseFloat(e.target.value) || 1.4)}
                          className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-zinc-200 w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-600">Transform</label>
                        <select value={f.zone.text_transform} onChange={(e) => updateZone(idx, "text_transform", e.target.value)}
                          className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-zinc-200 w-full appearance-none">
                          <option value="none">None</option>
                          <option value="uppercase">UPPERCASE</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-600">BG Fill</label>
                        <input type="text" value={f.zone.bg_fill} onChange={(e) => updateZone(idx, "bg_fill", e.target.value)}
                          placeholder="#000 to cover text"
                          className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded px-2 py-1 text-xs text-zinc-200 w-full" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Collapsed zone indicator */}
                {isVisualType && f.zone && !expandedZones.has(idx) && (
                  <button
                    type="button"
                    onClick={() => toggleZoneExpanded(idx)}
                    className="w-full border-t border-[var(--border-subtle)] px-3 py-1.5 flex items-center gap-1 text-[10px] text-indigo-400/60 hover:text-indigo-400 transition-colors"
                  >
                    <ChevronRight size={10} />
                    Zone: ({f.zone.x}, {f.zone.y}) {f.zone.width}x{f.zone.height} &middot; {f.zone.font_size}px {f.zone.color}
                  </button>
                )}
              </div>
            ))}
          </div>
        </FormSection>

        {/* Reference URLs */}
        <FormSection
          title="Reference URLs"
          actions={
            !isSystem ? (
              <button
                type="button"
                onClick={addReferenceUrl}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Plus size={14} />
                Add URL
              </button>
            ) : undefined
          }
        >
          <p className="text-xs text-zinc-600 mb-3">
            Add links to your newsletter, blog, or other content so the AI can reference your style and format.
          </p>
          {referenceUrls.length === 0 ? (
            <p className="text-sm text-zinc-600 py-3 text-center">
              No reference URLs added yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {referenceUrls.map((ref, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_2fr_auto] gap-3 items-center bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg p-3"
                >
                  <div className="flex items-center gap-2">
                    <Link2 size={14} className="text-zinc-600 shrink-0" />
                    <input
                      type="text"
                      value={ref.label}
                      onChange={(e) => updateReferenceUrl(idx, "label", e.target.value)}
                      placeholder="Label (e.g. Newsletter)"
                      disabled={isSystem}
                      className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-[var(--border-focus)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors w-full"
                    />
                  </div>
                  <input
                    type="url"
                    value={ref.url}
                    onChange={(e) => updateReferenceUrl(idx, "url", e.target.value)}
                    placeholder="https://..."
                    disabled={isSystem}
                    className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-[var(--border-focus)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  />
                  {!isSystem && (
                    <button
                      type="button"
                      onClick={() => removeReferenceUrl(idx)}
                      className="p-1 rounded-md hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </FormSection>

        {/* Assets & References */}
        {!isSystem && <TemplateAssetsUpload templateId={id} />}

        {/* Design Source (only for visual content types, non-system templates) */}
        {isVisualType && !isSystem && (
          <FormSection title="Design Source">
            <p className="text-xs text-zinc-600 mb-4">
              Link an editable design from Figma to render professional-quality assets. Falls back to the built-in engine when no design is linked.
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
                  Using the built-in rendering engine. Text zones are positioned on the template background using the field zone settings above.
                </p>
              </div>
            )}

            {/* Figma panel */}
            {designProvider === "figma" && (
              <div className="space-y-4">
                {/* Connection status */}
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
                    {/* File URL input */}
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

                    {figmaError && (
                      <p className="text-xs text-red-400">{figmaError}</p>
                    )}

                    {/* File info + Frame selector */}
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
                              // Find name from pages
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

                    {/* Field mapper */}
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
                            <div
                              key={f.name}
                              className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center"
                            >
                              <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-zinc-300 truncate">
                                {f.name}
                              </div>
                              <ArrowRight size={14} className="text-zinc-600" />
                              <select
                                value={fieldMapping[f.name] || ""}
                                onChange={(e) =>
                                  setFieldMapping((prev) => ({ ...prev, [f.name]: e.target.value }))
                                }
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

                        {/* Status summary */}
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

                    {/* Loading text nodes */}
                    {selectedFrameId && figmaLoading && figmaTextNodes.length === 0 && (
                      <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
                        <Loader2 size={14} className="animate-spin" />
                        Loading text layers...
                      </div>
                    )}

                    {/* No text nodes found */}
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
                {/* Connection status */}
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
                    {/* Browse templates */}
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

                    {canvaError && (
                      <p className="text-xs text-red-400">{canvaError}</p>
                    )}

                    {/* Template selector */}
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

                    {/* Field mapper */}
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
                            <div
                              key={f.name}
                              className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center"
                            >
                              <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-zinc-300 truncate">
                                {f.name}
                              </div>
                              <ArrowRight size={14} className="text-zinc-600" />
                              <select
                                value={canvaFieldMapping[f.name] || ""}
                                onChange={(e) =>
                                  setCanvaFieldMapping((prev) => ({ ...prev, [f.name]: e.target.value }))
                                }
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

                    {/* Loading */}
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
        )}

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
