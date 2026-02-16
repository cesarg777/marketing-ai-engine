"use client";
import { useEffect, useState } from "react";
import { getContentItems, deleteContent, getLanguages } from "@/lib/api";
import type { ContentItem } from "@/types";
import { Card, Badge, PageHeader, Button, EmptyState, Select } from "@/components/ui";
import { Library, Trash2, Globe, Plus } from "lucide-react";
import Link from "next/link";

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "purple"> = {
  draft: "default",
  review: "warning",
  published: "success",
  amplified: "purple",
};

interface LanguageOption {
  code: string;
  name: string;
}

export default function ContentPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [filter, setFilter] = useState({ language: "", status: "" });

  const load = () => {
    const params: Record<string, string | number> = {};
    if (filter.language) params.language = filter.language;
    if (filter.status) params.status = filter.status;
    getContentItems(params)
      .then((r) => setItems(r.data))
      .catch((e) => console.error("Failed to load content:", e));
  };

  useEffect(() => {
    getLanguages(true)
      .then((r) => setLanguages(r.data))
      .catch((e) => console.error("Failed to load languages:", e));
  }, []);

  useEffect(() => {
    load();
  }, [filter.language, filter.status]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this content?")) return;
    await deleteContent(id);
    load();
  };

  return (
    <div>
      <PageHeader
        icon={Library}
        title="Content Library"
        subtitle="All generated content in one place"
        actions={
          <Link href="/generate">
            <Button icon={<Plus size={16} />}>Generate New</Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="w-44">
          <Select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            options={[
              { value: "", label: "All Statuses" },
              { value: "draft", label: "Draft" },
              { value: "review", label: "Review" },
              { value: "published", label: "Published" },
              { value: "amplified", label: "Amplified" },
            ]}
          />
        </div>
        <div className="w-44">
          <Select
            value={filter.language}
            onChange={(e) => setFilter({ ...filter, language: e.target.value })}
            options={[
              { value: "", label: "All Languages" },
              ...languages.map((l) => ({ value: l.code, label: l.name })),
            ]}
          />
        </div>
      </div>

      {/* Content Grid */}
      {items.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No content yet"
          description="Generate your first piece of content"
          action={
            <Link href="/generate">
              <Button size="sm" icon={<Plus size={14} />}>
                Generate Content
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.id} hover padding="md">
              <div className="flex items-start justify-between mb-3">
                <Badge variant={STATUS_VARIANT[item.status] || "default"}>
                  {item.status}
                </Badge>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-zinc-800/60 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <Link href={`/content/${item.id}`}>
                <h3 className="text-sm font-semibold text-zinc-200 mb-2 hover:text-indigo-400 transition-colors line-clamp-2">
                  {item.title}
                </h3>
              </Link>
              <div className="flex items-center gap-3 text-xs text-zinc-600">
                <span className="flex items-center gap-1">
                  <Globe size={12} />
                  {item.language.toUpperCase()}
                </span>
                {item.generation_tokens > 0 && (
                  <span>{item.generation_tokens} tokens</span>
                )}
                <span>
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
