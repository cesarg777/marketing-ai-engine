"use client";
import { useEffect, useState } from "react";
import { getTemplates, deleteTemplate, duplicateTemplate } from "@/lib/api";
import type { ContentTemplate } from "@/types";
import { LayoutTemplate, Plus, Copy, Trash2, Lock, Layers } from "lucide-react";
import Link from "next/link";
import { PageHeader, Card, Badge, Button, EmptyState } from "@/components/ui";

const TYPE_VARIANT: Record<string, "info" | "purple" | "success" | "warning" | "danger" | "default"> = {
  carousel: "info",
  meet_the_team: "purple",
  case_study: "success",
  meme: "warning",
  avatar_video: "purple",
  linkedin_post: "info",
  blog_post: "warning",
  newsletter: "success",
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

  const isSystem = (t: ContentTemplate) => t.org_id === null;

  const activeTemplates = templates.filter((t) => t.is_active);

  return (
    <div>
      <PageHeader
        icon={LayoutTemplate}
        title="Templates"
        subtitle="Manage your content types and visual layouts"
        actions={
          <Link href="/templates/new">
            <Button icon={<Plus size={14} />}>New Template</Button>
          </Link>
        }
      />

      {activeTemplates.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No templates yet"
          description="Create a custom template or wait for system templates to load"
        />
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {activeTemplates.map((t) => (
            <Card key={t.id} hover padding="md">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={TYPE_VARIANT[t.content_type] || "default"}
                    size="sm"
                  >
                    {t.content_type.replace(/_/g, " ")}
                  </Badge>
                  {isSystem(t) && (
                    <Badge variant="default" size="sm">
                      <Lock size={9} className="mr-1" />
                      System
                    </Badge>
                  )}
                </div>
                <div className="flex gap-0.5">
                  <button
                    onClick={() => handleDuplicate(t.id)}
                    className="p-1.5 rounded-md hover:bg-zinc-700/50 text-zinc-600 hover:text-zinc-300 transition-colors"
                    title="Duplicate"
                  >
                    <Copy size={13} />
                  </button>
                  {!isSystem(t) && (
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
                      title="Deactivate"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              <Link href={`/templates/${t.id}`}>
                <h3 className="text-sm font-semibold text-zinc-200 mb-1 hover:text-indigo-400 transition-colors">
                  {t.name}
                </h3>
              </Link>
              <p className="text-xs text-zinc-500 mb-3 line-clamp-2">
                {t.description}
              </p>
              <div className="text-[11px] text-zinc-600 flex items-center gap-2">
                <span>{t.structure.length} fields</span>
                <span className="w-0.5 h-0.5 rounded-full bg-zinc-700" />
                <span className="capitalize">{t.default_tone}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
