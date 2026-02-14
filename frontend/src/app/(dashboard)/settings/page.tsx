"use client";
import { useEffect, useState, useRef } from "react";
import {
  getLanguages,
  createLanguage,
  updateLanguage,
  getResources,
  getResourceTypes,
  uploadResource,
  createResourceNoFile,
  deleteResource,
} from "@/lib/api";
import type { Language, OrgResource, ResourceType } from "@/types";
import {
  Settings,
  Plus,
  Video,
  X,
  Upload,
  Trash2,
  Image,
  FileText,
  Type,
  Users,
  Building2,
  Palette,
} from "lucide-react";
import {
  PageHeader,
  FormSection,
  Input,
  Button,
  Toggle,
  Badge,
  Alert,
} from "@/components/ui";

const RESOURCE_ICONS: Record<string, typeof Image> = {
  logo: Image,
  brand_manual: FileText,
  font: Type,
  team_photo: Users,
  client_logo: Building2,
  color_palette: Palette,
};

export default function SettingsPage() {
  // Languages state
  const [languages, setLanguages] = useState<Language[]>([]);
  const [showAddLang, setShowAddLang] = useState(false);
  const [newLang, setNewLang] = useState({
    code: "",
    name: "",
    native_name: "",
    flag_emoji: "",
  });

  // Resources state
  const [resources, setResources] = useState<OrgResource[]>([]);
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [activeTab, setActiveTab] = useState("logo");
  const [uploading, setUploading] = useState(false);
  const [resourceError, setResourceError] = useState("");
  const [resourceSuccess, setResourceSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Color palette state
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#6366f1");

  const loadLanguages = () =>
    getLanguages().then((r) => setLanguages(r.data));

  const loadResources = () =>
    getResources().then((r) => setResources(r.data));

  useEffect(() => {
    loadLanguages();
    loadResources();
    getResourceTypes().then((r) => setResourceTypes(r.data));
  }, []);

  const handleToggleLanguage = async (lang: Language) => {
    await updateLanguage(lang.id, { is_active: !lang.is_active });
    loadLanguages();
  };

  const handleAddLanguage = async () => {
    if (!newLang.code || !newLang.name) return;
    await createLanguage(newLang);
    setNewLang({ code: "", name: "", native_name: "", flag_emoji: "" });
    setShowAddLang(false);
    loadLanguages();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setResourceError("");
    setResourceSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("resource_type", activeTab);
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));
      formData.append("metadata_json", "{}");

      await uploadResource(formData);
      setResourceSuccess(`${file.name} uploaded successfully.`);
      setTimeout(() => setResourceSuccess(""), 3000);
      loadResources();
    } catch {
      setResourceError("Upload failed. Check file type and size (max 10 MB).");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddColorPalette = async () => {
    if (!newColorName.trim() || !newColorHex.trim()) return;

    setUploading(true);
    setResourceError("");
    try {
      const formData = new FormData();
      formData.append("resource_type", "color_palette");
      formData.append("name", newColorName.trim());
      formData.append(
        "metadata_json",
        JSON.stringify({ hex: newColorHex, label: newColorName.trim() })
      );

      await createResourceNoFile(formData);
      setNewColorName("");
      setNewColorHex("#6366f1");
      setResourceSuccess("Color added.");
      setTimeout(() => setResourceSuccess(""), 3000);
      loadResources();
    } catch {
      setResourceError("Failed to add color.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteResource = async (id: string) => {
    try {
      await deleteResource(id);
      loadResources();
    } catch {
      setResourceError("Failed to delete resource.");
    }
  };

  const filteredResources = resources.filter(
    (r) => r.resource_type === activeTab
  );

  const currentType = resourceTypes.find((t) => t.type === activeTab);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        icon={Settings}
        title="Settings"
        subtitle="Configure languages, brand resources, and video providers"
      />

      {/* Languages Section */}
      <FormSection
        title="Languages"
        actions={
          <button
            onClick={() => setShowAddLang(!showAddLang)}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {showAddLang ? (
              <>
                <X size={14} />
                Cancel
              </>
            ) : (
              <>
                <Plus size={14} />
                Add Language
              </>
            )}
          </button>
        }
        className="mb-6"
      >
        {showAddLang && (
          <div className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg p-4 grid grid-cols-[80px_1fr_1fr_auto] gap-3 items-end">
            <Input
              label="Code"
              placeholder="fr"
              value={newLang.code}
              onChange={(e) =>
                setNewLang({ ...newLang, code: e.target.value })
              }
            />
            <Input
              label="Name"
              placeholder="French"
              value={newLang.name}
              onChange={(e) =>
                setNewLang({ ...newLang, name: e.target.value })
              }
            />
            <Input
              label="Native Name"
              placeholder="Fran&ccedil;ais"
              value={newLang.native_name}
              onChange={(e) =>
                setNewLang({ ...newLang, native_name: e.target.value })
              }
            />
            <Button size="sm" onClick={handleAddLanguage}>
              Add
            </Button>
          </div>
        )}

        <div className="space-y-1.5">
          {languages.map((lang) => (
            <div
              key={lang.id}
              className="flex items-center justify-between p-3 bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg transition-colors hover:border-[var(--border-hover)]"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg leading-none">{lang.flag_emoji}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200">
                    {lang.name}
                  </span>
                  <span className="text-xs text-zinc-500">
                    ({lang.native_name})
                  </span>
                  <Badge variant="default" size="sm">
                    {lang.code}
                  </Badge>
                </div>
              </div>
              <Toggle
                checked={lang.is_active}
                onChange={() => handleToggleLanguage(lang)}
              />
            </div>
          ))}
        </div>
      </FormSection>

      {/* Brand Resources Section */}
      <FormSection title="Brand Resources" className="mb-6">
        {resourceError && (
          <Alert variant="error" className="mb-4">
            {resourceError}
          </Alert>
        )}
        {resourceSuccess && (
          <Alert variant="success" className="mb-4">
            {resourceSuccess}
          </Alert>
        )}

        {/* Resource type tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {resourceTypes.map((rt) => {
            const Icon = RESOURCE_ICONS[rt.type] || Image;
            const count = resources.filter(
              (r) => r.resource_type === rt.type
            ).length;
            return (
              <button
                key={rt.type}
                onClick={() => setActiveTab(rt.type)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === rt.type
                    ? "bg-[var(--accent-muted)] text-indigo-400 border border-indigo-500/30"
                    : "bg-[var(--surface-input)] text-zinc-500 border border-[var(--border-subtle)] hover:text-zinc-300 hover:border-[var(--border-hover)]"
                }`}
              >
                <Icon size={13} />
                {rt.label}
                {count > 0 && (
                  <span className="ml-1 text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded-full">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Upload area or color picker */}
        {activeTab === "color_palette" ? (
          <div className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg p-4 mb-4">
            <div className="flex items-end gap-3">
              <Input
                label="Color Name"
                placeholder="Primary Blue"
                value={newColorName}
                onChange={(e) => setNewColorName(e.target.value)}
              />
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-400 tracking-wide">
                  Hex Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newColorHex}
                    onChange={(e) => setNewColorHex(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-[var(--border-subtle)] cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={newColorHex}
                    onChange={(e) => setNewColorHex(e.target.value)}
                    className="w-24 bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-sm text-zinc-200 font-mono"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleAddColorPalette}
                loading={uploading}
                icon={<Plus size={14} />}
              >
                Add
              </Button>
            </div>
          </div>
        ) : (
          <label
            className={`flex flex-col items-center justify-center gap-2 p-6 mb-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              uploading
                ? "border-indigo-500/40 bg-indigo-500/5"
                : "border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-input)]"
            }`}
          >
            <Upload
              size={20}
              className={uploading ? "text-indigo-400 animate-pulse" : "text-zinc-600"}
            />
            <span className="text-xs text-zinc-500">
              {uploading
                ? "Uploading..."
                : `Drop or click to upload ${currentType?.label || "file"}`}
            </span>
            <span className="text-[10px] text-zinc-600">
              {currentType?.accepts} &middot; Max 10 MB
            </span>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        )}

        {/* Resource list */}
        {filteredResources.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-zinc-600">
              No {currentType?.label?.toLowerCase() || "resources"} uploaded yet.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredResources.map((r) => {
              const Icon = RESOURCE_ICONS[r.resource_type] || Image;
              const isImage =
                r.mime_type.startsWith("image/") && !r.mime_type.includes("svg");
              const isColor = r.resource_type === "color_palette";
              const hexColor = isColor
                ? (r.metadata_json?.hex as string) || "#888"
                : null;

              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg transition-colors hover:border-[var(--border-hover)]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isColor && hexColor ? (
                      <div
                        className="w-8 h-8 rounded-lg border border-zinc-700 shrink-0"
                        style={{ backgroundColor: hexColor }}
                      />
                    ) : isImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={r.file_url}
                        alt={r.name}
                        className="w-8 h-8 rounded-lg object-cover border border-zinc-700 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                        <Icon size={14} className="text-zinc-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-zinc-200 truncate block">
                        {r.name}
                      </span>
                      <span className="text-[11px] text-zinc-600">
                        {isColor && hexColor
                          ? hexColor
                          : `${r.file_name} · ${formatFileSize(r.file_size)}`}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteResource(r.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </FormSection>

      {/* Video Provider Section */}
      <FormSection title="AI Video Provider">
        <div className="space-y-1.5">
          {[
            {
              id: "heygen",
              name: "HeyGen",
              desc: "175+ languages, lip-sync, best for multilingual",
              isDefault: true,
            },
            {
              id: "synthesia",
              name: "Synthesia",
              desc: "Enterprise-grade, SOC 2 compliance",
              isDefault: false,
            },
            {
              id: "did",
              name: "D-ID",
              desc: "Conversational AI, real-time interactions",
              isDefault: false,
            },
          ].map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between p-3 bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Video size={14} className="text-zinc-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200">
                      {provider.name}
                    </span>
                    {provider.isDefault && (
                      <Badge variant="info" size="sm">
                        Default
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">{provider.desc}</span>
                </div>
              </div>
              <span className="text-[11px] text-zinc-600">Configure in .env</span>
            </div>
          ))}
        </div>
      </FormSection>
    </div>
  );
}
