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
  connectHeygen,
  getHeygenStatus,
  disconnectHeygen,
  connectWebflow,
  getWebflowStatus,
  disconnectWebflow,
  connectNewsletter,
  getNewsletterStatus,
  disconnectNewsletter,
  connectLinkedIn,
  getLinkedInStatus,
  disconnectLinkedIn,
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
  Linkedin,
  Globe,
  Mail,
  Link2,
  Unlink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
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

  // HeyGen connection state
  const [heygenConnected, setHeygenConnected] = useState(false);
  const [heygenMaskedKey, setHeygenMaskedKey] = useState("");
  const [heygenApiKey, setHeygenApiKey] = useState("");
  const [heygenLoading, setHeygenLoading] = useState(false);
  const [heygenShowKey, setHeygenShowKey] = useState(false);

  // Publishing channels state
  const [linkedinStatus, setLinkedinStatus] = useState<{ connected: boolean; profile_name?: string; masked_token?: string }>({ connected: false });
  const [webflowStatus, setWebflowStatus] = useState<{ connected: boolean; site_name?: string; masked_token?: string }>({ connected: false });
  const [newsletterStat, setNewsletterStat] = useState<{ connected: boolean; from_email?: string; masked_key?: string }>({ connected: false });
  const [channelLoading, setChannelLoading] = useState<string | null>(null);
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const [channelMsg, setChannelMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Channel form fields
  const [liToken, setLiToken] = useState("");
  const [wfToken, setWfToken] = useState("");
  const [wfSiteId, setWfSiteId] = useState("");
  const [nlApiKey, setNlApiKey] = useState("");
  const [nlFromEmail, setNlFromEmail] = useState("newsletter@siete.com");

  const loadLanguages = () =>
    getLanguages().then((r) => setLanguages(r.data));

  const loadResources = () =>
    getResources().then((r) => setResources(r.data));

  const loadHeygenStatus = () =>
    getHeygenStatus()
      .then((r) => {
        setHeygenConnected(r.data.connected);
        setHeygenMaskedKey(r.data.masked_key || "");
      })
      .catch(() => {});

  const loadChannelStatuses = () => {
    getLinkedInStatus().then((r) => setLinkedinStatus(r.data)).catch(() => {});
    getWebflowStatus().then((r) => setWebflowStatus(r.data)).catch(() => {});
    getNewsletterStatus().then((r) => setNewsletterStat(r.data)).catch(() => {});
  };

  useEffect(() => {
    loadLanguages();
    loadResources();
    getResourceTypes().then((r) => setResourceTypes(r.data));
    loadHeygenStatus();
    loadChannelStatuses();
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

  // HeyGen handlers
  const handleConnectHeygen = async () => {
    if (!heygenApiKey.trim()) return;
    setHeygenLoading(true);
    try {
      await connectHeygen(heygenApiKey);
      setHeygenApiKey("");
      loadHeygenStatus();
    } catch {
      setChannelMsg({ type: "error", text: "Invalid HeyGen API key." });
      setTimeout(() => setChannelMsg(null), 4000);
    } finally {
      setHeygenLoading(false);
    }
  };

  const handleDisconnectHeygen = async () => {
    setHeygenLoading(true);
    try {
      await disconnectHeygen();
      setHeygenConnected(false);
      setHeygenMaskedKey("");
    } catch {
      setChannelMsg({ type: "error", text: "Failed to disconnect HeyGen." });
      setTimeout(() => setChannelMsg(null), 4000);
    } finally {
      setHeygenLoading(false);
    }
  };

  // Channel connection handlers
  const handleConnectChannel = async (channel: string) => {
    setChannelLoading(channel);
    setChannelMsg(null);
    try {
      if (channel === "linkedin") {
        await connectLinkedIn({ access_token: liToken });
        setLiToken("");
      } else if (channel === "webflow") {
        await connectWebflow({ api_token: wfToken, site_id: wfSiteId });
        setWfToken("");
        setWfSiteId("");
      } else if (channel === "newsletter") {
        await connectNewsletter({ api_key: nlApiKey, from_email: nlFromEmail });
        setNlApiKey("");
      }
      setExpandedChannel(null);
      setChannelMsg({ type: "success", text: `${channel} connected successfully.` });
      setTimeout(() => setChannelMsg(null), 4000);
      loadChannelStatuses();
    } catch {
      setChannelMsg({ type: "error", text: `Failed to connect ${channel}. Check your credentials.` });
      setTimeout(() => setChannelMsg(null), 4000);
    } finally {
      setChannelLoading(null);
    }
  };

  const handleDisconnectChannel = async (channel: string) => {
    setChannelLoading(channel);
    setChannelMsg(null);
    try {
      if (channel === "linkedin") await disconnectLinkedIn();
      else if (channel === "webflow") await disconnectWebflow();
      else if (channel === "newsletter") await disconnectNewsletter();
      setChannelMsg({ type: "success", text: `${channel} disconnected.` });
      setTimeout(() => setChannelMsg(null), 4000);
      loadChannelStatuses();
    } catch {
      setChannelMsg({ type: "error", text: `Failed to disconnect ${channel}.` });
      setTimeout(() => setChannelMsg(null), 4000);
    } finally {
      setChannelLoading(null);
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
      <FormSection title="AI Video Provider" className="mb-6">
        <div className="space-y-1.5">
          {/* HeyGen — with connection UI */}
          <div className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Video size={14} className="text-zinc-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200">HeyGen</span>
                    <Badge variant="info" size="sm">Default</Badge>
                    {heygenConnected && (
                      <Badge variant="success" size="sm">Connected</Badge>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">175+ languages, lip-sync, best for multilingual</span>
                </div>
              </div>
              {heygenConnected ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500 font-mono">{heygenMaskedKey}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnectHeygen}
                    loading={heygenLoading}
                    icon={<Unlink size={13} />}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type={heygenShowKey ? "text" : "password"}
                      placeholder="HeyGen API key"
                      value={heygenApiKey}
                      onChange={(e) => setHeygenApiKey(e.target.value)}
                      className="w-48 bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-zinc-200 pr-8"
                      onKeyDown={(e) => e.key === "Enter" && handleConnectHeygen()}
                    />
                    <button
                      type="button"
                      onClick={() => setHeygenShowKey(!heygenShowKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                    >
                      {heygenShowKey ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleConnectHeygen}
                    loading={heygenLoading}
                    disabled={!heygenApiKey.trim()}
                    icon={<Link2 size={13} />}
                  >
                    Connect
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Synthesia — info only */}
          <div className="flex items-center justify-between p-3 bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                <Video size={14} className="text-zinc-500" />
              </div>
              <div>
                <span className="text-sm font-medium text-zinc-200">Synthesia</span>
                <span className="text-xs text-zinc-500 block">Enterprise-grade, SOC 2 compliance</span>
              </div>
            </div>
            <Badge variant="default" size="sm">Coming soon</Badge>
          </div>

          {/* D-ID — info only */}
          <div className="flex items-center justify-between p-3 bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                <Video size={14} className="text-zinc-500" />
              </div>
              <div>
                <span className="text-sm font-medium text-zinc-200">D-ID</span>
                <span className="text-xs text-zinc-500 block">Conversational AI, real-time interactions</span>
              </div>
            </div>
            <Badge variant="default" size="sm">Coming soon</Badge>
          </div>
        </div>
      </FormSection>

      {/* Publishing Channels Section */}
      <FormSection title="Publishing Channels">
        {channelMsg && (
          <Alert variant={channelMsg.type} className="mb-4">
            {channelMsg.text}
          </Alert>
        )}

        <div className="space-y-1.5">
          {/* LinkedIn */}
          <div className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedChannel(expandedChannel === "linkedin" ? null : "linkedin")}
              className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#0077B5]/10 flex items-center justify-center">
                  <Linkedin size={14} className="text-[#0077B5]" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200">LinkedIn</span>
                    {linkedinStatus.connected ? (
                      <Badge variant="success" size="sm">Connected</Badge>
                    ) : (
                      <Badge variant="default" size="sm">Not connected</Badge>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">
                    {linkedinStatus.connected
                      ? linkedinStatus.profile_name
                      : "Publish posts to your LinkedIn profile"}
                  </span>
                </div>
              </div>
              {expandedChannel === "linkedin" ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
            </button>
            {expandedChannel === "linkedin" && (
              <div className="px-3 pb-3 pt-1 border-t border-[var(--border-subtle)]">
                {linkedinStatus.connected ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Token: {linkedinStatus.masked_token}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnectChannel("linkedin")}
                      loading={channelLoading === "linkedin"}
                      icon={<Unlink size={13} />}
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[11px] text-zinc-500">
                      Paste your LinkedIn access token.{" "}
                      <a
                        href="https://www.linkedin.com/developers/apps"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:underline"
                      >
                        Get it from LinkedIn Developer Portal →
                      </a>
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        placeholder="LinkedIn access token"
                        value={liToken}
                        onChange={(e) => setLiToken(e.target.value)}
                        className="flex-1 bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleConnectChannel("linkedin")}
                        loading={channelLoading === "linkedin"}
                        disabled={!liToken.trim()}
                        icon={<Link2 size={13} />}
                      >
                        Connect
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Webflow */}
          <div className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedChannel(expandedChannel === "webflow" ? null : "webflow")}
              className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#4353FF]/10 flex items-center justify-center">
                  <Globe size={14} className="text-[#4353FF]" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200">Webflow</span>
                    {webflowStatus.connected ? (
                      <Badge variant="success" size="sm">Connected</Badge>
                    ) : (
                      <Badge variant="default" size="sm">Not connected</Badge>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">
                    {webflowStatus.connected
                      ? webflowStatus.site_name
                      : "Publish blog posts and landing pages to Webflow"}
                  </span>
                </div>
              </div>
              {expandedChannel === "webflow" ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
            </button>
            {expandedChannel === "webflow" && (
              <div className="px-3 pb-3 pt-1 border-t border-[var(--border-subtle)]">
                {webflowStatus.connected ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Token: {webflowStatus.masked_token}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnectChannel("webflow")}
                      loading={channelLoading === "webflow"}
                      icon={<Unlink size={13} />}
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        placeholder="Webflow API token"
                        value={wfToken}
                        onChange={(e) => setWfToken(e.target.value)}
                        className="flex-1 bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                      />
                      <input
                        type="text"
                        placeholder="Site ID"
                        value={wfSiteId}
                        onChange={(e) => setWfSiteId(e.target.value)}
                        className="w-40 bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleConnectChannel("webflow")}
                        loading={channelLoading === "webflow"}
                        disabled={!wfToken.trim() || !wfSiteId.trim()}
                        icon={<Link2 size={13} />}
                      >
                        Connect
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Newsletter (Resend) */}
          <div className="bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedChannel(expandedChannel === "newsletter" ? null : "newsletter")}
              className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Mail size={14} className="text-emerald-400" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200">Newsletter (Resend)</span>
                    {newsletterStat.connected ? (
                      <Badge variant="success" size="sm">Connected</Badge>
                    ) : (
                      <Badge variant="default" size="sm">Not connected</Badge>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">
                    {newsletterStat.connected
                      ? `From: ${newsletterStat.from_email}`
                      : "Send newsletters via Resend email API"}
                  </span>
                </div>
              </div>
              {expandedChannel === "newsletter" ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
            </button>
            {expandedChannel === "newsletter" && (
              <div className="px-3 pb-3 pt-1 border-t border-[var(--border-subtle)]">
                {newsletterStat.connected ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Key: {newsletterStat.masked_key}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnectChannel("newsletter")}
                      loading={channelLoading === "newsletter"}
                      icon={<Unlink size={13} />}
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        placeholder="Resend API key"
                        value={nlApiKey}
                        onChange={(e) => setNlApiKey(e.target.value)}
                        className="flex-1 bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                      />
                      <input
                        type="email"
                        placeholder="From email"
                        value={nlFromEmail}
                        onChange={(e) => setNlFromEmail(e.target.value)}
                        className="w-48 bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleConnectChannel("newsletter")}
                        loading={channelLoading === "newsletter"}
                        disabled={!nlApiKey.trim()}
                        icon={<Link2 size={13} />}
                      >
                        Connect
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </FormSection>
    </div>
  );
}
