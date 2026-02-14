"use client";
import { useEffect, useState } from "react";
import { getAmplificationCandidates, amplifyToBlog } from "@/lib/api";
import { Megaphone, FileText, Mail, Globe, Loader2 } from "lucide-react";

interface Candidate {
  content: {
    id: number;
    title: string;
    language: string;
    status: string;
  };
  total_engagement: number;
  total_impressions: number;
}

export default function AmplifyPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [amplifying, setAmplifying] = useState<number | null>(null);

  useEffect(() => {
    getAmplificationCandidates()
      .then((r) => setCandidates(r.data))
      .catch(() => {});
  }, []);

  const handleAmplifyBlog = async (contentId: number) => {
    setAmplifying(contentId);
    try {
      await amplifyToBlog(contentId);
      alert("Blog post created! Check the Content Library.");
    } catch {
      alert("Amplification failed.");
    }
    setAmplifying(null);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Megaphone size={24} className="text-indigo-400" />
          Amplify
        </h1>
        <p className="text-gray-400 mt-1">
          Expand top-performing content into blogs, newsletters, and landing
          pages
        </p>
      </div>

      {candidates.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Megaphone size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No amplification candidates</p>
          <p className="text-sm mt-1">
            Publish content and add performance metrics to identify top
            performers
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {candidates.map((c) => (
            <div
              key={c.content.id}
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">
                    {c.content.title}
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{c.content.language.toUpperCase()}</span>
                    <span>
                      {c.total_impressions.toLocaleString()} impressions
                    </span>
                    <span>{c.total_engagement.toLocaleString()} engagement</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAmplifyBlog(c.content.id)}
                    disabled={amplifying === c.content.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    {amplifying === c.content.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <FileText size={12} />
                    )}
                    Blog Post
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg font-medium transition-colors">
                    <Mail size={12} />
                    Newsletter
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg font-medium transition-colors">
                    <Globe size={12} />
                    Landing Page
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
