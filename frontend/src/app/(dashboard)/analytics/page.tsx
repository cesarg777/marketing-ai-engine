"use client";
import { useEffect, useState, useRef } from "react";
import {
  getDashboard,
  importLinkedInCSV,
  importMetric,
  getLinkedInStatus,
  getGA4Status,
  syncLinkedInAnalytics,
  syncGA4Analytics,
  getPlatformMetrics,
} from "@/lib/api";
import type { DashboardData } from "@/types";
import {
  Card,
  PageHeader,
  EmptyState,
  FormSection,
  Button,
  Input,
  Alert,
  Badge,
} from "@/components/ui";
import {
  BarChart3,
  TrendingUp,
  FileText,
  Send,
  Eye,
  ThumbsUp,
  Upload,
  Plus,
  RefreshCw,
  Linkedin,
  Globe,
} from "lucide-react";

interface PlatformMetricRow {
  id: string;
  platform: string;
  date: string;
  page_path: string;
  sessions: number;
  pageviews: number;
  users: number;
  impressions: number;
  clicks: number;
  engagement: number;
  extra_data: Record<string, unknown>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual metric state
  const [showManual, setShowManual] = useState(false);
  const [manualData, setManualData] = useState({
    content_item_id: "",
    channel: "linkedin",
    date: new Date().toISOString().slice(0, 10),
    impressions: "",
    reach: "",
    engagement: "",
    clicks: "",
    conversions: "",
  });
  const [manualSaving, setManualSaving] = useState(false);

