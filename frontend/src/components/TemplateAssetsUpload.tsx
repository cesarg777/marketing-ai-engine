"use client";
import { useState, useEffect, useCallback } from "react";
import {
  getTemplateAssets,
  uploadTemplateAsset,
  deleteTemplateAsset,
} from "@/lib/api";
import type { TemplateAsset } from "@/types";
import { Upload, Trash2, FileText } from "lucide-react";
import axios from "axios";
import { FormSection, Select, Badge, Alert } from "@/components/ui";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const ASSET_TYPES = [
  { value: "reference_file", label: "AI Style Reference" },
  { value: "background_image", label: "Background Image" },
  { value: "header_image", label: "Header Image" },
  { value: "footer_image", label: "Footer Image" },
  { value: "logo_placeholder", label: "Logo" },
  { value: "layout_pdf", label: "Layout PDF" },
  { value: "custom_image", label: "Custom Image" },
];

export interface BufferedAsset {
  file: File;
  assetType: string;
  preview?: string;
}

interface TemplateAssetsUploadProps {
  /** Live mode: has a templateId, uploads immediately */
  templateId?: string;
  /** Buffered mode: stores files client-side, parent handles upload */
  bufferedFiles?: BufferedAsset[];
  onBufferedFilesChange?: (files: BufferedAsset[]) => void;
}

export function TemplateAssetsUpload({
  templateId,
  bufferedFiles,
  onBufferedFilesChange,
}: TemplateAssetsUploadProps) {
  const isLive = !!templateId;

  // Live mode state
  const [assets, setAssets] = useState<TemplateAsset[]>([]);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [selectedAssetType, setSelectedAssetType] = useState("reference_file");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadAssets = useCallback(async () => {
    if (!templateId) return;
    try {
      const res = await getTemplateAssets(templateId);
      setAssets(res.data);
    } catch {
      // Ignore — assets may not exist yet
    }
  }, [templateId]);

  useEffect(() => {
    if (isLive) loadAssets();
  }, [isLive, loadAssets]);

  // Live mode: upload immediately
  const handleLiveUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !templateId) return;

    if (file.size > MAX_FILE_SIZE) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`);
      e.target.value = "";
      return;
    }

    setUploadingAsset(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("asset_type", selectedAssetType);
      formData.append("name", file.name);
      await uploadTemplateAsset(templateId, formData);
      await loadAssets();
      setSuccess("Asset uploaded successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Failed to upload asset.");
      }
    } finally {
      setUploadingAsset(false);
      e.target.value = "";
    }
  };

  const handleLiveDelete = async (assetId: string) => {
    if (!templateId || !confirm("Delete this asset?")) return;
    try {
      await deleteTemplateAsset(templateId, assetId);
      setAssets(assets.filter((a) => a.id !== assetId));
    } catch {
      setError("Failed to delete asset.");
    }
  };

  // Buffered mode: add file to parent state
  const handleBufferedAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onBufferedFilesChange || !bufferedFiles) return;

    if (file.size > MAX_FILE_SIZE) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`);
      e.target.value = "";
      return;
    }

    setError("");
    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    onBufferedFilesChange([...bufferedFiles, { file, assetType: selectedAssetType, preview }]);
    e.target.value = "";
  };

  const handleBufferedDelete = (idx: number) => {
    if (!onBufferedFilesChange || !bufferedFiles) return;
    const asset = bufferedFiles[idx];
    if (asset.preview) URL.revokeObjectURL(asset.preview);
    onBufferedFilesChange(bufferedFiles.filter((_, i) => i !== idx));
  };

  // Decide which items to show in grid
  const hasLiveAssets = isLive && assets.length > 0;
  const hasBufferedAssets = !isLive && bufferedFiles && bufferedFiles.length > 0;

  return (
    <FormSection title="Assets & References">
      <p className="text-xs text-zinc-600 mb-3">
        Upload files for this template. <strong className="text-zinc-500">AI Style Reference</strong> files
        are shown to the AI so it can match your visual style. Other types are used during content rendering
        (backgrounds, logos, etc.).
      </p>

      {error && <Alert variant="error" className="mb-3">{error}</Alert>}
      {success && <Alert variant="success" className="mb-3">{success}</Alert>}

      {/* Live assets grid */}
      {hasLiveAssets && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="group relative bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg p-3 hover:border-[var(--border-hover)] transition-colors"
            >
              {asset.mime_type.startsWith("image/") && asset.file_url ? (
                <div className="mb-2 rounded overflow-hidden bg-zinc-900">
                  <img src={asset.file_url} alt={asset.name} className="w-full h-20 object-cover" />
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={14} className="text-amber-400 shrink-0" />
                </div>
              )}
              <span className="text-xs text-zinc-300 truncate block">{asset.name}</span>
              <Badge
                size="sm"
                variant={asset.asset_type === "reference_file" ? "info" : "default"}
                className="mt-1"
              >
                {ASSET_TYPES.find((t) => t.value === asset.asset_type)?.label ||
                  asset.asset_type.replace(/_/g, " ")}
              </Badge>
              <div className="text-[10px] text-zinc-600 mt-1">
                {(asset.file_size / 1024).toFixed(0)} KB
              </div>
              <button
                type="button"
                onClick={() => handleLiveDelete(asset.id)}
                className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-all"
                title="Delete asset"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Buffered assets grid */}
      {hasBufferedAssets && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {bufferedFiles!.map((asset, idx) => (
            <div
              key={idx}
              className="group relative bg-[var(--surface-input)] border border-[var(--border-subtle)] rounded-lg p-3 hover:border-[var(--border-hover)] transition-colors"
            >
              {asset.preview ? (
                <div className="mb-2 rounded overflow-hidden bg-zinc-900">
                  <img src={asset.preview} alt={asset.file.name} className="w-full h-20 object-cover" />
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={14} className="text-amber-400 shrink-0" />
                </div>
              )}
              <span className="text-xs text-zinc-300 truncate block">{asset.file.name}</span>
              <Badge
                size="sm"
                variant={asset.assetType === "reference_file" ? "info" : "default"}
                className="mt-1"
              >
                {ASSET_TYPES.find((t) => t.value === asset.assetType)?.label ||
                  asset.assetType.replace(/_/g, " ")}
              </Badge>
              <div className="text-[10px] text-zinc-600 mt-1">
                {(asset.file.size / 1024).toFixed(0)} KB
              </div>
              <button
                type="button"
                onClick={() => handleBufferedDelete(idx)}
                className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-all"
                title="Remove file"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      <div className="flex items-center gap-3">
        <Select
          value={selectedAssetType}
          onChange={(e) => setSelectedAssetType(e.target.value)}
          options={ASSET_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          className="w-48"
        />
        <label className="flex-1">
          <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-[var(--border-subtle)] rounded-lg cursor-pointer hover:border-indigo-500/40 hover:bg-zinc-800/30 transition-colors">
            <Upload size={16} className="text-zinc-500" />
            <span className="text-sm text-zinc-500">
              {uploadingAsset ? "Uploading..." : "Click to upload (PNG, JPG, SVG, PDF)"}
            </span>
          </div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp,application/pdf"
            onChange={isLive ? handleLiveUpload : handleBufferedAdd}
            disabled={uploadingAsset}
            className="hidden"
          />
        </label>
      </div>
    </FormSection>
  );
}
