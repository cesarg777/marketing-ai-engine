"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import {
  getContentItem,
  getTemplate,
  updateContent,
  translateContent,
  getContentVersions,
  getLanguages,
} from "@/lib/api";
import type { ContentItem, ContentTemplate, Language } from "@/types";
import {
  FormSection,
  Input,
  Select,
  Textarea,
  Button,
  Alert,
  Badge,
  Spinner,
  Card,
} from "@/components/ui";
import {
  ArrowLeft,
  Save,
  Languages,
  Globe,
  Clock,
  FileText,
  Eye,
  Trash2,
} from "lucide-react";

const STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "danger" | "purple"
> = {
  draft: "default",
  review: "warning",
  published: "success",
  amplified: "purple",
  archived: "danger",
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "review", label: "In Review" },
  { value: "published", label: "Published" },
  { value: "amplified", label: "Amplified" },
  { value: "archived", label: "Archived" },
];

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "educational", label: "Educational" },
  { value: "provocative", label: "Provocative" },
  { value: "humorous", label: "Humorous" },
];

export default function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [content, setContent] = useState<ContentItem | null>(null);
  const [template, setTemplate] = useState<ContentTemplate | null>(null);
  const [versions, setVersions] = useState<ContentItem[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Editable fields
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("draft");
  const [tone, setTone] = useState("professional");
  const [contentData, setContentData] = useState<Record<string, unknown>>({});
  const [showTranslate, setShowTranslate] = useState(false);
  const [targetLang, setTargetLang] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    Promise.all([
      getContentItem(id),
      getLanguages(true),
    ])
      .then(async ([contentRes, langsRes]) => {
        const c = contentRes.data as ContentItem;
        setContent(c);
        setTitle(c.title);
        setStatus(c.status);
        setTone(c.tone);
        setContentData(c.content_data || {});
        setLanguages(langsRes.data);

        // Fetch template for field structure
        try {
          const tplRes = await getTemplate(c.template_id);
          setTemplate(tplRes.data as ContentTemplate);
        } catch {
          // Template may have been deleted — still show content
        }

        // Fetch versions
        try {
          const versRes = await getContentVersions(id);
          setVersions(
            (versRes.data as ContentItem[]).filter((v) => v.id !== c.id)
          );
        } catch {
          // Versions endpoint may fail if content has no parent
        }
      })
      .catch(() => setError("Content not found."))
      .finally(() => setLoading(false));
  }, [id]);

  const updateField = (key: string, value: unknown) => {
    setContentData((prev) => ({ ...prev, [key]: value }));
  };

  const updateListItem = (
    fieldName: string,
    index: number,
    subKey: string,
    value: string
  ) => {
    setContentData((prev) => {
      const list = [...((prev[fieldName] as Record<string, string>[]) || [])];
      list[index] = { ...list[index], [subKey]: value };
      return { ...prev, [fieldName]: list };
    });
  };

  const addListItem = (fieldName: string) => {
    const field = template?.structure.find((f) => f.name === fieldName);
    const itemSchema = field?.item_schema || {};
    const emptyItem: Record<string, string> = {};
    for (const key of Object.keys(itemSchema)) {
      emptyItem[key] = "";
    }
    setContentData((prev) => {
      const list = [
        ...((prev[fieldName] as Record<string, string>[]) || []),
        emptyItem,
      ];
      return { ...prev, [fieldName]: list };
    });
  };

  const removeListItem = (fieldName: string, index: number) => {
    setContentData((prev) => {
      const list = [
        ...((prev[fieldName] as Record<string, string>[]) || []),
      ].filter((_, i) => i !== index);
      return { ...prev, [fieldName]: list };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await updateContent(id, {
        title: title.trim(),
        status,
        tone,
        content_data: contentData,
      });
      setSuccess("Content saved successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Failed to save content.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTranslate = async () => {
    if (!targetLang) return;
    setTranslating(true);
    setError("");
    try {
      const res = await translateContent(id, {
        target_language: targetLang,
      });
      const translated = res.data as ContentItem;
      setShowTranslate(false);
      setTargetLang("");
      router.push(`/content/${translated.id}`);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Translation failed.");
      }
    } finally {
      setTranslating(false);
    }
  };

  const renderFieldInput = (field: {
    name: string;
    type: string;
    description?: string;
    item_schema?: Record<
      string,
      { type: string; max_length?: number; description?: string }
    >;
  }) => {
    const value = contentData[field.name];

    if (field.type === "list" && field.item_schema) {
      const items = (value as Record<string, string>[]) || [];
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-400 tracking-wide">
              {field.name.replace(/_/g, " ")}
              {field.description && (
                <span className="ml-2 font-normal text-zinc-600">
                  {field.description}
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={() => addListItem(field.name)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              + Add Item
            </button>
          </div>
          {items.map((item, idx) => (
            <div
              key={idx}
              className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-mono text-zinc-600">
                  #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeListItem(field.name, idx)}
                  className="p-1 rounded-md hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              {Object.entries(field.item_schema || {}).map(([subKey, subDef]) => (
                <div key={subKey}>
                  {subDef.type === "textarea" ? (
                    <Textarea
                      label={subKey.replace(/_/g, " ")}
                      value={item[subKey] || ""}
                      onChange={(e) =>
                        updateListItem(field.name, idx, subKey, e.target.value)
                      }
                      rows={2}
                    />
                  ) : (
                    <Input
                      label={subKey.replace(/_/g, " ")}
                      value={item[subKey] || ""}
                      onChange={(e) =>
                        updateListItem(field.name, idx, subKey, e.target.value)
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-xs text-zinc-600 italic py-2">
              No items yet. Click &quot;+ Add Item&quot; above.
            </p>
          )}
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <Textarea
          label={field.name.replace(/_/g, " ")}
          value={(value as string) || ""}
          onChange={(e) => updateField(field.name, e.target.value)}
          rows={4}
        />
      );
    }

    if (field.type === "image" || field.type === "url") {
      return (
        <Input
          label={field.name.replace(/_/g, " ")}
          value={(value as string) || ""}
          onChange={(e) => updateField(field.name, e.target.value)}
          type="url"
          placeholder="https://..."
        />
      );
    }

    if (field.type === "number") {
      return (
        <Input
          label={field.name.replace(/_/g, " ")}
          value={String(value ?? "")}
          onChange={(e) => updateField(field.name, e.target.value)}
          type="number"
        />
      );
    }

    // Default: text
    return (
      <Input
        label={field.name.replace(/_/g, " ")}
        value={(value as string) || ""}
        onChange={(e) => updateField(field.name, e.target.value)}
      />
    );
  };

  if (loading) {
    return <Spinner className="py-20" />;
  }

  if (!content) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-400 mb-4">Content not found.</p>
        <Link
          href="/content"
          className="text-indigo-400 hover:text-indigo-300 text-sm"
        >
          Back to content library
        </Link>
      </div>
    );
  }

  // Available languages for translation (exclude current)
  const translateLangs = languages.filter(
    (l) => l.code !== content.language
  );

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/content"
            className="p-2 rounded-lg hover:bg-zinc-800/60 text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-muted)] flex items-center justify-center">
                <FileText size={16} className="text-indigo-400" />
              </div>
              <span className="line-clamp-1">{content.title}</span>
              <Badge
                variant={STATUS_VARIANT[content.status] || "default"}
                size="sm"
              >
                {content.status}
              </Badge>
            </h1>
            <div className="flex items-center gap-3 mt-1 ml-[44px] text-sm text-zinc-500">
              {template && (
                <span>{template.name}</span>
              )}
              <span className="flex items-center gap-1">
                <Globe size={12} />
                {content.language.toUpperCase()}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {new Date(content.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {content.rendered_html && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              icon={<Eye size={14} />}
            >
              {showPreview ? "Edit" : "Preview"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTranslate(!showTranslate)}
            icon={<Languages size={14} />}
          >
            Translate
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="mb-6">
          {success}
        </Alert>
      )}

      {/* Translate Panel */}
      {showTranslate && (
        <Card padding="md" className="mb-6">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Select
                label="Translate to"
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                options={[
                  { value: "", label: "Select language..." },
                  ...translateLangs.map((l) => ({
                    value: l.code,
                    label: `${l.flag_emoji} ${l.name}`,
                  })),
                ]}
              />
            </div>
            <Button
              size="sm"
              onClick={handleTranslate}
              loading={translating}
              disabled={!targetLang}
              icon={<Languages size={14} />}
            >
              Translate
            </Button>
          </div>
        </Card>
      )}

      {/* Preview Mode */}
      {showPreview && content.rendered_html ? (
        <FormSection title="Rendered Preview" className="mb-6">
          <div
            className="prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: content.rendered_html }}
          />
        </FormSection>
      ) : (
        /* Edit Mode */
        <form onSubmit={handleSave} className="space-y-6">
          {/* Basic Info */}
          <FormSection title="Details">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={STATUS_OPTIONS}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Tone"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                options={TONE_OPTIONS}
              />
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-400 tracking-wide">
                  Language
                </label>
                <div className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-sm text-zinc-400">
                  {content.language.toUpperCase()}
                  {content.country && ` (${content.country})`}
                </div>
              </div>
            </div>
          </FormSection>

          {/* Content Fields */}
          <FormSection
            title={`Content Fields${template ? ` — ${template.name}` : ""}`}
          >
            {template?.structure && template.structure.length > 0 ? (
              <div className="space-y-4">
                {template.structure.map((field) => (
                  <div key={field.name}>{renderFieldInput(field)}</div>
                ))}
              </div>
            ) : (
              /* Fallback: render content_data keys as simple inputs */
              <div className="space-y-4">
                {Object.entries(contentData).map(([key, value]) => {
                  if (typeof value === "string") {
                    return value.length > 100 ? (
                      <Textarea
                        key={key}
                        label={key.replace(/_/g, " ")}
                        value={value}
                        onChange={(e) => updateField(key, e.target.value)}
                        rows={4}
                      />
                    ) : (
                      <Input
                        key={key}
                        label={key.replace(/_/g, " ")}
                        value={value}
                        onChange={(e) => updateField(key, e.target.value)}
                      />
                    );
                  }
                  if (Array.isArray(value)) {
                    return (
                      <Textarea
                        key={key}
                        label={key.replace(/_/g, " ")}
                        value={JSON.stringify(value, null, 2)}
                        onChange={(e) => {
                          try {
                            updateField(key, JSON.parse(e.target.value));
                          } catch {
                            // Keep raw string while user is typing
                          }
                        }}
                        rows={6}
                      />
                    );
                  }
                  return (
                    <Input
                      key={key}
                      label={key.replace(/_/g, " ")}
                      value={String(value ?? "")}
                      onChange={(e) => updateField(key, e.target.value)}
                    />
                  );
                })}
              </div>
            )}
          </FormSection>

          {/* Generation Info */}
          {(content.generation_model || content.generation_tokens > 0) && (
            <FormSection title="Generation Info">
              <div className="flex items-center gap-6 text-sm text-zinc-500">
                {content.generation_model && (
                  <span>
                    Model:{" "}
                    <span className="text-zinc-300">
                      {content.generation_model}
                    </span>
                  </span>
                )}
                {content.generation_tokens > 0 && (
                  <span>
                    Tokens:{" "}
                    <span className="text-zinc-300">
                      {content.generation_tokens.toLocaleString()}
                    </span>
                  </span>
                )}
                {content.updated_at && (
                  <span>
                    Last edited:{" "}
                    <span className="text-zinc-300">
                      {new Date(content.updated_at).toLocaleString()}
                    </span>
                  </span>
                )}
              </div>
            </FormSection>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving} icon={<Save size={15} />}>
              Save Changes
            </Button>
            <Link href="/content">
              <Button variant="ghost">Cancel</Button>
            </Link>
          </div>
        </form>
      )}

      {/* Versions / Translations */}
      {versions.length > 0 && (
        <FormSection title={`Translations & Versions (${versions.length})`} className="mt-6">
          <div className="space-y-2">
            {versions.map((v) => (
              <Link
                key={v.id}
                href={`/content/${v.id}`}
                className="flex items-center justify-between p-3 bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg hover:border-[var(--border-hover)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Globe size={14} className="text-zinc-500" />
                  <span className="text-sm text-zinc-200">{v.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default" size="sm">
                    {v.language.toUpperCase()}
                  </Badge>
                  <Badge
                    variant={STATUS_VARIANT[v.status] || "default"}
                    size="sm"
                  >
                    {v.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </FormSection>
      )}
    </div>
  );
}