  // Platform sync state
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [ga4Connected, setGa4Connected] = useState(false);
  const [syncingLinkedin, setSyncingLinkedin] = useState(false);
  const [syncingGa4, setSyncingGa4] = useState(false);
  const [syncResult, setSyncResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Platform metrics
  const [linkedinMetrics, setLinkedinMetrics] = useState<PlatformMetricRow[]>([]);
  const [ga4Metrics, setGa4Metrics] = useState<PlatformMetricRow[]>([]);

  const loadDashboard = () =>
    getDashboard().then((r) => setData(r.data)).catch(() => {});

  const loadConnectionStatuses = () => {
    getLinkedInStatus().then((r) => setLinkedinConnected(r.data.connected)).catch(() => {});
    getGA4Status().then((r) => setGa4Connected(r.data.connected)).catch(() => {});
  };

  const loadPlatformMetrics = () => {
    getPlatformMetrics("linkedin")
      .then((r) => setLinkedinMetrics(r.data))
      .catch(() => {});
    getPlatformMetrics("ga4")
      .then((r) => setGa4Metrics(r.data))
      .catch(() => {});
  };

  useEffect(() => {
    loadDashboard();
    loadConnectionStatuses();
    loadPlatformMetrics();
  }, []);

  const handleSyncLinkedin = async () => {
    setSyncingLinkedin(true);
    setSyncResult(null);
    try {
      const res = await syncLinkedInAnalytics();
      const s = res.data.summary || {};
      setSyncResult({
        type: "success",
        text: `LinkedIn: Synced ${res.data.synced} posts — ${(s.total_impressions || 0).toLocaleString()} impressions, ${(s.total_engagement || 0).toLocaleString()} engagement`,
      });
      loadPlatformMetrics();
      setTimeout(() => setSyncResult(null), 8000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "LinkedIn sync failed.";
      setSyncResult({ type: "error", text: msg });
      setTimeout(() => setSyncResult(null), 8000);
    } finally {
      setSyncingLinkedin(false);
    }
  };

  const handleSyncGa4 = async () => {
    setSyncingGa4(true);
    setSyncResult(null);
    try {
      const res = await syncGA4Analytics();
      const s = res.data.summary || {};
      setSyncResult({
        type: "success",
        text: `GA4: Synced ${res.data.synced} records — ${(s.total_sessions || 0).toLocaleString()} sessions, ${(s.total_pageviews || 0).toLocaleString()} pageviews`,
      });
      loadPlatformMetrics();
      setTimeout(() => setSyncResult(null), 8000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "GA4 sync failed.";
      setSyncResult({ type: "error", text: msg });
      setTimeout(() => setSyncResult(null), 8000);
    } finally {
      setSyncingGa4(false);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMsg("");
    setUploadError("");

    try {
      const res = await importLinkedInCSV(file);
      setUploadMsg(res.data.detail || "CSV imported successfully.");
      loadDashboard();
      setTimeout(() => setUploadMsg(""), 5000);
    } catch {
      setUploadError("CSV import failed. Check format and file size.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleManualImport = async () => {
    if (!manualData.content_item_id) return;
    setManualSaving(true);
    setUploadError("");
    try {
      await importMetric({
        content_item_id: manualData.content_item_id,
        channel: manualData.channel,
        date: manualData.date,
        impressions: parseInt(manualData.impressions) || 0,
        reach: parseInt(manualData.reach) || 0,
        engagement: parseInt(manualData.engagement) || 0,
        clicks: parseInt(manualData.clicks) || 0,
        conversions: parseInt(manualData.conversions) || 0,
      });
      setUploadMsg("Metric imported.");
      setShowManual(false);
      setManualData({
        content_item_id: "",
        channel: "linkedin",
        date: new Date().toISOString().slice(0, 10),
        impressions: "",
        reach: "",
        engagement: "",
        clicks: "",
        conversions: "",
      });
      loadDashboard();
      setTimeout(() => setUploadMsg(""), 3000);
    } catch {
      setUploadError("Failed to import metric.");
    } finally {
      setManualSaving(false);
    }
  };

  // Aggregate LinkedIn metrics
  const liTotals = linkedinMetrics.reduce(
    (acc, m) => ({
      impressions: acc.impressions + m.impressions,
      engagement: acc.engagement + m.engagement,
      clicks: acc.clicks + m.clicks,
    }),
    { impressions: 0, engagement: 0, clicks: 0 }
  );

  // Aggregate GA4 metrics
  const ga4Totals = ga4Metrics.reduce(
    (acc, m) => ({
      sessions: acc.sessions + m.sessions,
      pageviews: acc.pageviews + m.pageviews,
      users: acc.users + m.users,
    }),
    { sessions: 0, pageviews: 0, users: 0 }
  );

  // Top GA4 pages
  const ga4PageMap: Record<string, { sessions: number; pageviews: number }> = {};
  for (const m of ga4Metrics) {
    if (m.page_path === "/") continue;
    if (!ga4PageMap[m.page_path]) ga4PageMap[m.page_path] = { sessions: 0, pageviews: 0 };
    ga4PageMap[m.page_path].sessions += m.sessions;
    ga4PageMap[m.page_path].pageviews += m.pageviews;
  }
  const topGa4Pages = Object.entries(ga4PageMap)
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .slice(0, 10);

  const stats = [
    {
      label: "Total Content",
      value: data?.total_content ?? 0,
      icon: FileText,
      accent: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Published",
      value: data?.total_published ?? 0,
      icon: Send,
      accent: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Impressions",
      value: data?.total_impressions ?? 0,
      icon: Eye,
      accent: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "Engagement",
      value: data?.total_engagement ?? 0,
      icon: ThumbsUp,
      accent: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  const hasData =
    (data?.top_content?.length ?? 0) > 0 ||
    Object.keys(data?.content_by_type || {}).length > 0;

  const hasPlatformData = linkedinMetrics.length > 0 || ga4Metrics.length > 0;
  const showSyncSection = linkedinConnected || ga4Connected;

  return (
    <div>
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        subtitle="Track content performance and engagement"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowManual(!showManual)}
              icon={<Plus size={13} />}
            >
              Manual
            </Button>
            <label>
              <Button
                variant="secondary"
                size="sm"
                loading={uploading}
                icon={<Upload size={13} />}
                onClick={() => fileInputRef.current?.click()}
              >
                Import CSV
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCSVUpload}
                disabled={uploading}
              />
            </label>
          </div>
        }
      />

      {/* Alerts */}
      {uploadMsg && (
        <Alert variant="success" className="mb-4">
          {uploadMsg}
        </Alert>
      )}
      {uploadError && (
        <Alert variant="error" className="mb-4">
          {uploadError}
        </Alert>
      )}
      {syncResult && (
        <Alert variant={syncResult.type} className="mb-4">
          {syncResult.text}
        </Alert>
      )}

      {/* Platform Sync Controls */}
      {showSyncSection && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* LinkedIn Sync Card */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-[#0077B5]/10 p-2">
                  <Linkedin size={16} className="text-[#0077B5]" strokeWidth={1.8} />
                </div>
                <div>
                  <span className="text-sm font-medium text-zinc-200">LinkedIn</span>
                  {linkedinConnected ? (
                    <Badge variant="success" size="sm" className="ml-2">Connected</Badge>
                  ) : (
                    <Badge variant="default" size="sm" className="ml-2">Not connected</Badge>
                  )}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSyncLinkedin}
                loading={syncingLinkedin}
                disabled={!linkedinConnected}
                icon={<RefreshCw size={13} />}
              >
                Sync
              </Button>
            </div>
            {linkedinMetrics.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-lg font-bold text-white">{liTotals.impressions.toLocaleString()}</div>
                  <div className="text-[11px] text-zinc-500">Impressions</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{liTotals.engagement.toLocaleString()}</div>
                  <div className="text-[11px] text-zinc-500">Engagement</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{liTotals.clicks.toLocaleString()}</div>
                  <div className="text-[11px] text-zinc-500">Clicks</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-600">
                {linkedinConnected ? "No data yet. Click Sync to fetch metrics." : "Connect LinkedIn in Settings to sync."}
              </p>
            )}
          </Card>

          {/* GA4 Sync Card */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-orange-500/10 p-2">
                  <Globe size={16} className="text-orange-400" strokeWidth={1.8} />
                </div>
                <div>
                  <span className="text-sm font-medium text-zinc-200">Google Analytics 4</span>
                  {ga4Connected ? (
                    <Badge variant="success" size="sm" className="ml-2">Connected</Badge>
                  ) : (
                    <Badge variant="default" size="sm" className="ml-2">Not connected</Badge>
                  )}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSyncGa4}
                loading={syncingGa4}
                disabled={!ga4Connected}
                icon={<RefreshCw size={13} />}
              >
                Sync
              </Button>
            </div>
            {ga4Metrics.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-lg font-bold text-white">{ga4Totals.sessions.toLocaleString()}</div>
                  <div className="text-[11px] text-zinc-500">Sessions</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{ga4Totals.pageviews.toLocaleString()}</div>
                  <div className="text-[11px] text-zinc-500">Pageviews</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{ga4Totals.users.toLocaleString()}</div>
                  <div className="text-[11px] text-zinc-500">Users</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-600">
                {ga4Connected ? "No data yet. Click Sync to fetch metrics." : "Connect GA4 in Settings to sync."}
              </p>
            )}
          </Card>
        </div>
      )}

      {/* Manual Metric Import */}
      {showManual && (
        <FormSection title="Import Metric Manually" className="mb-6">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Content Item ID"
              value={manualData.content_item_id}
              onChange={(e) =>
                setManualData({ ...manualData, content_item_id: e.target.value })
              }
              placeholder="UUID of the content item"
            />
            <Input
              label="Channel"
              value={manualData.channel}
              onChange={(e) =>
                setManualData({ ...manualData, channel: e.target.value })
              }
              placeholder="linkedin, webflow, etc."
            />
            <Input
              label="Date"
              type="text"
              value={manualData.date}
              onChange={(e) =>
                setManualData({ ...manualData, date: e.target.value })
              }
              placeholder="YYYY-MM-DD"
            />
            <Input
              label="Impressions"
              type="number"
              value={manualData.impressions}
              onChange={(e) =>
                setManualData({ ...manualData, impressions: e.target.value })
              }
            />
            <Input
              label="Reach"
              type="number"
              value={manualData.reach}
              onChange={(e) =>
                setManualData({ ...manualData, reach: e.target.value })
              }
            />
            <Input
              label="Engagement"
              type="number"
              value={manualData.engagement}
              onChange={(e) =>
                setManualData({ ...manualData, engagement: e.target.value })
              }
            />
            <Input
              label="Clicks"
              type="number"
              value={manualData.clicks}
              onChange={(e) =>
                setManualData({ ...manualData, clicks: e.target.value })
              }
            />
            <Input
              label="Conversions"
              type="number"
              value={manualData.conversions}
              onChange={(e) =>
                setManualData({ ...manualData, conversions: e.target.value })
              }
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              onClick={handleManualImport}
              loading={manualSaving}
            >
              Import
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowManual(false)}
            >
              Cancel
            </Button>
          </div>
        </FormSection>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label} padding="md">
            <div className="flex items-center gap-3 mb-3">
              <div className={`rounded-lg p-2 ${stat.bg}`}>
                <stat.icon size={16} className={stat.accent} strokeWidth={1.8} />
              </div>
              <span className="text-xs text-zinc-500 font-medium tracking-wide">
                {stat.label}
              </span>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {stat.value.toLocaleString()}
            </div>
          </Card>
        ))}
      </div>

