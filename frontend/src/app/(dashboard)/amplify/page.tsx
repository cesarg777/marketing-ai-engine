"use client";
import { useEffect, useState } from "react";
import {
  getAmplificationCandidates,
  amplifyToBlog,
  createNewsletter,
  createLandingPage,
} from "@/lib/api";
import {
  Megaphone,
  FileText,
  Mail,
  Globe,
  TrendingUp,
  Eye,
  Zap,
} from "lucide-react";
import { PageHeader, Card, Badge, Button, EmptyState, Alert } from "@/components/ui";

interface Candidate {
  content: {
    id: string;
    title: string;
    language: string;
    status: string;
  };
  total_engagement: number;
  total_impressions: number;
}

export default function AmplifyPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [amplifying, setAmplifying] = useState<string | null>(null);
  const [amplifyAction, setAmplifyAction] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getAmplificationCandidates()
      .then((r) => setCandidates(r.data))
      .catch(() => {});
  }, []);

  const handleAmplifyBlog = async (contentId: string) => {
    setAmplifying(contentId);
    setAmplifyAction("blog");
    setError("");
    try {
      await amplifyToBlog(contentId);
      setSuccess("Blog post created! Check the Content Library.");
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError("Blog amplification failed.");
    }
    setAmplifying(null);
    setAmplifyAction(null);
  };

  const handleNewsletter = async (contentId: string) => {
    setAmplifying(contentId);
    setAmplifyAction("newsletter");
    setError("");
    try {
      await createNewsletter([contentId]);
      setSuccess("Newsletter composed! Check the Content Library.");
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError("Newsletter creation failed.");
    }
    setAmplifying(null);
    setAmplifyAction(null);
  };

  const handleLandingPage = async (contentId: string) => {
    setAmplifying(contentId);
    setAmplifyAction("landing");
    setError("");
    try {
      await createLandingPage(contentId);
      setSuccess("Landing page created! Check the Content Library.");
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError("Landing page creation failed.");
    }
    setAmplifying(null);
    setAmplifyAction(null);
  };

  return (
    <div>
      <PageHeader
        icon={Megaphone}
        title="Amplify"
        subtitle="Expand top-performing content into blogs, newsletters, and landing pages"
      />

      {success && (
        <Alert variant="success" className="mb-4">
          {success}
        </Alert>
      )}
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {candidates.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No amplification candidates"
          description="Publish content and add performance metrics to identify top performers"
        />
      ) : (
        <div className="space-y-3">
          {candidates.map((c) => {
            const engagementRate =
              c.total_impressions > 0
                ? ((c.total_engagement / c.total_impressions) * 100).toFixed(1)
                : "0";
            const isThisAmplifying = amplifying === c.content.id;

            return (
              <Card key={c.content.id} hover padding="md">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Content info + metrics */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2">
                      <h3 className="text-sm font-semibold text-zinc-200 truncate">
                        {c.content.title}
                      </h3>
                      <Badge variant="default" size="sm">
                        {c.content.language.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Metrics row */}
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <Eye size={12} className="text-zinc-600" />
                        <span>
                          {c.total_impressions.toLocaleString()} impressions
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <TrendingUp size={12} className="text-zinc-600" />
                        <span>
                          {c.total_engagement.toLocaleString()} engagement
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Zap size={12} className="text-indigo-400" />
                        <span className="text-indigo-400 font-medium">
                          {engagementRate}% rate
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleAmplifyBlog(c.content.id)}
                      loading={isThisAmplifying && amplifyAction === "blog"}
                      disabled={isThisAmplifying}
                      icon={<FileText size={13} />}
                    >
                      Blog Post
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleNewsletter(c.content.id)}
                      loading={isThisAmplifying && amplifyAction === "newsletter"}
                      disabled={isThisAmplifying}
                      icon={<Mail size={13} />}
                    >
                      Newsletter
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleLandingPage(c.content.id)}
                      loading={isThisAmplifying && amplifyAction === "landing"}
                      disabled={isThisAmplifying}
                      icon={<Globe size={13} />}
                    >
                      Landing Page
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
