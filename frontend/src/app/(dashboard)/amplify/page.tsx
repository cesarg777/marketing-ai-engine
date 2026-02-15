"use client";
import { useEffect, useState, useMemo } from "react";
import {
  getAmplifyContent,
  getPublishChannels,
  batchPublish,
  amplifyToBlog,
  createNewsletter,
  createLandingPage,
} from "@/lib/api";
import type { PublishChannel, ContentItem, Publication } from "@/types";
import {
  Megaphone,
  FileText,
  Mail,
  Globe,
  Send,
  CheckSquare,
  Square,
  Linkedin,
  ChevronDown,
  Settings,
  Loader2,
  CheckCircle2,
  Circle,
  MinusSquare,
} from "lucide-react";
import Link from "next/link";
import { PageHeader, Badge, Button, EmptyState, Alert } from "@/components/ui";

interface AmplifyItem {
  content: ContentItem;
  publications: Publication[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: "default",
  published: "success",
  amplified: "info",
  review: "warning",
  archived: "default",
};

const CHANNEL_ICONS: Record<string, typeof Linkedin> = {
  linkedin: Linkedin,
  webflow_blog: Globe,
  webflow_landing: Globe,
  newsletter: Mail,
};

export default function AmplifyPage() {
  const [items, setItems] = useState<AmplifyItem[]>([]);
  const [channels, setChannels] = useState<PublishChannel[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [amplifying, setAmplifying] = useState<string | null>(null);
  const [amplifyAction, setAmplifyAction] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterLanguage, setFilterLanguage] = useState<string>("");
  const [showPublishMenu, setShowPublishMenu] = useState(false);

  const loadContent = () => {
    setLoading(true);
    const params: Record<string, string | number> = { limit: 100 };
    if (filterStatus) params.status = filterStatus;
    if (filterLanguage) params.language = filterLanguage;
    getAmplifyContent(params)
      .then((r) => setItems(r.data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadContent();
    getPublishChannels()
      .then((r) => setChannels(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadContent();
  }, [filterStatus, filterLanguage]);

  // Derived data
  const connectedChannels = useMemo(
    () => channels.filter((ch) => ch.connected),
    [channels]
  );

  const languages = useMemo(() => {
    const set = new Set(items.map((i) => i.content.language));
    return Array.from(set).sort();
  }, [items]);

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.content.id)));
    }
  };

  // Publish handlers
  const handleBatchPublish = async (channel: string) => {
    setShowPublishMenu(false);
    if (selectedIds.size === 0) return;
    setPublishing(true);
    setError("");
    try {
      const result = await batchPublish(Array.from(selectedIds), channel);
      const published = result.data.published?.length || 0;
      const errors = result.data.errors?.length || 0;
      setSuccess(
        `Published ${published} item${published !== 1 ? "s" : ""} to ${channel}${errors > 0 ? ` (${errors} failed)` : ""}.`
      );
      setTimeout(() => setSuccess(""), 5000);
      setSelectedIds(new Set());
      loadContent();
    } catch {
      setError("Publishing failed. Check your channel connection in Settings.");
    } finally {
      setPublishing(false);
    }
  };

  // Amplify handlers
  const handleAmplify = async (contentId: string, action: string) => {
    setAmplifying(contentId);
    setAmplifyAction(action);
    setError("");
    try {
      if (action === "blog") {
        await amplifyToBlog(contentId);
        setSuccess("Blog post created! Check Content Library.");
      } else if (action === "newsletter") {
        await createNewsletter([contentId]);
        setSuccess("Newsletter composed!");
      } else if (action === "landing") {
        await createLandingPage(contentId);
        setSuccess("Landing page created!");
      }
      setTimeout(() => setSuccess(""), 4000);
      loadContent();
    } catch {
      setError(`${action} amplification failed.`);
    } finally {
      setAmplifying(null);
      setAmplifyAction(null);
    }
  };

  const handleBatchAmplify = async (action: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setPublishing(true);
    setError("");
    try {
      if (action === "newsletter") {
        await createNewsletter(ids);
        setSuccess("Newsletter composed from selected content!");
      } else {
        // Blog/landing — process first selected only
        if (action === "blog") await amplifyToBlog(ids[0]);
        else await createLandingPage(ids[0]);
        setSuccess(`${action === "blog" ? "Blog post" : "Landing page"} created!`);
      }
      setTimeout(() => setSuccess(""), 4000);
      setSelectedIds(new Set());
      loadContent();
    } catch {
      setError(`${action} amplification failed.`);
    } finally {
      setPublishing(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div>
      <PageHeader
        icon={Megaphone}
        title="Publish & Amplify"
        subtitle="Distribute content to channels and expand top performers"
      />

      {/* Alerts */}
      {success && <Alert variant="success" className="mb-4">{success}</Alert>}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {/* Channel status bar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-xs text-zinc-500 mr-1">Channels:</span>
        {channels.map((ch) => {
          const Icon = CHANNEL_ICONS[ch.name] || Globe;
          return (
            <span
              key={ch.name}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                ch.connected
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-zinc-800/50 text-zinc-500 border border-zinc-700/50"
              }`}
            >
              <Icon size={11} />
              {ch.label}
              {ch.connected ? (
                <CheckCircle2 size={10} />
              ) : (
                <Circle size={10} />
              )}
            </span>
          );
        })}
        <Link
          href="/settings"
          className="text-[11px] text-indigo-400 hover:text-indigo-300 ml-1 flex items-center gap-1"
        >
          <Settings size={11} />
          Manage
        </Link>
      </div>

      {/* Filters + action bar */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          {/* Status filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="appearance-none bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg pl-3 pr-7 py-1.5 text-xs text-zinc-300 cursor-pointer"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="amplified">Amplified</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>

          {/* Language filter */}
          <div className="relative">
            <select
              value={filterLanguage}
              onChange={(e) => setFilterLanguage(e.target.value)}
              className="appearance-none bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg pl-3 pr-7 py-1.5 text-xs text-zinc-300 cursor-pointer"
            >
              <option value="">All languages</option>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>

          {selectedIds.size > 0 && (
            <span className="text-xs text-indigo-400 font-medium ml-2">
              {selectedIds.size} selected
            </span>
          )}
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            {/* Publish to channel dropdown */}
            {connectedChannels.length > 0 && (
              <div className="relative">
                <Button
                  size="sm"
                  onClick={() => setShowPublishMenu(!showPublishMenu)}
                  loading={publishing}
                  icon={<Send size={13} />}
                >
                  Publish to...
                  <ChevronDown size={12} className="ml-1" />
                </Button>
                {showPublishMenu && (
                  <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-xl py-1 min-w-[180px]">
                    {connectedChannels.map((ch) => {
                      const Icon = CHANNEL_ICONS[ch.name] || Globe;
                      return (
                        <button
                          key={ch.name}
                          onClick={() => handleBatchPublish(ch.name)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                        >
                          <Icon size={13} />
                          {ch.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Amplify actions */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleBatchAmplify("blog")}
              loading={publishing}
              icon={<FileText size={13} />}
            >
              Blog
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleBatchAmplify("newsletter")}
              loading={publishing}
              icon={<Mail size={13} />}
            >
              Newsletter
            </Button>
          </div>
        )}
      </div>

      {/* Content table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-zinc-500" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No content yet"
          description="Generate content first, then come back to publish and amplify it"
        />
      ) : (
        <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[40px_1fr_80px_80px_90px_140px] items-center px-3 py-2.5 bg-[var(--surface-input)] border-b border-[var(--border-subtle)] text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
            <button onClick={toggleSelectAll} className="flex items-center justify-center text-zinc-500 hover:text-zinc-300">
              {allSelected ? (
                <CheckSquare size={15} className="text-indigo-400" />
              ) : someSelected ? (
                <MinusSquare size={15} className="text-indigo-400" />
              ) : (
                <Square size={15} />
              )}
            </button>
            <span>Title</span>
            <span>Lang</span>
            <span>Status</span>
            <span>Date</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Table rows */}
          {items.map((item) => {
            const c = item.content;
            const pubs = item.publications || [];
            const isSelected = selectedIds.has(c.id);
            const isThisAmplifying = amplifying === c.id;

            return (
              <div
                key={c.id}
                className={`grid grid-cols-[40px_1fr_80px_80px_90px_140px] items-center px-3 py-2.5 border-b border-[var(--border-subtle)] last:border-b-0 transition-colors ${
                  isSelected ? "bg-indigo-500/5" : "hover:bg-zinc-800/30"
                }`}
              >
                {/* Checkbox */}
                <button onClick={() => toggleSelect(c.id)} className="flex items-center justify-center text-zinc-500 hover:text-zinc-300">
                  {isSelected ? (
                    <CheckSquare size={15} className="text-indigo-400" />
                  ) : (
                    <Square size={15} />
                  )}
                </button>

                {/* Title + published channels */}
                <div className="min-w-0">
                  <span className="text-sm text-zinc-200 truncate block">{c.title}</span>
                  {pubs.length > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {pubs.map((pub) => {
                        const Icon = CHANNEL_ICONS[pub.channel] || Globe;
                        return (
                          <span
                            key={pub.id}
                            className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400"
                            title={`Published to ${pub.channel}`}
                          >
                            <Icon size={9} />
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Language */}
                <Badge variant="default" size="sm">
                  {c.language.toUpperCase()}
                </Badge>

                {/* Status */}
                <Badge variant={STATUS_COLORS[c.status] as "default" | "success" | "info" | "warning"} size="sm">
                  {c.status}
                </Badge>

                {/* Date */}
                <span className="text-[11px] text-zinc-500">
                  {formatDate(c.created_at)}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 justify-end">
                  <button
                    onClick={() => handleAmplify(c.id, "blog")}
                    disabled={isThisAmplifying}
                    className="p-1.5 rounded-md hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                    title="Amplify to blog"
                  >
                    {isThisAmplifying && amplifyAction === "blog" ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <FileText size={13} />
                    )}
                  </button>
                  <button
                    onClick={() => handleAmplify(c.id, "newsletter")}
                    disabled={isThisAmplifying}
                    className="p-1.5 rounded-md hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                    title="Compose newsletter"
                  >
                    {isThisAmplifying && amplifyAction === "newsletter" ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Mail size={13} />
                    )}
                  </button>
                  <button
                    onClick={() => handleAmplify(c.id, "landing")}
                    disabled={isThisAmplifying}
                    className="p-1.5 rounded-md hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                    title="Create landing page"
                  >
                    {isThisAmplifying && amplifyAction === "landing" ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Globe size={13} />
                    )}
                  </button>
                  {connectedChannels.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedIds(new Set([c.id]));
                        setShowPublishMenu(true);
                      }}
                      className="p-1.5 rounded-md hover:bg-indigo-500/10 text-zinc-500 hover:text-indigo-400 transition-colors"
                      title="Publish to channel"
                    >
                      <Send size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
