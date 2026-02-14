"use client";
import { useEffect, useState } from "react";
import { getContentItems, deleteContent } from "@/lib/api";
import type { ContentItem } from "@/types";
import { Library, Trash2, Globe, Languages } from "lucide-react";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-400",
  review: "bg-amber-500/10 text-amber-400",
  published: "bg-green-500/10 text-green-400",
  amplified: "bg-purple-500/10 text-purple-400",
};

export default function ContentPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [filter, setFilter] = useState({ language: "", status: "" });

  const load = () => {
    const params: Record<string, string | number> = {};
    if (filter.language) params.language = filter.language;
    if (filter.status) params.status = filter.status;
    getContentItems(params).then((r) => setItems(r.data));
  };

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Library size={24} className="text-indigo-400" />
            Content Library
          </h1>
          <p className="text-gray-400 mt-1">
            All generated content in one place
          </p>
        </div>
        <Link
          href="/generate"
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Generate New
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="review">Review</option>
          <option value="published">Published</option>
          <option value="amplified">Amplified</option>
        </select>
        <select
          value={filter.language}
          onChange={(e) => setFilter({ ...filter, language: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
        >
          <option value="">All Languages</option>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="pt">Portuguese</option>
        </select>
      </div>

      {/* Content Grid */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Library size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No content yet</p>
          <p className="text-sm mt-1">Generate your first piece of content</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 hover:border-gray-600/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    STATUS_COLORS[item.status] || STATUS_COLORS.draft
                  }`}
                >
                  {item.status}
                </span>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <Link href={`/content/${item.id}`}>
                <h3 className="text-sm font-semibold text-white mb-2 hover:text-indigo-400 transition-colors line-clamp-2">
                  {item.title}
                </h3>
              </Link>
              <div className="flex items-center gap-3 text-xs text-gray-500">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
