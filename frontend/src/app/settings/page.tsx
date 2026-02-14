"use client";
import { useEffect, useState } from "react";
import { getLanguages, createLanguage, updateLanguage } from "@/lib/api";
import type { Language } from "@/types";
import { Settings, Globe, Plus } from "lucide-react";

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings size={24} className="text-indigo-400" />
          Settings
        </h1>
        <p className="text-gray-400 mt-1">
          Configure languages, video providers, and brand settings
        </p>
      </div>

      {/* Languages Section */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Globe size={18} className="text-indigo-400" />
            Languages
          </h2>
          <button
            onClick={() => setShowAddLang(!showAddLang)}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
          >
            <Plus size={14} />
            Add Language
          </button>
        </div>

        {showAddLang && (
          <div className="bg-gray-900 rounded-lg p-4 mb-4 grid grid-cols-4 gap-3">
            <input
              placeholder="Code (e.g. fr)"
              value={newLang.code}
              onChange={(e) =>
                setNewLang({ ...newLang, code: e.target.value })
              }
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200"
            />
            <input
              placeholder="Name (e.g. French)"
              value={newLang.name}
              onChange={(e) =>
                setNewLang({ ...newLang, name: e.target.value })
              }
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200"
            />
            <input
              placeholder="Native (e.g. Fran\u00e7ais)"
              value={newLang.native_name}
              onChange={(e) =>
                setNewLang({ ...newLang, native_name: e.target.value })
              }
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200"
            />
            <button
              onClick={handleAddLanguage}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium transition-colors"
            >
              Add
            </button>
          </div>
        )}

        <div className="space-y-2">
          {languages.map((lang) => (
            <div
              key={lang.id}
              className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{lang.flag_emoji}</span>
                <div>
                  <span className="text-sm text-white">{lang.name}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({lang.native_name})
                  </span>
                </div>
                <span className="text-xs text-gray-600 font-mono">
                  {lang.code}
                </span>
              </div>
              <button
                onClick={() => handleToggleLanguage(lang)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  lang.is_active ? "bg-indigo-600" : "bg-gray-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    lang.is_active ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Video Provider Section */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          AI Video Provider
        </h2>
        <div className="space-y-2">
          {[
            {
              id: "heygen",
              name: "HeyGen",
              desc: "175+ languages, lip-sync, best for multilingual",
            },
            {
              id: "synthesia",
              name: "Synthesia",
              desc: "Enterprise-grade, SOC 2 compliance",
            },
            {
              id: "did",
              name: "D-ID",
              desc: "Conversational AI, real-time interactions",
            },
          ].map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
            >
              <div>
                <span className="text-sm text-white">{provider.name}</span>
                <span className="text-xs text-gray-500 ml-2">
                  {provider.desc}
                </span>
              </div>
              <span className="text-xs text-gray-600">
                Configure in .env
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
