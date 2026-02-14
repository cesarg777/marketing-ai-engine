"use client";
import { useEffect, useState, useRef } from "react";
import { getDashboard, importLinkedInCSV, importMetric } from "@/lib/api";
import type { DashboardData } from "@/types";
import {
  Card,
  PageHeader,
  EmptyState,
  FormSection,
  Button,
  Input,
  Alert,
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
} from "lucide-react";

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

  const loadDashboard = () =>
    getDashboard().then((r) => setData(r.data)).catch(() => {});

  useEffect(() => {
    loadDashboard();
  }, []);

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

      {!hasData && !showManual && (
        <EmptyState
          icon={BarChart3}
          title="No analytics data yet"
          description="Generate and publish content, then import metrics via CSV or add them manually"
        />
      )}
    </div>
  );
}
