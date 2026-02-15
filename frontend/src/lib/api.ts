import axios from "axios";
import { supabase } from "./supabase";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 30000, // 30s default timeout
});

// Attach Supabase JWT to every request
const attachAuth = async (config: import("axios").InternalAxiosRequestConfig) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
};

api.interceptors.request.use(attachAuth);

// Direct backend client — bypasses Vercel proxy to avoid its ~30s timeout
// Used for long-running AI operations (content generation, translation, etc.)
const backendUrl = process.env.NEXT_PUBLIC_API_URL || "";
const directApi = backendUrl
  ? axios.create({
      baseURL: `${backendUrl}/api`,
      headers: { "Content-Type": "application/json" },
      timeout: 150000, // 2.5 min for AI operations
    })
  : api; // fallback to proxy in local dev

if (backendUrl) {
  directApi.interceptors.request.use(attachAuth);
}

// --- Languages ---
export const getLanguages = (activeOnly = false) =>
  api.get("/languages/", { params: activeOnly ? { active_only: true } : {} });

export const createLanguage = (data: {
  code: string;
  name: string;
  native_name: string;
  flag_emoji?: string;
}) => api.post("/languages/", data);

export const updateLanguage = (id: string, data: Record<string, unknown>) =>
  api.put(`/languages/${id}`, data);

export const deleteLanguage = (id: string) => api.delete(`/languages/${id}`);

// --- Research ---
export const getResearchWeeks = (limit = 10) =>
  api.get("/research/weeks", { params: { limit } });

export const getResearchWeek = (weekId: string) =>
  api.get(`/research/weeks/${weekId}`);

export const getResearchProblems = (params?: Record<string, string | number>) =>
  api.get("/research/problems", { params });

export const getResearchProblem = (id: string) =>
  api.get(`/research/problems/${id}`);

export const triggerResearch = (data?: {
  niches?: string[];
  countries?: string[];
}) => api.post("/research/trigger", data || {});

// --- Research Configs ---
export const getResearchConfigs = () => api.get("/research/configs");

export const getResearchConfig = (id: string) =>
  api.get(`/research/configs/${id}`);

export const createResearchConfig = (data: {
  name: string;
  niches: string[];
  countries: string[];
  decision_makers: string[];
  keywords: string[];
}) => api.post("/research/configs", data);

export const updateResearchConfig = (
  id: string,
  data: {
    name?: string;
    niches?: string[];
    countries?: string[];
    decision_makers?: string[];
    keywords?: string[];
    is_active?: boolean;
  }
) => api.put(`/research/configs/${id}`, data);

export const deleteResearchConfig = (id: string) =>
  api.delete(`/research/configs/${id}`);

export const runResearchConfig = (id: string) =>
  directApi.post(`/research/configs/${id}/run`); // uses directApi for long-running research

export const getResearchWeekStatus = (weekId: string) =>
  api.get<{ week_id: string; status: string; problem_count: number }>(
    `/research/weeks/${weekId}/status`
  );

// --- Templates ---
export const getTemplates = (activeOnly = false) =>
  api.get("/templates/", { params: activeOnly ? { active_only: true } : {} });

export const getTemplate = (id: string) => api.get(`/templates/${id}`);

export const createTemplate = (data: Record<string, unknown>) =>
  api.post("/templates/", data);

export const updateTemplate = (id: string, data: Record<string, unknown>) =>
  api.put(`/templates/${id}`, data);

export const deleteTemplate = (id: string) => api.delete(`/templates/${id}`);

export const duplicateTemplate = (id: string) =>
  api.post(`/templates/${id}/duplicate`);

// --- Template Assets ---
export const getTemplateAssets = (templateId: string) =>
  api.get(`/templates/${templateId}/assets`);

