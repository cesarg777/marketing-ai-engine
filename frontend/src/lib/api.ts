import axios from "axios";
import { supabase } from "./supabase";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

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
}) => api.post("/research/configs", data);

export const updateResearchConfig = (
  id: string,
  data: { name?: string; niches?: string[]; countries?: string[]; is_active?: boolean }
) => api.put(`/research/configs/${id}`, data);

export const deleteResearchConfig = (id: string) =>
  api.delete(`/research/configs/${id}`);

export const runResearchConfig = (id: string) =>
  api.post(`/research/configs/${id}/run`);

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
}) => api.post("/content/generate", data);

export const updateContent = (id: string, data: Record<string, unknown>) =>
  api.put(`/content/${id}`, data);

export const deleteContent = (id: string) => api.delete(`/content/${id}`);

export const translateContent = (
  id: string,
  data: { target_language: string; target_country?: string }
) => api.post(`/content/${id}/translate`, data);

export const publishContent = (id: string, channel: string) =>
  api.post(`/content/${id}/publish`, { channel });

export const getContentVersions = (id: string) =>
  api.get(`/content/${id}/versions`);

export const renderContent = (id: string) =>
  api.post(`/content/${id}/render`);

// --- Amplification ---
export const getAmplificationCandidates = () =>
  api.get("/amplification/candidates");

export const amplifyToBlog = (contentId: string) =>
  api.post("/amplification/blog", null, { params: { content_id: contentId } });

export const createNewsletter = (contentIds: string[]) =>
  api.post("/amplification/newsletter", contentIds);

export const createLandingPage = (contentId: string) =>
  api.post("/amplification/landing-page", null, { params: { content_id: contentId } });

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

// --- Onboarding ---
export const checkOnboardingStatus = () => api.get("/onboarding/status");

export const setupOrganization = (data: { org_name: string; org_slug: string }) =>
  api.post("/onboarding/setup", data);

export default api;
