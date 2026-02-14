"use client";
import { useEffect, useState } from "react";
import { getTemplates, deleteTemplate, duplicateTemplate } from "@/lib/api";
import type { ContentTemplate } from "@/types";
import { LayoutTemplate, Plus, Copy, Trash2 } from "lucide-react";
import Link from "next/link";

const TYPE_COLORS: Record<string, string> = {
  carousel: "bg-blue-500/10 text-blue-400",
  meet_the_team: "bg-pink-500/10 text-pink-400",
  case_study: "bg-emerald-500/10 text-emerald-400",
  meme: "bg-amber-500/10 text-amber-400",
  avatar_video: "bg-purple-500/10 text-purple-400",
  linkedin_post: "bg-sky-500/10 text-sky-400",
  blog_post: "bg-orange-500/10 text-orange-400",
  newsletter: "bg-teal-500/10 text-teal-400",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);

  const load = () =>
    getTemplates().then((r) => setTemplates(r.data));

  useEffect(() => {
    load();
  }, []);

  const handleDuplicate = async (id: string) => {
    await duplicateTemplate(id);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deactivate this template?")) return;
    await deleteTemplate(id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LayoutTemplate size={24} className="text-indigo-400" />
            Templates
          </h1>
          <p className="text-gray-400 mt-1">
            Manage your content types and visual layouts
          </p>
        </div>
        <Link
          href="/templates/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Template
        </Link>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {templates
          .filter((t) => t.is_active)
          .map((t) => (
            <div
              key={t.id}
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 hover:border-gray-600/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                    TYPE_COLORS[t.content_type] || "bg-gray-700 text-gray-300"
                  }`}
                >
                  {t.content_type.replace(/_/g, " ")}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleDuplicate(t.id)}
                    className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
                    title="Duplicate"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400 transition-colors"
                    title="Deactivate"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <Link href={`/templates/${t.id}`}>
                <h3 className="text-sm font-semibold text-white mb-1 hover:text-indigo-400 transition-colors">
                  {t.name}
                </h3>
              </Link>
              <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                {t.description}
              </p>
              <div className="text-xs text-gray-600">
                {t.structure.length} fields &middot; Tone: {t.default_tone}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