export const uploadTemplateAsset = (templateId: string, data: FormData) =>
  api.post(`/templates/${templateId}/assets/upload`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const deleteTemplateAsset = (templateId: string, assetId: string) =>
  api.delete(`/templates/${templateId}/assets/${assetId}`);

// --- Content ---
export const getContentItems = (params?: Record<string, string | number>) =>
  api.get("/content/", { params });

export const getContentItem = (id: string) => api.get(`/content/${id}`);

export const generateContent = (data: {
  problem_id?: string;
  custom_topic?: string;
  template_id: string;
  language: string;
  country?: string;
  tone?: string;
  additional_instructions?: string;
}) => directApi.post("/content/generate", data); // uses directApi to bypass Vercel proxy timeout

export const updateContent = (id: string, data: Record<string, unknown>) =>
  api.put(`/content/${id}`, data);

export const deleteContent = (id: string) => api.delete(`/content/${id}`);

export const translateContent = (
  id: string,
  data: { target_language: string; target_country?: string }
) => directApi.post(`/content/${id}/translate`, data); // uses directApi for AI operations

export const publishContent = (id: string, channel: string) =>
  api.post(`/content/${id}/publish`, { channel });

export const getContentVersions = (id: string) =>
  api.get(`/content/${id}/versions`);

export const renderContent = (id: string) =>
  api.post(`/content/${id}/render`);

// --- Amplification ---
export const getAmplificationCandidates = () =>
  api.get("/amplification/candidates");

export const getAmplifyContent = (params?: Record<string, string | number>) =>
  api.get("/amplification/content", { params });

export const getPublishChannels = () =>
  api.get("/amplification/channels");

export const batchPublish = (contentIds: string[], channel: string) =>
  directApi.post("/amplification/batch-publish", { content_ids: contentIds, channel });

export const amplifyToBlog = (contentId: string) =>
  api.post("/amplification/blog", null, { params: { content_id: contentId } });

export const createNewsletter = (contentIds: string[]) =>
  api.post("/amplification/newsletter", contentIds);

export const createLandingPage = (contentId: string) =>
  api.post("/amplification/landing-page", null, { params: { content_id: contentId } });

// --- Publishing Channel Connections ---
export const connectLinkedIn = (data: { access_token: string }) =>
  api.post("/amplification/linkedin/connect", data);

export const getLinkedInStatus = () =>
  api.get("/amplification/linkedin/status");

export const disconnectLinkedIn = () =>
  api.delete("/amplification/linkedin/disconnect");

export const connectWebflow = (data: { api_token: string; site_id: string }) =>
  api.post("/amplification/webflow/connect", data);

export const getWebflowStatus = () =>
  api.get("/amplification/webflow/status");

export const disconnectWebflow = () =>
  api.delete("/amplification/webflow/disconnect");

export const connectNewsletter = (data: { api_key: string; from_email?: string }) =>
  api.post("/amplification/newsletter/connect", data);

export const getNewsletterStatus = () =>
  api.get("/amplification/newsletter/status");

export const disconnectNewsletter = () =>
  api.delete("/amplification/newsletter/disconnect");

// --- Metrics ---
export const getDashboard = () => api.get("/metrics/dashboard");

export const importMetric = (data: Record<string, unknown>) =>
  api.post("/metrics/import/manual", data);

export const importLinkedInCSV = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/metrics/import/linkedin", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const getContentMetrics = (contentId: string) =>
  api.get(`/metrics/content/${contentId}`);

export const getWeeklyReports = () => api.get("/metrics/reports");

// --- Videos ---
export const getVideos = (params?: { status?: string; limit?: number }) =>
  api.get("/videos/", { params });

export const getVideo = (id: string) => api.get(`/videos/${id}`);

export const generateVideo = (data: {
  content_item_id: string;
  provider?: string;
  avatar_id?: string;
  language?: string;
}) => api.post("/videos/generate", data);

export const getVideoStatus = (id: string) => api.get(`/videos/${id}/status`);

export const getProviderAvatars = (provider: string) =>
  api.get(`/videos/providers/${provider}/avatars`);

// --- HeyGen Connection ---
export const connectHeygen = (apiKey: string) =>
  api.post("/videos/providers/heygen/connect", { api_key: apiKey });

export const getHeygenStatus = () =>
  api.get("/videos/providers/heygen/status");

export const disconnectHeygen = () =>
  api.delete("/videos/providers/heygen/disconnect");

// --- Resources ---
export const getResources = (resourceType?: string) =>
  api.get("/resources/", { params: resourceType ? { resource_type: resourceType } : {} });

export const getResourceTypes = () => api.get("/resources/types");

export const uploadResource = (data: FormData) =>
  api.post("/resources/upload", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const createResourceNoFile = (data: FormData) =>
  api.post("/resources/", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const updateResource = (id: string, data: FormData) =>
  api.put(`/resources/${id}`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const deleteResource = (id: string) => api.delete(`/resources/${id}`);

// --- ICP Profile ---
export interface ICPProfile {
  industries: string[];
  countries: string[];
  decision_makers: string[];
  keywords: string[];
  company_description: string;
  business_model: string;
  is_configured: boolean;
}

export const getICPProfile = () =>
  api.get<ICPProfile>("/settings/icp");

export const saveICPProfile = (data: Omit<ICPProfile, "is_configured">) =>
  api.put<ICPProfile>("/settings/icp", data);

// --- Onboarding ---
export const checkOnboardingStatus = () => api.get("/onboarding/status");

export const setupOrganization = (data: { org_name: string; org_slug: string }) =>
  api.post("/onboarding/setup", data);

export default api;