      {/* GA4 Top Pages */}
      {topGa4Pages.length > 0 && (
        <Card padding="lg" className="mb-8">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="rounded-lg bg-orange-500/10 p-1.5">
              <Globe size={16} className="text-orange-400" strokeWidth={1.8} />
            </div>
            <h2 className="text-sm font-semibold text-white">
              Top Pages (GA4)
            </h2>
          </div>
          <div className="space-y-2">
            {topGa4Pages.map(([path, data], i) => {
              const maxSessions = topGa4Pages[0]?.[1]?.sessions || 1;
              const pct = Math.min((data.sessions / maxSessions) * 100, 100);
              return (
                <div key={path} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-zinc-600 w-5 shrink-0 text-center">
                    {i + 1}
                  </span>
                  <span className="text-xs text-zinc-300 w-48 shrink-0 truncate font-mono" title={path}>
                    {path}
                  </span>
                  <div className="flex-1 bg-zinc-800/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-orange-500 rounded-full h-1.5 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-zinc-500 w-14 text-right shrink-0">
                    {data.sessions.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Content by Type */}
      {data?.content_by_type &&
        Object.keys(data.content_by_type).length > 0 && (
          <Card padding="lg" className="mb-8">
            <h2 className="text-sm font-semibold text-white mb-5">
              Content by Type
            </h2>
            <div className="space-y-3">
              {Object.entries(data.content_by_type).map(([type, count]) => {
                const pct = Math.min(
                  (count / data.total_content) * 100,
                  100
                );
                return (
                  <div key={type} className="flex items-center gap-4">
                    <span className="text-xs text-zinc-400 capitalize w-28 shrink-0 truncate">
                      {type.replace(/_/g, " ")}
                    </span>
                    <div className="flex-1 bg-zinc-800/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 rounded-full h-1.5 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-zinc-500 w-6 text-right shrink-0">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

      {/* Top Content */}
      {data?.top_content && data.top_content.length > 0 && (
        <Card padding="lg">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="rounded-lg bg-emerald-500/10 p-1.5">
              <TrendingUp
                size={16}
                className="text-emerald-400"
                strokeWidth={1.8}
              />
            </div>
            <h2 className="text-sm font-semibold text-white">
              Top Performing Content
            </h2>
          </div>
          <div className="space-y-2">
            {data.top_content.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-zinc-900/40 border border-[var(--border-subtle)] rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-bold text-zinc-600 w-5 shrink-0 text-center">
                    {i + 1}
                  </span>
                  <span className="text-sm text-zinc-200 truncate">
                    {item.title}
                  </span>
                </div>
                <span className="text-xs font-mono text-amber-400 shrink-0 ml-4">
                  {item.engagement}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!hasData && !hasPlatformData && !showManual && (
        <EmptyState
          icon={BarChart3}
          title="No analytics data yet"
          description="Generate and publish content, then import metrics via CSV, add them manually, or sync from connected platforms"
        />
      )}
    </div>
  );
}
