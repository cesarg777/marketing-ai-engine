"use client";
import { useEffect, useState } from "react";
import { getLanguages, createLanguage, updateLanguage } from "@/lib/api";
import type { Language } from "@/types";
import { Settings, Plus, Video, X } from "lucide-react";
import {
  PageHeader,
  FormSection,
  Input,
  Button,
  Toggle,
  Badge,
} from "@/components/ui";

export default function SettingsPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [showAddLang, setShowAddLang] = useState(false);
  const [newLang, setNewLang] = useState({
    code: "",
    name: "",
    native_name: "",
    flag_emoji: "",
  });

  const loadLanguages = () =>
    getLanguages().then((r) => setLanguages(r.data));

  useEffect(() => {
    loadLanguages();
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

  return (
    <div className="max-w-3xl">
      <PageHeader
        icon={Settings}
        title="Settings"
        subtitle="Configure languages, video providers, and brand settings"
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
